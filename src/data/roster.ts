/**
 * طلاب المعلم (القواعد في firestore.rules):
 * - studentCodes/{code}: رمز دخول يُنشئه المعلم باسم الطالب (وفصول اختيارية). أول حساب يدخله يصبح صاحبه.
 * - studentNotes/{code}: ملاحظات المعلم الخاصة عن الطالب.
 * - students/{uid}: سجل الطالب المرتبط بمعلمه: فصوله وملخص تقدّمه.
 */
import { generateCode, TEACHER_CODE_LENGTH } from '../lib/classroom'
import { cloudSdk } from './cloud'

export interface StudentCode {
  code: string
  teacherUid: string
  teacherName: string
  /** اسم الطالب كما كتبه المعلم. */
  name: string
  /** فصول يدخلها الطالب تلقائيًا عند استخدام الرمز. */
  classes: string[]
  usedBy: string | null
  usedAt?: number
  createdAt?: number
}

export interface StudentRecord {
  uid: string
  name: string
  teacherUid: string
  teacherName?: string
  code: string
  classes: string[]
  joinedAt?: number
  lastSeen?: number
  known?: number
  learning?: number
  streak?: number
}

/** طالب في قائمة المعلم: الرمز دائمًا، والسجل بعد أن يدخل الطالب. */
export interface RosterEntry {
  code: StudentCode
  student?: StudentRecord
}

const asCode = (id: string, d: Record<string, unknown>): StudentCode => ({
  code: id,
  teacherUid: String(d.teacherUid ?? ''),
  teacherName: String(d.teacherName ?? ''),
  name: String(d.name ?? ''),
  classes: Array.isArray(d.classes) ? (d.classes as string[]) : [],
  usedBy: (d.usedBy as string | null) ?? null,
  usedAt: d.usedAt as number | undefined,
  createdAt: d.createdAt as number | undefined,
})

const asStudent = (uid: string, d: Record<string, unknown>): StudentRecord => ({
  uid,
  name: String(d.name ?? ''),
  teacherUid: String(d.teacherUid ?? ''),
  teacherName: d.teacherName as string | undefined,
  code: String(d.code ?? ''),
  classes: Array.isArray(d.classes) ? (d.classes as string[]) : [],
  joinedAt: d.joinedAt as number | undefined,
  lastSeen: d.lastSeen as number | undefined,
  known: d.known as number | undefined,
  learning: d.learning as number | undefined,
  streak: d.streak as number | undefined,
})

// ——— المعلم ———

export async function createStudentCode(input: {
  name: string
  notes?: string
  classes: string[]
  /** للمالك: إنشاء رمز لطالب معلم آخر. */
  teacher?: { uid: string; name: string }
  myName: string
}): Promise<string> {
  const { db, fs, uid } = await cloudSdk()
  const teacher = input.teacher ?? { uid, name: input.myName }
  for (let i = 0; i < 5; i++) {
    const code = generateCode(Math.random, TEACHER_CODE_LENGTH)
    const ref = fs.doc(db, 'studentCodes', code)
    if ((await fs.getDoc(ref)).exists()) continue
    await fs.setDoc(ref, {
      teacherUid: teacher.uid,
      teacherName: teacher.name.slice(0, 40),
      name: input.name.trim().slice(0, 40),
      classes: input.classes,
      usedBy: null,
      createdAt: Date.now(),
    })
    if (input.notes?.trim()) await setNotes(code, input.notes)
    return code
  }
  throw new Error('code_collision')
}

/** قائمة طلاب المعلم (أو كل الطلاب للمالك إن لم يُحدَّد معلم). */
export async function roster(teacherUid?: string): Promise<RosterEntry[]> {
  const { db, fs, uid } = await cloudSdk()
  const who = teacherUid === undefined ? uid : teacherUid
  const byTeacher = (col: string) =>
    who === '*' ? fs.getDocs(fs.collection(db, col)) : fs.getDocs(fs.query(fs.collection(db, col), fs.where('teacherUid', '==', who)))
  const [codes, students] = await Promise.all([byTeacher('studentCodes'), byTeacher('students')])
  const recs = new Map(students.docs.map((d) => [d.id, asStudent(d.id, d.data())]))
  const entries: RosterEntry[] = codes.docs.map((d) => {
    const code = asCode(d.id, d.data())
    return { code, student: code.usedBy ? recs.get(code.usedBy) : undefined }
  })
  return entries.sort((a, b) => a.code.name.localeCompare(b.code.name, 'ar'))
}

