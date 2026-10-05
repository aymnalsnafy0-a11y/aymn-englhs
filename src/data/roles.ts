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
import { cloudSdk, signOutCloud, updateDisplayName } from './cloud'
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
  /** المالك سمح لهذا المعلم باستخدام مفتاح Gemini المشترك. */
  teacherShareKey: boolean
  teacherName: string
  /** عدد فصول الطالب. */
  classes: number
  /** الطالب مرتبط بمعلم برمز الطالب. */
  linked?: boolean
  /** اسم معلم الطالب (من رمز الطالب). */
  myTeacher?: string
}

export interface TeacherInvite {
  code: string
  label: string
  createdAt: number
  /** مدة الصلاحية بالأيام من التفعيل؛ 0 = بلا انتهاء. */
  days?: number
  /** يستخدم المعلم مفتاح Gemini المشترك. */
  shareKey?: boolean
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
  shareKey: boolean
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

/** يغيّر الاسم في الحساب، وفي سجل المعلم وعضوية الفصول حتى يراه الآخرون. */
export async function setDisplayName(raw: string): Promise<void> {
  const name = raw.trim().slice(0, 40)
  await updateDisplayName(name)
  if (!name) return
  const { db, fs, uid } = await cloudSdk()
  if (state.profile?.teacher || state.profile?.teacherExpired) {
    await fs.updateDoc(fs.doc(db, 'teachers', uid), { name }).catch(() => {})
    set({ profile: state.profile ? { ...state.profile, teacherName: name } : null })
  }
  const ref = fs.doc(db, 'learners', uid, 'state', 'english-classes')
  const mine = await fs.getDoc(ref)
  if (mine.exists() && Array.isArray(mine.data().codes) && mine.data().codes.length) {
    const value = { codes: mine.data().codes as string[], name }
    await fs.setDoc(ref, value)
    const { db: local } = await import('../db/db')
    await local.meta.put({ key: 'myClasses', value })
    const { publishMemberStats } = await import('./classroom')
    await publishMemberStats()
  }
}

export async function logout(): Promise<void> {
  await signOutCloud()
  await forgetSharedKey()
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
      const [owner, teacher, classes, rec] = await Promise.all([
        safe(fs.getDoc(fs.doc(db, 'owners', uid))),
        safe(fs.getDoc(fs.doc(db, 'teachers', uid))),
        fs.getDoc(fs.doc(db, 'learners', uid, 'state', 'english-classes')),
        safe(fs.getDoc(fs.doc(db, 'students', uid))),
      ])
      const legacy = classes.exists() && Array.isArray(classes.data().codes) ? (classes.data().codes as string[]) : []
      const fromRec = rec?.exists() && Array.isArray(rec.data()?.classes) ? (rec.data()!.classes as string[]) : []
      const codes = [...new Set([...legacy, ...fromRec])]
      const expiresAt = teacher?.exists() ? millis(teacher.data()?.expiresAt) : null
      const expired = !!teacher?.exists() && expiresAt !== null && expiresAt <= Date.now()
      const profile: Profile = {
        uid,
        owner: !!owner?.exists(),
        teacher: !!teacher?.exists() && !expired,
        teacherExpired: expired,
        teacherExpiresAt: expiresAt,
        teacherShareKey: !!teacher?.exists() && teacher.data()?.shareKey === true,
        teacherName: teacher?.exists() ? String(teacher.data()?.name ?? '') : '',
        classes: codes.length,
        linked: !!rec?.exists(),
        myTeacher: rec?.exists() ? String(rec.data()?.teacherName ?? '') : undefined,
      }
      write(KEYS.profile, profile)
      set({ profile, loading: false })
      // الموارد المشتركة من المالك (المفتاح وقائمة الكلمات) في الخلفية.
      void syncShared(profile).catch((e) => console.warn('[shared]', e))
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
  const { usedBy, days = 0, shareKey = false } = invite.data() as Partial<TeacherInvite>
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
  batch.set(fs.doc(db, 'teachers', uid), { name: clean, email, invite: code, createdAt: Date.now(), expiresAt, shareKey })
  batch.update(inviteRef, { usedBy: uid, usedName: clean, usedAt: Date.now() })
  await batch.commit()
  await refreshProfile()
}

// ——— المالك ———

export async function createTeacherInvite(label: string, days: number, shareKey: boolean): Promise<string> {
  const { db, fs, uid } = await cloudSdk()
  for (let i = 0; i < 5; i++) {
    const code = generateCode(Math.random, TEACHER_CODE_LENGTH)
    const ref = fs.doc(db, 'teacherInvites', code)
    if ((await fs.getDoc(ref)).exists()) continue
    await fs.setDoc(ref, { label: label.trim().slice(0, 40), days, shareKey, createdBy: uid, createdAt: Date.now(), usedBy: null })
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
      return {
        uid: d.id,
        name: String(data.name ?? ''),
        email: data.email,
        invite: data.invite,
        createdAt: data.createdAt,
        expiresAt: millis(data.expiresAt),
        shareKey: data.shareKey === true,
      }
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

export async function setTeacherShareKey(uid: string, shareKey: boolean): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.updateDoc(fs.doc(db, 'teachers', uid), { shareKey })
}

// ——— الموارد المشتركة من المالك ———

const SHARED_KEY = 'sharedGeminiKey'

export interface SharedState {
  wordlist: { name: string; count: number; importedAt: number } | null
  key: boolean
  studentsUseKey: boolean
}

/** للمالك: ما الذي يشاركه الآن. */
export async function sharedState(): Promise<SharedState> {
  const { db, fs } = await cloudSdk()
  const [list, key, ai] = await Promise.all([
    fs.getDoc(fs.doc(db, 'config', 'wordlist')),
    fs.getDoc(fs.doc(db, 'secrets', 'gemini')),
    fs.getDoc(fs.doc(db, 'config', 'ai')),
  ])
  const l = list.exists() ? list.data() : null
  return {
    wordlist: l ? { name: String(l.name ?? ''), count: Number(l.count ?? 0), importedAt: Number(l.importedAt ?? 0) } : null,
    key: key.exists() && !!key.data().key,
    studentsUseKey: ai.exists() && ai.data().studentsUseKey === true,
  }
}

/** يرفع قائمة الكلمات المستوردة في هذا الجهاز ليستخدمها كل من يسجّل الدخول. */
export async function shareWordList(): Promise<number> {
  const { collectWordList } = await import('../db/syncData')
  const list = await collectWordList()
  if (!list) throw Object.assign(new Error('no_list'), { code: 'no_word_list' })
  const { parseWordList } = await import('../lib/csv')
  const count = parseWordList(list.text).words.length
  const { db, fs } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'config', 'wordlist'), { ...list, count })
  return count
}

