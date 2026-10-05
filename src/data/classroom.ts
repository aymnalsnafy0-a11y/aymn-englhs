/**
 * الفصول عبر Firestore (القواعد في firestore.rules):
 * classes/{code} · members/{uid} · assignments/{id} · assignments/{id}/results/{uid}
 * فصول الطالب محفوظة في مستنده الخاص learners/{uid}/state/english-classes.
 */
import { db as local } from '../db/db'
import {
  generateCode,
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

export async function createClass(name: string, teacherName: string): Promise<ClassInfo> {
  const { db, fs, uid } = await cloudSdk()
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const ref = fs.doc(db, 'classes', code)
    // الرمز عشوائي؛ نتأكد أنه غير مستخدم.
    if ((await fs.getDoc(ref)).exists()) continue
    const info = { name: name.trim().slice(0, 60), teacherUid: uid, teacherName: teacherName.trim().slice(0, 40), createdAt: Date.now() }
    await fs.setDoc(ref, info)
    return { code, ...info }
  }
  throw new Error('code_collision')
}

export async function myTeacherClasses(): Promise<ClassInfo[]> {
  const { db, fs, uid } = await cloudSdk()
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'classes'), fs.where('teacherUid', '==', uid)))
  return withStudentCounts(
    snap.docs.map((d) => ({ code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  )
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

async function readMyClasses(): Promise<MyClasses> {
  const { db, fs, uid } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes'))
  const data = snap.exists() ? (snap.data() as Partial<MyClasses>) : {}
  return { codes: Array.isArray(data.codes) ? data.codes : [], name: data.name ?? '' }
}

async function writeMyClasses(value: MyClasses): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes'), value)
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
  const { db, fs, uid } = await cloudSdk()
  const clean = name.trim().slice(0, 40)
  await fs.setDoc(fs.doc(db, 'classes', code, 'members', uid), { name: clean, joinedAt: Date.now(), ...(await myStats()) })
  const mine = await readMyClasses()
  await writeMyClasses({ codes: [...new Set([...mine.codes, code])], name: clean })
  return info
}

export async function leaveClass(code: string): Promise<void> {
  const { db, fs, uid } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'classes', code, 'members', uid)).catch(() => {})
  const mine = await readMyClasses()
  await writeMyClasses({ ...mine, codes: mine.codes.filter((c) => c !== code) })
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

export async function publishMemberStats(): Promise<void> {
  const cached = (await local.meta.get('myClasses'))?.value as MyClasses | undefined
  if (!cached?.codes.length) return
  const { db, fs, uid } = await cloudSdk()
  const stats = await myStats()
  await Promise.all(
    cached.codes.map((code) =>
      fs.setDoc(fs.doc(db, 'classes', code, 'members', uid), { name: cached.name, ...stats }, { merge: true }),
    ),
  )
}

export type { Assignment, AssignmentWord, Member, Result }

/** عدد واجبات الطالب غير المحلولة في كل فصوله (للبطاقة في الرئيسية). */
export async function pendingHomework(): Promise<{ count: number; firstCode?: string }> {
  const cached = (await local.meta.get('myClasses'))?.value as MyClasses | undefined
  if (!cached?.codes.length) return { count: 0 }
  let count = 0
  let firstCode: string | undefined
  for (const code of cached.codes) {
    const assignments = await listAssignments(code).catch(() => [])
    const results = await Promise.all(assignments.map((a) => getMyResult(code, a.id).catch(() => null)))
    const open = results.filter((r) => !r).length
    if (open && !firstCode) firstCode = code
    count += open
  }
  return { count, firstCode }
}