export async function getRosterEntry(code: string): Promise<RosterEntry | null> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'studentCodes', code))
  if (!snap.exists()) return null
  const c = asCode(code, snap.data())
  if (!c.usedBy) return { code: c }
  const rec = await fs.getDoc(fs.doc(db, 'students', c.usedBy)).catch(() => null)
  return { code: c, student: rec?.exists() ? asStudent(c.usedBy, rec.data()) : undefined }
}

export async function getNotes(code: string): Promise<string> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'studentNotes', code))
  return snap.exists() ? String(snap.data().notes ?? '') : ''
}

export async function setNotes(code: string, notes: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'studentNotes', code), { notes: notes.slice(0, 2000), updatedAt: Date.now() })
}

export async function renameStudent(entry: RosterEntry, name: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  const clean = name.trim().slice(0, 40)
  await fs.updateDoc(fs.doc(db, 'studentCodes', entry.code.code), { name: clean })
  if (entry.student) await fs.updateDoc(fs.doc(db, 'students', entry.student.uid), { name: clean })
}

/** يضيف الطالب لفصل: قبل دخوله يُحفظ في الرمز، وبعده عضوية مباشرة. */
export async function addToClass(entry: RosterEntry, classCode: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  const codeRef = fs.doc(db, 'studentCodes', entry.code.code)
  await fs.updateDoc(codeRef, { classes: fs.arrayUnion(classCode) })
  if (!entry.student) return
  await fs.setDoc(fs.doc(db, 'classes', classCode, 'members', entry.student.uid), { name: entry.student.name, joinedAt: Date.now() })
  await fs.updateDoc(fs.doc(db, 'students', entry.student.uid), { classes: fs.arrayUnion(classCode) })
}

export async function removeFromClass(entry: RosterEntry, classCode: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.updateDoc(fs.doc(db, 'studentCodes', entry.code.code), { classes: fs.arrayRemove(classCode) })
  if (!entry.student) return
  await fs.deleteDoc(fs.doc(db, 'classes', classCode, 'members', entry.student.uid)).catch(() => {})
  await fs.updateDoc(fs.doc(db, 'students', entry.student.uid), { classes: fs.arrayRemove(classCode) })
}

/** حذف الطالب من قائمة المعلم: يخرج من فصول المعلم، ويُلغى رمزه وارتباطه. */
export async function removeStudent(entry: RosterEntry, teacherClasses: string[]): Promise<void> {
  const { db, fs } = await cloudSdk()
  if (entry.student) {
    for (const c of entry.student.classes.filter((c) => teacherClasses.includes(c))) {
      await fs.deleteDoc(fs.doc(db, 'classes', c, 'members', entry.student.uid)).catch(() => {})
    }
    await fs.deleteDoc(fs.doc(db, 'students', entry.student.uid))
  }
  await fs.deleteDoc(fs.doc(db, 'studentNotes', entry.code.code)).catch(() => {})
  await fs.deleteDoc(fs.doc(db, 'studentCodes', entry.code.code))
}

// ——— الطالب ———

export async function myStudentRecord(): Promise<StudentRecord | null> {
  const { db, fs, uid } = await cloudSdk()
  const snap = await fs.getDoc(fs.doc(db, 'students', uid)).catch(() => null)
  return snap?.exists() ? asStudent(uid, snap.data()) : null
}

/** الطالب يدخل رمزه: يرتبط بمعلمه ويدخل الفصول التي اختارها المعلم. */
export async function redeemStudentCode(code: string): Promise<StudentRecord> {
  const { db, fs, uid } = await cloudSdk()
  const ref = fs.doc(db, 'studentCodes', code)
  const snap = await fs.getDoc(ref)
  if (!snap.exists()) throw Object.assign(new Error('not_found'), { code: 'student_code_not_found' })
  const c = asCode(code, snap.data())
  if (c.usedBy && c.usedBy !== uid) throw Object.assign(new Error('used'), { code: 'student_code_used' })
  if (!c.usedBy) {
    const batch = fs.writeBatch(db)
    batch.set(fs.doc(db, 'students', uid), {
      name: c.name,
      teacherUid: c.teacherUid,
      teacherName: c.teacherName,
      code,
      classes: c.classes,
      joinedAt: Date.now(),
    })
    batch.update(ref, { usedBy: uid, usedAt: Date.now() })
    await batch.commit()
  }
  // الدخول للفصول التي اختارها المعلم (وما يُضاف لاحقًا).
  const { enterClasses } = await import('./classroom')
  await enterClasses(c.classes, c.name)
  const rec = await myStudentRecord()
  if (!rec) throw new Error('link_failed')
  return rec
}