export async function unshareWordList(): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'config', 'wordlist'))
}

/** يرفع مفتاح Gemini المحفوظ في هذا الجهاز ليستخدمه المسموح لهم. */
export async function shareGeminiKey(): Promise<void> {
  const { getPersonalGeminiKey } = await import('./ai')
  const key = await getPersonalGeminiKey()
  if (!key) throw Object.assign(new Error('no_key'), { code: 'no_gemini_key' })
  const { db, fs } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'secrets', 'gemini'), { key, updatedAt: Date.now() })
}

export async function unshareGeminiKey(): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.deleteDoc(fs.doc(db, 'secrets', 'gemini'))
}

export async function setStudentsUseKey(on: boolean): Promise<void> {
  const { db, fs } = await cloudSdk()
  await fs.setDoc(fs.doc(db, 'config', 'ai'), { studentsUseKey: on }, { merge: true })
}

/**
 * بعد كل دخول: نأخذ المفتاح المشترك إن كان مسموحًا لنا (وإلا نحذف نسخته من الجهاز)،
 * وقائمة الكلمات المشتركة إن لم يستورد المستخدم قائمته الخاصة.
 */
async function syncShared(profile: Profile): Promise<void> {
  const { db: local } = await import('../db/db')
  const { db, fs } = await cloudSdk()
  // المالك يستخدم مفتاحه الشخصي. غيره: القواعد تقرر (مسموح له أو مرفوض).
  const snap = profile.owner ? null : await fs.getDoc(fs.doc(db, 'secrets', 'gemini')).catch(() => null)
  const key = snap?.exists() ? String(snap.data().key ?? '') : ''
  if (key) await local.meta.put({ key: SHARED_KEY, value: key })
  else await local.meta.delete(SHARED_KEY)

  const list = await fs.getDoc(fs.doc(db, 'config', 'wordlist')).catch(() => null)
  if (!list?.exists()) return
  const shared = list.data() as { text: string; name: string; importedAt: number }
  const { collectWordList, applyWordList } = await import('../db/syncData')
  const mine = await collectWordList()
  // قائمة المستخدم الخاصة (غير المشتركة) لها الأولوية؛ المشتركة تُحدَّث إن صارت أحدث.
  const fromShared = mine?.name === shared.name
  if (!mine || (fromShared && mine.importedAt < shared.importedAt)) {
    await applyWordList({ text: shared.text, name: shared.name, importedAt: shared.importedAt })
  }
}

export async function forgetSharedKey(): Promise<void> {
  const { db: local } = await import('../db/db')
  await local.meta.delete(SHARED_KEY)
}

export async function allClasses(): Promise<ClassInfo[]> {
  const { db, fs } = await cloudSdk()
  const snap = await fs.getDocs(fs.collection(db, 'classes'))
  const { withStudentCounts } = await import('./classroom')
  return withStudentCounts(
    snap.docs.map((d) => ({ code: d.id, ...(d.data() as Omit<ClassInfo, 'code'>) })).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  )
}
