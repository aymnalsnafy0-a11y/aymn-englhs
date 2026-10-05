/**
 * الفصول عبر Firestore (القواعد في firestore.rules):
 * classes/{code} · members/{uid} · assignments/{id} · assignments/{id}/results/{uid}
 * فصول الطالب محفوظة في مستنده الخاص learners/{uid}/state/english-classes.
 */
import { db as local } from '../db/db'
import {
  generateCode,
  isAssignedTo,
  nextResult,
  type Assignment,
  type AssignmentWord,
  type Member,
  type Result,
} from '../lib/classroom'
import { toDayKey } from '../lib/dates'
import { currentStreak } from '../lib/streak'
import { cloudSdk } from './cloud'

export interface ClassInfo {
  code: string
  name: string
  teacherUid: string
  teacherName: string
  createdAt?: number
  /** المعلمون المشاركون (uid) وأسماؤهم — يعيّنهم المالك. */
  teachers?: string[]
  teacherNames?: Record<string, string>
  /** عدد الطلاب (يُحسب للمعلم فقط). */
  students?: number
}

/** يضيف عدد طلاب كل فصل (استعلام عدّ، بلا قراءة بيانات الطلاب). */
export async function withStudentCounts(classes: ClassInfo[]): Promise<ClassInfo[]> {
  const { db, fs } = await cloudSdk()
  return Promise.all(
    classes.map(async (c) => {
      try {
        const snap = await fs.getCountFromServer(fs.collection(db, 'classes', c.code, 'members'))
        return { ...c, students: snap.data().count }
      } catch {
        return c
      }
    }),
  )
}

// ——— المدرس ———

/** ينشئ فصلًا. المالك يمرّر المعلم المسؤول؛ وإلا يكون الفصل للمستخدم نفسه. */
export async function createClass(name: string, teacherName: string, teacherUid?: string): Promise<ClassInfo> {
  const { db, fs, uid } = await cloudSdk()
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const ref = fs.doc(db, 'classes', code)
    // الرمز عشوائي؛ نتأكد أنه غير مستخدم.
    if ((await fs.getDoc(ref)).exists()) continue
    const info = { name: name.trim().slice(0, 60), teacherUid: teacherUid ?? uid, teacherName: teacherName.trim().slice(0, 40), createdAt: Date.now() }
    await fs.setDoc(ref, info)
    return { code, ...info }
  }
  throw new Error('code_collision')
}

/** فصول معلم محدد (للمالك). */
export async function classesOf(teacherUid: string): Promise<ClassInfo[]> {
  const { db, fs } = await cloudSdk()
  const col = fs.collection(db, 'classes')
  const [own, co] = await Promise.all([
    fs.getDocs(fs.query(col, fs.where('teacherUid', '==', teacherUid))),
    fs.getDocs(fs.query(col, fs.where('teachers', 'array-contains', teacherUid))).catch(() => null),
  ])
  const byCode = new Map<string, ClassInfo>()
  for (const d of [...own.docs, ...(co?.docs ?? [])]) byCode.set(d.id, { code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) })
  return withStudentCounts([...byCode.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)))
}

/** فصول المعلم: التي يملكها والتي هو مشارك فيها. */
export async function myTeacherClasses(): Promise<ClassInfo[]> {
  const { db, fs, uid } = await cloudSdk()
  const col = fs.collection(db, 'classes')
  const [own, co] = await Promise.all([
    fs.getDocs(fs.query(col, fs.where('teacherUid', '==', uid))),
    fs.getDocs(fs.query(col, fs.where('teachers', 'array-contains', uid))).catch(() => null),
  ])
  const byCode = new Map<string, ClassInfo>()
  for (const d of [...own.docs, ...(co?.docs ?? [])]) byCode.set(d.id, { code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) })
  return withStudentCounts([...byCode.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)))
}

/** للمالك: المعلمون المشاركون في الفصل. */
export async function setCoTeachers(code: string, teachers: { uid: string; name: string }[]): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.updateDoc(fs.doc(db, 'classes', code), {
    teachers: teachers.map((t) => t.uid),
    teacherNames: Object.fromEntries(teachers.map((t) => [t.uid, t.name])),
  })
}

/** للمالك: نقل الفصل لمعلم آخر (الطلاب والواجبات والنتائج تبقى كما هي). */
export async function transferClass(code: string, to: { uid: string; name: string }, keepCo: { uid: string; name: string }[]): Promise<void> {
  const { db, fs } = await cloudSdk()
  const co = keepCo.filter((t) => t.uid !== to.uid)
  await fs.updateDoc(fs.doc(db, 'classes', code), {
    teacherUid: to.uid,
    teacherName: to.name,
    teachers: co.map((t) => t.uid),
    teacherNames: Object.fromEntries(co.map((t) => [t.uid, t.name])),
  })
}

