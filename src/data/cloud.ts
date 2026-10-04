/**
 * الحساب والمزامنة عبر Firebase (مشروع الإنجليزي الخاص).
 * - مكتبة Firebase تُحمَّل فقط عند استخدام الحساب.
 * - البيانات في learners/{uid}/state/english*.
 * - كل مستند يُدمج داخل معاملة (transaction): نقرأ نسخة الحساب، ندمجها مع الجهاز، نكتب النتيجة للطرفين.
 */
import { useSyncExternalStore } from 'react'
import {
  mergeCore,
  mergeProgress,
  mergeStories,
  packProgress,
  unpackProgress,
  type CoreData,
  type SyncStory,
} from '../lib/sync'
import { DOCS, FIREBASE_CONFIG } from './firebaseConfig'

export interface CloudStatus {
  state: 'off' | 'loading' | 'signedOut' | 'signedIn'
  email?: string
  syncing?: boolean
  lastSync?: number
  error?: string
}

let status: CloudStatus = { state: 'off' }
const listeners = new Set<() => void>()
function set(patch: Partial<CloudStatus>) {
  status = { ...status, ...patch }
  for (const l of listeners) l()
}

export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

const FLAG = 'siyaq-cloud'
const flag = {
  get: () => {
    try {
      return localStorage.getItem(FLAG) === '1'
    } catch {
      return false
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(FLAG, '1')
      else localStorage.removeItem(FLAG)
    } catch {
      /* التخزين المحلي غير متاح */
    }
  },
}

type Sdk = {
  auth: import('firebase/auth').Auth
  db: import('firebase/firestore').Firestore
  au: typeof import('firebase/auth')
  fs: typeof import('firebase/firestore')
}
let sdk: Sdk | null = null
let initPromise: Promise<Sdk> | null = null

function init(): Promise<Sdk> {
  if (initPromise) return initPromise
  set({ state: 'loading', error: undefined })
  initPromise = (async () => {
    const [{ initializeApp, getApps, getApp }, au, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ])
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)
    const auth = au.getAuth(app)
    auth.languageCode = 'ar'
    await au.setPersistence(auth, au.browserLocalPersistence)
    sdk = { auth, db: fs.getFirestore(app), au, fs }
    au.onAuthStateChanged(auth, (user) => {
      if (user) {
        flag.set(true)
        set({ state: 'signedIn', email: user.email ?? undefined })
        void syncNow()
      } else {
        set({ state: 'signedOut', email: undefined })
      }
    })
    return sdk
  })().catch((e) => {
    initPromise = null
    set({ state: 'off', error: 'تعذّر تحميل تسجيل الدخول. تأكد من الإنترنت.' })
    throw e
  })
  return initPromise
}

/** عند فتح التطبيق: نتصل فقط إذا سبق تسجيل الدخول على هذا الجهاز. */
export function startCloud(): void {
  if (flag.get()) void init().catch(() => {})
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && status.state === 'signedIn') void syncNow()
  })
}

export async function openAccount(): Promise<void> {
  await init()
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'الإيميل أو كلمة المرور غير صحيحة.',
  'auth/wrong-password': 'الإيميل أو كلمة المرور غير صحيحة.',
  'auth/user-not-found': 'الإيميل أو كلمة المرور غير صحيحة.',
  'auth/email-already-in-use': 'هذا الإيميل مسجّل مسبقًا — اختر «دخول».',
  'auth/weak-password': 'كلمة المرور قصيرة: 6 أحرف على الأقل.',
  'auth/invalid-email': 'اكتب إيميلًا صحيحًا.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم حاول.',
  'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت.',
  'auth/configuration-not-found': 'تسجيل الدخول غير مفعّل بعد في Firebase (Authentication ← Get started ← Email/Password).',
  'auth/operation-not-allowed': 'تسجيل الدخول بالإيميل غير مفعّل في Firebase (Authentication ← Sign-in method).',
  'auth/unauthorized-domain': 'هذا الموقع غير مضاف في Firebase (Authentication ← Settings ← Authorized domains).',
}

function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  return AUTH_ERRORS[code] ?? 'حدث خطأ في الحساب. حاول مرة أخرى.'
}

