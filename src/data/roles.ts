/**
 * أدوار الحسابات (القواعد في firestore.rules):
 * - المالك: owners/{uid} — يُضاف يدويًا من لوحة Firebase، ولا يكتبه أحد من الموقع.
 * - المعلم: teachers/{uid} — يُنشأ برمز معلم من المالك (teacherInvites/{code})، والرمز يُستخدم مرة واحدة.
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
  teacher: boolean
  teacherName: string
  /** عدد فصول الطالب. */
  classes: number
}

export interface TeacherInvite {
  code: string
  label: string
  createdAt: number
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
}

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
      const profile: Profile = {
        uid,
        owner: !!owner?.exists(),
        teacher: !!teacher?.exists(),
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
  if (invite.data().usedBy) throw Object.assign(new Error('used'), { code: 'teacher_code_used' })
  const clean = name.trim().slice(0, 40)
  const batch = fs.writeBatch(db)
  batch.set(fs.doc(db, 'teachers', uid), { name: clean, email, invite: code, createdAt: Date.now() })
  batch.update(inviteRef, { usedBy: uid, usedName: clean, usedAt: Date.now() })
  await batch.commit()
  await refreshProfile()
}

// ——— المالك ———

export async function createTeacherInvite(label: string): Promise<string> {
  const { db, fs, uid } = await cloudSdk()
  for (let i = 0; i < 5; i++) {
    const code = generateCode(Math.random, TEACHER_CODE_LENGTH)
    const ref = fs.doc(db, 'teacherInvites', code)
    if ((await fs.getDoc(ref)).exists()) continue
    await fs.setDoc(ref, { label: label.trim().slice(0, 40), createdBy: uid, createdAt: Date.now(), usedBy: null })
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
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Teacher, 'uid'>) })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

/** سحب صلاحية المعلم: لا يستطيع إنشاء فصول أو إدارة فصوله بعدها (تبقى بياناتها). */
export async function revokeTeacher(uid: string): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'teachers', uid))
}

export async function allClasses(): Promise<ClassInfo[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes'))
  return snap.docs
    .map((d) => ({ code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}