export async function deleteClass(code: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code))
}

export async function listMembers(code: string): Promise<Member[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes', code, 'members'))
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Member, 'uid'>) }))
}

export async function removeMember(code: string, uid: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code, 'members', uid))
}

export async function createAssignment(code: string, a: Omit<Assignment, 'id' | 'createdAt'>): Promise<string> {
  const { db, fs } = await cloudSdk()
  const ref = await fs.addDoc(
    fs.collection(db, 'classes', code, 'assignments'),
    JSON.parse(JSON.stringify({ ...a, dueAt: a.dueAt ?? null, createdAt: Date.now() })),
  )
  return ref.id
}

export async function deleteAssignment(code: string, id: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code, 'assignments', id))
}

export async function listResults(code: string, id: string): Promise<Result[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes', code, 'assignments', id, 'results'))
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Result, 'uid'>) }))
}

// ——— الإعلانات ———

export interface Announcement {
  id: string
  text: string
  byName: string
  createdAt: number
  classCode: string
  className?: string
}

export async function listAnnouncements(code: string): Promise<Announcement[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes', code, 'announcements'))
  return snap.docs
    .map((d) => ({ id: d.id, classCode: code, ...(d.data() as Omit<Announcement, 'id' | 'classCode'>) }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function postAnnouncement(code: string, text: string, byName: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.addDoc(fs.collection(db, 'classes', code, 'announcements'), { text: text.trim().slice(0, 1000), byName, createdAt: Date.now() })
}

export async function deleteAnnouncement(code: string, id: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code, 'announcements', id))
}

// ——— مشترك ———

export async function getClass(code: string): Promise<ClassInfo | null> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'classes', code))
  return snap.exists() ? { code, ...(snap.data() as Omit<ClassInfo, 'code'>) } : null
}

export async function listAssignments(code: string): Promise<Assignment[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes', code, 'assignments'))
  return snap.docs
    .map((d) => {
      const data = d.data() as Omit<Assignment, 'id'> & { dueAt?: string | null }
      return { ...data, id: d.id, dueAt: data.dueAt ?? undefined }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAssignment(code: string, id: string): Promise<Assignment | null> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'classes', code, 'assignments', id))
  if (!snap.exists()) return null
  const data = snap.data() as Omit<Assignment, 'id'> & { dueAt?: string | null }
  return { ...data, id: snap.id, dueAt: data.dueAt ?? undefined }
}

// ——— الطالب ———

interface MyClasses {
  codes: string[]
  name: string
}

/** فصول الطالب: من سجله عند معلمه (students/{uid}) ومن قائمته القديمة. */
async function readMyClasses(): Promise<MyClasses> {
  const { db, fs, uid } = await cloudSdk()
  const [legacy, rec] = await Promise.all([
    fs.getDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes')),
    fs.getDoc(fs.doc(db, 'students', uid)).catch(() => null),
  ])
  const data = legacy.exists() ? (legacy.data() as Partial<MyClasses>) : {}
  const fromRec = rec?.exists() && Array.isArray(rec.data().classes) ? (rec.data().classes as string[]) : []
  const codes = [...new Set([...(Array.isArray(data.codes) ? data.codes : []), ...fromRec])]
  const name = (rec?.exists() ? String(rec.data().name ?? '') : '') || data.name || ''
  return { codes, name }
}

async function writeMyClasses(value: MyClasses): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes'), value)
  // الطالب المرتبط بمعلم: فصوله في سجله أيضًا (يراها معلمه).
  const recRef = fs.doc(db, 'students', uid)
  if ((await fs.getDoc(recRef).catch(() => null))?.exists()) await fs.updateDoc(recRef, { classes: value.codes }).catch(() => {})
  await local.meta.put({ key: 'myClasses', value })
}

export async function myStudentClasses(): Promise<{ name: string; classes: ClassInfo[] }> {
  const mine = await readMyClasses()
  await local.meta.put({ key: 'myClasses', value: mine })
  const classes = (await Promise.all(mine.codes.map((c) => getClass(c).catch(() => null)))).filter((c): c is ClassInfo => !!c)
  return { name: mine.name, classes }
}

export async function joinClass(code: string, name: string): Promise<ClassInfo> {
  const info = await getClass(code)
  if (!info) throw Object.assign(new Error('not_found'), { code: 'not_found' })
  const mine = await readMyClasses()
  const clean = (name.trim() || mine.name).slice(0, 40)
  await enterClasses([code], clean)
  return info
}

/** يدخل الطالب فصولًا (برمز الفصل أو من رمز الطالب) ويحفظها في قائمته. */
export async function enterClasses(codes: string[], name: string): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  const clean = name.trim().slice(0, 40)
  const stats = await myStats()
  for (const code of codes) {
    await fs.setDoc(fs.doc(db, 'classes', code, 'members', uid), { name: clean, joinedAt: Date.now(), ...stats }, { merge: true }).catch((e) => {
      console.warn('[classes] join', code, e?.code)
    })
  }
  const mine = await readMyClasses()
  await writeMyClasses({ codes: [...new Set([...mine.codes, ...codes])], name: clean || mine.name })
}