export async function signIn(email: string, password: string, create: boolean): Promise<string | null> {
  try {
    const { auth, au } = await init()
    if (create) await au.createUserWithEmailAndPassword(auth, email.trim(), password)
    else await au.signInWithEmailAndPassword(auth, email.trim(), password)
    return null
  } catch (e) {
    return authError(e)
  }
}

export async function resetPassword(email: string): Promise<string> {
  try {
    const { auth, au } = await init()
    await au.sendPasswordResetEmail(auth, email.trim())
    return 'إذا كان الإيميل مسجّلًا تصلك رسالة لتعيين كلمة مرور جديدة (راجع البريد غير المرغوب).'
  } catch (e) {
    return authError(e)
  }
}

export async function signOutCloud(): Promise<void> {
  if (!sdk) return
  await syncNow()
  await sdk.au.signOut(sdk.auth)
  flag.set(false)
}

// ——— المزامنة ———

let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

/** بعد كل تغيير مهم: مزامنة بعد ثوانٍ (تُجمع التغييرات المتتالية في طلب واحد). */
export function scheduleSync(): void {
  if (status.state !== 'signedIn') return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), 4000)
}

export function syncNow(): Promise<void> {
  if (!sdk || !sdk.auth.currentUser) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    set({ syncing: true, error: undefined })
    try {
      do {
        again = false
        await syncAll(sdk!)
      } while (again)
      set({ lastSync: Date.now() })
    } catch (e) {
      const code = (e as { code?: string })?.code
      set({
        error:
          code === 'permission-denied'
            ? 'Firebase رفض الحفظ: تأكد من قواعد Firestore (learners/{uid}/state/{doc}).'
            : 'تعذّرت المزامنة الآن. ستُعاد تلقائيًا.',
      })
      console.error('[sync]', e)
    } finally {
      set({ syncing: false })
      running = null
    }
  })()
  return running
}

async function syncAll({ auth, db: fdb, fs }: Sdk): Promise<void> {
  const local = await import('../db/syncData')
  const uid = auth.currentUser!.uid
  const ref = (name: string) => fs.doc(fdb, 'learners', uid, 'state', name)
  const parse = <T,>(snap: import('firebase/firestore').DocumentSnapshot, fallback: T): T => {
    if (!snap.exists()) return fallback
    try {
      return JSON.parse(snap.data().payload as string) as T
    } catch {
      return fallback
    }
  }
  const write = (payload: unknown) => ({ v: 1, payload: JSON.stringify(payload), updatedAt: fs.serverTimestamp() })

  // 1) قائمة الكلمات أولًا: جهاز جديد يحصل على القائمة الكاملة قبل الدمج.
  const listRef = ref(DOCS.wordlist)
  const remoteList = parse<import('../db/syncData').WordListDoc | null>(await fs.getDoc(listRef), null)
  const localList = await local.collectWordList()
  if (localList && (!remoteList || localList.importedAt > remoteList.importedAt)) {
    await fs.setDoc(listRef, write(localList))
  } else if (remoteList && (!localList || remoteList.importedAt > localList.importedAt)) {
    await local.applyWordList(remoteList)
  }

  // 2) الإعدادات والخطط والأخطاء والاختبارات والنشاط والمحفوظات.
  const coreLocal = await local.collectCore()
  const core = await fs.runTransaction(fdb, async (tx) => {
    const remote = parse<CoreData>(await tx.get(ref(DOCS.core)), { plans: [], mistakes: [], quizzes: [], activity: [], saved: [] })
    const merged = mergeCore(coreLocal, remote)
    tx.set(ref(DOCS.core), write(merged))
    return merged
  })
  await local.applyCore(core)

  // 3) تقدّم الكلمات (مضغوط).
  const progLocal = await local.collectProgress()
  const progress = await fs.runTransaction(fdb, async (tx) => {
    const remote = unpackProgress(parse(await tx.get(ref(DOCS.progress)), []))
    const merged = mergeProgress(progLocal, remote)
    tx.set(ref(DOCS.progress), write(packProgress(merged)))
    return merged
  })
  await local.applyProgress(progress)

  // 4) القصص.
  const storiesLocal = await local.collectStories()
  const stories = await fs.runTransaction(fdb, async (tx) => {
    const remote = parse<SyncStory[]>(await tx.get(ref(DOCS.stories)), [])
    const merged = mergeStories(storiesLocal, remote)
    tx.set(ref(DOCS.stories), write(merged))
    return merged
  })
  await local.applyStories(stories)
}
