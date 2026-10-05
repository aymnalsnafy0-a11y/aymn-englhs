/**
 * شاشات الدخول: الترحيب واختيار الدور، تسجيل الدخول، تفعيل المعلم برمز، ودخول الطالب لفصله.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AccountCard } from '../../components/AccountCard'
import { Icon, type IconName } from '../../components/TabBar'
import { Button } from '../../components/ui'
import { openAccount, useCloudStatus } from '../../data/cloud'
import { joinClass } from '../../data/classroom'
import { chooseRole, logout, redeemTeacherCode, refreshProfile, type Role } from '../../data/roles'
import { normalizeCode, TEACHER_CODE_LENGTH } from '../../lib/classroom'
import { cloudErrorText } from '../../lib/useAsync'

const input =
  'w-full min-w-0 rounded-xl bg-white px-4 py-3 text-lg ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

function Logo({ size = 'size-20' }: { size?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex ${size} items-center justify-center rounded-[28%] bg-white/15 ring-1 ring-white/25`}>
      <span className="font-en text-[2.6em] leading-none">S</span>
      <span className="absolute end-[18%] top-[16%] size-[14%] rounded-full bg-amber-400" />
    </span>
  )
}

/** إطار شاشات الدخول: رأس ملوّن بالشعار ثم بطاقة المحتوى. */
function EntryLayout({ title, subtitle, onBack, children }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-teal-700 via-teal-800 to-teal-950 text-white">
      <header className="relative mx-auto flex w-full max-w-md flex-col items-center px-6 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="رجوع"
            className="absolute start-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full p-2 text-2xl text-white/80 hover:bg-white/10"
          >
            →
          </button>
        )}
        <Logo />
        <h1 className="mt-4 text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xs text-teal-100">{subtitle}</p>}
      </header>
      <main className="flex-1 rounded-t-[2rem] bg-slate-50 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}

function RoleTile({ icon, title, detail, onClick }: { icon: IconName; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 transition hover:ring-2 hover:ring-teal-600 active:scale-[0.99] dark:bg-slate-900 dark:ring-slate-800"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
        <Icon name={icon} className="size-8" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-slate-500">{detail}</span>
      </span>
      <span aria-hidden="true" className="text-xl text-slate-400">
        ←
      </span>
    </button>
  )
}

export function Splash({ text = 'جارٍ التحميل…' }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gradient-to-b from-teal-700 to-teal-950 text-white">
      <Logo />
      <p className="text-2xl font-bold">سياق</p>
      <p aria-live="polite" className="text-sm text-teal-100">
        {text}
      </p>
    </div>
  )
}

export function Welcome() {
  return (
    <EntryLayout title="سياق" subtitle="تعلّم أهم 5000 كلمة إنجليزية بالسياق — خطوة بخطوة، كل يوم.">
      <h2 className="mb-4 text-center text-lg font-bold">كيف ستدخل؟</h2>
      <div className="grid gap-3">
        <RoleTile icon="class" title="أنا طالب" detail="أتعلّم وأحلّ واجبات معلمي — تحتاج رمز الفصل من معلمك" onClick={() => chooseRole('student')} />
        <RoleTile icon="board" title="أنا معلم" detail="أنشئ فصولًا وواجبات وأتابع طلابي — تحتاج رمز المعلم" onClick={() => chooseRole('teacher')} />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">لديك حساب من قبل؟ اختر دورك ثم سجّل الدخول.</p>
    </EntryLayout>
  )
}

export function SignIn({ role }: { role: Role }) {
  // نجهّز تسجيل الدخول مبكرًا حتى تفتح نافذة Google فورًا.
  useEffect(() => {
    void openAccount().catch(() => {})
  }, [])
  return (
    <EntryLayout
      title={role === 'teacher' ? 'دخول المعلم' : 'دخول الطالب'}
      subtitle={role === 'teacher' ? 'سجّل الدخول ثم فعّل حسابك برمز المعلم.' : 'سجّل الدخول ثم أدخل رمز الفصل من معلمك.'}
      onBack={() => chooseRole(null)}
    >
      <AccountCard intro="بحساب Google أسرع. أو بالإيميل وكلمة مرور — أول مرة اضغط «حساب جديد»." />
    </EntryLayout>
  )
}

