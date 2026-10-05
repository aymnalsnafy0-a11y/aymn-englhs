/**
 * أدوار الحسابات (القواعد في firestore.rules):
 * - المالك: owners/{uid} — يُضاف يدويًا من لوحة Firebase، ولا يكتبه أحد من الموقع.
 * - المعلم: teachers/{uid} — يُنشأ برمز معلم من المالك (teacherInvites/{code}). الرمز لشخص واحد،
 *   والمالك يحدد مدة الصلاحية (days، و0 = بلا انتهاء) ويمكنه تمديدها.
 * - الطالب: أي حساب آخر، يدخل فصلًا برمز الفصل من معلمه.
 * الملف الشخصي يُحفظ في الجهاز أيضًا ليفتح التطبيق فورًا وبدون إنترنت.
 */
import { useSyncExternalStore } from 'react'
import { generateCode, TEACHER_CODE_LENGTH } from '../lib/classroom'
import { cloudSdk, signOutCloud } from './cloud'
import type { ClassInfo } from './classroom'

export type Role = 'student' | 'teacher'

export interface Profile {
  uid: string
  owner: boolean
  /** معلم فعّال (لم تنتهِ مدته). */
  teacher: boolean
  /** كان معلمًا وانتهت مدته. */
  teacherExpired: boolean
  /** نهاية صلاحية المعلم (ms)، أو null = بلا انتهاء. */
  teacherExpiresAt: number | null
  teacherName: string
  /** عدد فصول الطالب. */
  classes: number
}

export interface TeacherInvite {
  code: string
  label: string
  createdAt: number
  /** مدة الصلاحية بالأيام من التفعيل؛ 0 = بلا انتهاء. */
  days?: number
  usedBy: string | null
  usedName?: string
  usedAt?: number
}

export interface Teacher {
  uid: string
  name: string
  email?: string
  invite?: string
  createdAt?: number
  /** ms، أو null = بلا انتهاء. */
  expiresAt: number | null
}

/** خيارات مدة صلاحية المعلم (بالأيام). */
export const DURATIONS = [
  { days: 30, label: 'شهر' },
  { days: 60, label: 'شهرين' },
  { days: 90, label: '3 أشهر' },
  { days: 180, label: '6 أشهر' },
  { days: 365, label: 'سنة' },
  { days: 0, label: 'بلا انتهاء' },
]

export function durationLabel(days: number | undefined): string {
  return DURATIONS.find((d) => d.days === (days ?? 0))?.label ?? `${days} يوم`
}

const millis = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null

// ——— ما يُحفظ في الجهاز ———

const KEYS = { profile: 'siyaq-profile', role: 'siyaq-role', mode: 'siyaq-mode' }

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* التخزين المحلي غير متاح */
  }
}

export interface ProfileState {
  profile: Profile | null
  loading: boolean
  error?: unknown
  /** اختيار الشاشة الأولى: طالب أو معلم. */
  role: Role | null
  /** للمعلم والمالك: لوحة التدريس أو التعلّم الشخصي. */
  mode: 'teach' | 'learn'
}

