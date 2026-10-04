import { useState } from 'react'
import { openAccount, resetPassword, signIn, signInWithGoogle, signOutCloud, syncNow, useCloudStatus } from '../data/cloud'
import { Button } from './ui'

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'الآن'
  const m = Math.round(s / 60)
  if (m < 60) return `قبل ${m} دقيقة`
  return new Date(ts).toLocaleString('ar', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })
}

/** الحساب والمزامنة بين الأجهزة. */
export function AccountCard() {
  const cloud = useCloudStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (cloud.state === 'signedIn') {
    return (
      <div>
        <p className="text-sm">
          مسجّل باسم <span dir="ltr" className="font-semibold">{cloud.email}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500" aria-live="polite">
          {cloud.syncing ? 'جارٍ المزامنة…' : cloud.lastSync ? `آخر مزامنة: ${timeAgo(cloud.lastSync)}` : 'لم تتم المزامنة بعد'}
        </p>
        {cloud.error && <p className="mt-1 text-sm text-rose-700 dark:text-rose-400">{cloud.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={cloud.syncing} onClick={() => void syncNow()}>
            زامن الآن
          </Button>
          <Button variant="ghost" onClick={() => void signOutCloud()}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    )
  }

  async function submit(create: boolean) {
    setBusy(true)
    setMsg(null)
    const error = await signIn(email, password, create)
    setBusy(false)
    if (error) setMsg(error)
    else setPassword('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit(false)
      }}
      onFocus={() => void openAccount().catch(() => {})}
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        سجّل الدخول ليُحفظ تقدّمك وقائمتك في حسابك وتنتقل بين الجوال والكمبيوتر. أول مرة: اضغط «حساب جديد».
      </p>
      <Button
        variant="secondary"
        className="mb-3 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setMsg(await signInWithGoogle())
          setBusy(false)
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
          <path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.3Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.9Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10C6.6 7.4 9.1 5.4 12 5.4Z" />
        </svg>
        الدخول بحساب Google
      </Button>
      <p className="mb-2 text-center text-xs text-slate-500">أو بالإيميل</p>
      <div className="grid gap-2">
        <input
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          aria-label="الإيميل"
          placeholder="الإيميل"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700"
        />
        <input
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          minLength={6}
          aria-label="كلمة المرور"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !email || password.length < 6}>
          دخول
        </Button>
        <Button variant="secondary" disabled={busy || !email || password.length < 6} onClick={() => void submit(true)}>
          حساب جديد
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            if (!email) return setMsg('اكتب إيميلك أولًا لاستعادة كلمة المرور.')
            setMsg(await resetPassword(email))
          }}
        >
          نسيت كلمة المرور
        </Button>
      </div>
      {(msg || cloud.error || cloud.state === 'loading') && (
        <p aria-live="polite" className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {cloud.state === 'loading' && !msg ? 'جارٍ تجهيز تسجيل الدخول…' : (msg ?? cloud.error)}
        </p>
      )}
    </form>
  )
}