/** حساب مسجّل اختار «معلم» ولم يُفعَّل بعد: يدخل رمز المعلم من المالك. */
export function TeacherCode() {
  const cloud = useCloudStatus()
  const [code, setCode] = useState('')
  const [name, setName] = useState(cloud.name ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = normalizeCode(code, TEACHER_CODE_LENGTH)
    if (!c) return setMsg('رمز المعلم 8 خانات، مثل ABCD-2345.')
    setBusy(true)
    setMsg(null)
    try {
      await redeemTeacherCode(c, name)
    } catch (err) {
      setMsg(cloudErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <EntryLayout title="تفعيل حساب المعلم" subtitle="أدخل الرمز الذي أعطاك إياه مالك الموقع. يُستخدم مرة واحدة." onBack={() => chooseRole('student')}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">رمز المعلم</span>
          <input
            className={`${input} font-en text-center tracking-[0.3em]`}
            dir="ltr"
            placeholder="ABCD-2345"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">اسمك كما يراه طلابك</span>
          <input className={input} placeholder="مثل: أ. أيمن" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <Button type="submit" className="mt-1 min-h-12 text-lg" disabled={busy || !code.trim() || !name.trim()}>
          {busy ? 'جارٍ التفعيل…' : 'فعّل حسابي'}
        </Button>
        {msg && (
          <p aria-live="polite" className="text-center text-sm text-rose-700 dark:text-rose-400">
            {msg}
          </p>
        )}
      </form>
      <OwnerSetup />
      <SignedInAs />
    </EntryLayout>
  )
}

/** إعداد المالك لأول مرة: يُضاف الحساب يدويًا في Firebase (لا يمكن ذلك من الموقع لأسباب أمنية). */
function OwnerSetup() {
  const cloud = useCloudStatus()
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  return (
    <details className="mt-6 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <summary className="cursor-pointer font-semibold">أنا مالك الموقع</summary>
      <ol className="mt-3 list-decimal space-y-1 ps-5 text-slate-600 dark:text-slate-400">
        <li>
          انسخ معرّف حسابك:{' '}
          <code dir="ltr" className="rounded bg-slate-100 px-1 text-xs break-all dark:bg-slate-800">
            {cloud.uid}
          </code>{' '}
          <button
            type="button"
            className="text-teal-700 underline dark:text-teal-400"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(cloud.uid ?? '')
                setCopied(true)
              } catch {
                /* النسخ غير متاح */
              }
            }}
          >
            {copied ? '✓ نُسخ' : 'نسخ'}
          </button>
        </li>
        <li>
          في Firebase: Firestore Database ← Data ← Start collection ← اسمها <code dir="ltr">owners</code>
        </li>
        <li>Document ID: الصق المعرّف ← أضف حقلًا role = owner ← Save</li>
      </ol>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        disabled={checking}
        onClick={async () => {
          setChecking(true)
          await refreshProfile()
          setChecking(false)
        }}
      >
        {checking ? 'جارٍ التحقق…' : 'تحقّق مرة أخرى'}
      </Button>
    </details>
  )
}

/** طالب جديد بلا فصل: يدخل رمز الفصل من معلمه. */
export function JoinFirstClass() {
  const cloud = useCloudStatus()
  const [code, setCode] = useState('')
  const [name, setName] = useState(cloud.name ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = normalizeCode(code)
    if (!c) return setMsg('رمز الفصل 6 خانات، مثل ABC-234.')
    setBusy(true)
    setMsg(null)
    try {
      await joinClass(c, name)
      await refreshProfile()
    } catch (err) {
      setMsg(cloudErrorText(err))
      setBusy(false)
    }
  }

  return (
    <EntryLayout title="انضم لفصلك" subtitle="أدخل رمز الفصل الذي أعطاك إياه معلمك." onBack={() => chooseRole(null)}>
      <form onSubmit={submit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">رمز الفصل</span>
          <input
            className={`${input} font-en text-center tracking-[0.3em]`}
            dir="ltr"
            placeholder="ABC-234"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">اسمك كما يراه المعلم</span>
          <input className={input} placeholder="الاسم الكامل" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </label>
        <Button type="submit" className="mt-1 min-h-12 text-lg" disabled={busy || !code.trim() || !name.trim()}>
          {busy ? 'جارٍ الانضمام…' : 'ادخل الفصل'}
        </Button>
        {msg && (
          <p aria-live="polite" className="text-center text-sm text-rose-700 dark:text-rose-400">
            {msg}
          </p>
        )}
      </form>
      <button type="button" onClick={() => chooseRole('teacher')} className="mt-6 block w-full text-center text-sm text-teal-700 underline dark:text-teal-400">
        أنا معلم وعندي رمز معلم
      </button>
      <SignedInAs />
    </EntryLayout>
  )
}

function SignedInAs() {
  const cloud = useCloudStatus()
  return (
    <p className="mt-8 text-center text-sm text-slate-500">
      مسجّل باسم <span dir="ltr">{cloud.email}</span> ·{' '}
      <button type="button" className="text-teal-700 underline dark:text-teal-400" onClick={() => void logout()}>
        تسجيل الخروج
      </button>
    </p>
  )
}

/** تعذّر معرفة نوع الحساب (مثل انقطاع الإنترنت في أول دخول). */
export function ProfileError({ error }: { error: unknown }) {
  return (
    <EntryLayout title="تعذّر فتح حسابك">
      <p className="mb-4 text-center text-slate-600 dark:text-slate-400">{cloudErrorText(error)}</p>
      <Button className="w-full" onClick={() => void refreshProfile()}>
        حاول مرة أخرى
      </Button>
      <SignedInAs />
    </EntryLayout>
  )
}