export async function leaveClass(code: string): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code, 'members', uid)).catch(() => {})
  const mine = await readMyClasses()
  await writeMyClasses({ ...mine, codes: mine.codes.filter((c) => c !== code) })
}

/** نتيجة طالب محدد (للمعلم). */
export async function getMyResultFor(code: string, id: string, uid: string): Promise<Result | null> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'classes', code, 'assignments', id, 'results', uid))
  return snap.exists() ? ({ uid, ...(snap.data() as Omit<Result, 'uid'>) } as Result) : null
}

export async function getMyResult(code: string, id: string): Promise<Result | null> {
  const { db, fs, uid } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'classes', code, 'assignments', id, 'results', uid))
  return snap.exists() ? ({ uid, ...(snap.data() as Omit<Result, 'uid'>) } as Result) : null
}

export async function submitResult(code: string, id: string, score: number, total: number, wrong: string[], wrongQ: number[]): Promise<Result> {
  const { db, fs, uid } = await cloudSdk()
  const prev = await getMyResult(code, id)
  const { name } = await readMyClasses()
  const result = nextResult(prev ?? undefined, { uid, name, score, total, wrong, wrongQ, completedAt: Date.now() })
  const { uid: _uid, ...data } = result
  await fs.setDoc(fs.doc(db, 'classes', code, 'assignments', id, 'results', uid), data)
  return result
}

/** ملخص تقدّم الطالب الذي يراه المدرس (بلا تفاصيل خاصة). */
async function myStats() {
  const progress = await local.progress.toArray()
  const days = (await local.activity.toArray()).map((a) => a.date)
  return {
    lastSeen: Date.now(),
    known: progress.filter((p) => p.status === 'known' || p.status === 'mastered').length,
    learning: progress.filter((p) => p.status === 'learning').length,
    streak: currentStreak(days, toDayKey()),
  }
}

/** ينشر ملخص التقدّم لفصول الطالب ولسجله عند معلمه. */
export async function publishMemberStats(): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  const mine = await readMyClasses().catch(() => (local.meta.get('myClasses').then((r) => r?.value as MyClasses | undefined)))
  if (mine) await local.meta.put({ key: 'myClasses', value: mine })
  const stats = await myStats()
  const recRef = fs.doc(db, 'students', uid)
  if ((await fs.getDoc(recRef).catch(() => null))?.exists()) await fs.updateDoc(recRef, stats).catch(() => {})
  if (!mine?.codes.length) return
  await Promise.all(
    mine.codes.map((code) =>
      fs.setDoc(fs.doc(db, 'classes', code, 'members', uid), { name: mine.name, ...stats }, { merge: true }).catch(() => {}),
    ),
  )
}

export type { Assignment, AssignmentWord, Member, Result }

export interface PendingItem {
  classCode: string
  className: string
  assignment: Assignment
}

/** ما يحتاجه الطالب من معلمه: الواجبات غير المحلولة وآخر الإعلانات (للرئيسية). */
export async function studentInbox(): Promise<{ pending: PendingItem[]; announcements: Announcement[] }> {
  const { uid } = await cloudSdk()
  const mine = await readMyClasses()
  await local.meta.put({ key: 'myClasses', value: mine })
  const pending: PendingItem[] = []
  const announcements: Announcement[] = []
  await Promise.all(
    mine.codes.map(async (code) => {
      const info = await getClass(code).catch(() => null)
      if (!info) return
      const assignments = (await listAssignments(code).catch(() => [])).filter((a) => isAssignedTo(a, uid))
      const results = await Promise.all(assignments.map((a) => getMyResult(code, a.id).catch(() => null)))
      assignments.forEach((a, i) => {
        if (!results[i]) pending.push({ classCode: code, className: info.name, assignment: a })
      })
      const weekAgo = Date.now() - 7 * 864e5
      for (const n of await listAnnouncements(code).catch(() => [])) {
        if (n.createdAt >= weekAgo) announcements.push({ ...n, className: info.name })
      }
    }),
  )
  pending.sort((a, b) => (a.assignment.dueAt ?? '9999').localeCompare(b.assignment.dueAt ?? '9999') || b.assignment.createdAt - a.assignment.createdAt)
  announcements.sort((a, b) => b.createdAt - a.createdAt)
  return { pending, announcements }
}

/** عدد واجبات الطالب غير المحلولة في كل فصوله. */
export async function pendingHomework(): Promise<{ count: number; firstCode?: string }> {
  const { pending } = await studentInbox()
  return { count: pending.length, firstCode: pending[0]?.classCode }
}