let state: ProfileState = {
  profile: read<Profile>(KEYS.profile),
  loading: false,
  role: read<Role>(KEYS.role),
  mode: read<'teach' | 'learn'>(KEYS.mode) ?? 'teach',
}
const listeners = new Set<() => void>()
function set(patch: Partial<ProfileState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function useProfile(): ProfileState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function chooseRole(role: Role | null) {
  write(KEYS.role, role)
  set({ role })
}

export function setMode(mode: 'teach' | 'learn') {
  write(KEYS.mode, mode)
  set({ mode })
}

/** عند تسجيل الخروج: ننسى الدور والملف حتى تظهر شاشة الترحيب. */
export function forgetProfile() {
  write(KEYS.profile, null)
  write(KEYS.role, null)
  write(KEYS.mode, null)
  set({ profile: null, role: null, mode: 'teach', error: undefined })
}

export async function logout(): Promise<void> {
  await signOutCloud()
  forgetProfile()
}

const denied = (e: unknown) => (e as { code?: string })?.code === 'permission-denied'

let loading: Promise<Profile | null> | null = null

/** يقرأ دور الحساب من Firestore. أي خطأ يُبقي النسخة المحفوظة في الجهاز. */
export function refreshProfile(): Promise<Profile | null> {
  if (loading) return loading
  set({ loading: true, error: undefined })
  loading = (async () => {
    try {
      const { db, fs, uid } = await cloudSdk()
      // المستند غير الموجود أو قواعد قديمة لا تعرف الأدوار = ليس مالكًا/معلمًا.
      const safe = (p: Promise<import('firebase/firestore').DocumentSnapshot>) =>
        p.catch((e) => {
          if (denied(e)) return null
          throw e
        })
      const [owner, teacher, classes] = await Promise.all([
        safe(fs.getDoc(fs.doc(db, 'owners', uid))),
        safe(fs.getDoc(fs.doc(db, 'teachers', uid))),
        fs.getDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes')),
      ])
      const codes = classes.exists() ? (classes.data().codes as unknown) : []
      const expiresAt = teacher?.exists() ? millis(teacher.data()?.expiresAt) : null
      const expired = !!teacher?.exists() && expiresAt !== null && expiresAt <= Date.now()
      const profile: Profile = {
        uid,
        owner: !!owner?.exists(),
        teacher: !!teacher?.exists() && !expired,
        teacherExpired: expired,
        teacherExpiresAt: expiresAt,
        teacherName: teacher?.exists() ? String(teacher.data()?.name ?? '') : '',
        classes: Array.isArray(codes) ? codes.length : 0,
      }
      write(KEYS.profile, profile)
      set({ profile, loading: false })
      return profile
    } catch (e) {
      set({ loading: false, error: e })
      return null
    } finally {
      loading = null
    }
  })()
  return loading
}

// ——— المعلم: تفعيل الحساب برمز ———

export async function redeemTeacherCode(code: string, name: string): Promise<void> {
  const { db, fs, uid, email } = await cloudSdk()
  const inviteRef = fs.doc(db, 'teacherInvites', code)
  const invite = await fs.getDoc(inviteRef)
  if (!invite.exists()) throw Object.assign(new Error('not_found'), { code: 'teacher_code_not_found' })
  const { usedBy, days = 0 } = invite.data() as Partial<TeacherInvite>
  // الرمز لشخص واحد: صاحبه يستطيع إدخاله مرة أخرى (جهاز جديد مثلًا)، وغيره لا.
  if (usedBy === uid) {
    const p = await refreshProfile()
    if (p?.teacherExpired) throw Object.assign(new Error('expired'), { code: 'teacher_code_expired' })
    return
  }
  if (usedBy) throw Object.assign(new Error('used'), { code: 'teacher_code_used' })
  const clean = name.trim().slice(0, 40)
  const expiresAt = days > 0 ? fs.Timestamp.fromMillis(Date.now() + days * 864e5) : null
  const batch = fs.writeBatch(db)
  batch.set(fs.doc(db, 'teachers', uid), { name: clean, email, invite: code, createdAt: Date.now(), expiresAt })
  batch.update(inviteRef, { usedBy: uid, usedName: clean, usedAt: Date.now() })
  await batch.commit()
  await refreshProfile()
}

// ——— المالك ———

export async function createTeacherInvite(label: string, days: number): Promise<string> {
  const { db, fs, uid } = await cloudSdk()
  for (let i = 0; i < 5; i++) {
    const code = generateCode(Math.random, TEACHER_CODE_LENGTH)
    const ref = fs.doc(db, 'teacherInvites', code)
    if ((await fs.getDoc(ref)).exists()) continue
    await fs.setDoc(ref, { label: label.trim().slice(0, 40), days, createdBy: uid, createdAt: Date.now(), usedBy: null })
    return code
  }
  throw new Error('code_collision')
}

export async function listTeacherInvites(): Promise<TeacherInvite[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'teacherInvites'))
  return snap.docs
    .map((d) => ({ code: d.id, ...(d.data() as Omit<TeacherInvite, 'code'>) }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteTeacherInvite(code: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'teacherInvites', code))
}

export async function listTeachers(): Promise<Teacher[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'teachers'))
  return snap.docs
    .map((d) => {
      const data = d.data()
      return { uid: d.id, name: String(data.name ?? ''), email: data.email, invite: data.invite, createdAt: data.createdAt, expiresAt: millis(data.expiresAt) }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

/** تمديد صلاحية معلم: تُضاف المدة من اليوم أو من نهاية مدته الحالية (أيهما أبعد). 0 = بلا انتهاء. */
export async function extendTeacher(t: Teacher, days: number): Promise<void> {
  const { db, fs } = await cloudSdk()
  const from = Math.max(Date.now(), t.expiresAt ?? 0)
  await fs.updateDoc(fs.doc(db, 'teachers', t.uid), { expiresAt: days > 0 ? fs.Timestamp.fromMillis(from + days * 864e5) : null })
}

/** سحب صلاحية المعلم: لا يستطيع إنشاء فصول أو إدارة فصوله بعدها (تبقى بياناتها). */
export async function revokeTeacher(uid: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'teachers', uid))
}

export async function allClasses(): Promise<ClassInfo[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes'))
  const { withStudentCounts } = await import('./classroom')
  return withStudentCounts(
    snap.docs.map((d) => ({ code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  )
}
