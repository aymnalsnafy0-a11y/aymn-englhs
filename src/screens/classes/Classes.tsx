import { useState } from 'react'
import { Button, Card, Screen } from '../../components/ui'
import { useCloudStatus } from '../../data/cloud'
import { createClass, joinClass, leaveClass, myStudentClasses, myTeacherClasses } from '../../data/classroom'
import { formatCode, normalizeCode } from '../../lib/classroom'
import { cloudErrorText, useAsync } from '../../lib/useAsync'

const input =
  'min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

/** الفصول: كطالب (الانضمام والواجبات) وكمدرس (فصولي وإنشاء فصل). */
export function Classes({
  onBack,
  openSettings,
  openClass,
  openStudentClass,
}: {
  onBack: () => void
  openSettings: () => void
  openClass: (code: string) => void
  openStudentClass: (code: string) => void
}) {
  const cloud = useCloudStatus()
  if (cloud.state !== 'signedIn') {
    return (
      <Screen title="الفصول" onBack={onBack}>
        <Card className="text-center">
          <p className="text-4xl" aria-hidden="true">🏫</p>
          <p className="mt-2 font-semibold">الفصول تحتاج حسابًا</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">سجّل الدخول من الإعدادات لتنضم لفصل أو تنشئ فصلًا لطلابك.</p>
          <Button className="mt-4" onClick={openSettings}>
            افتح الإعدادات
          </Button>
        </Card>
      </Screen>
    )
  }
  return (
    <Screen title="الفصول" onBack={onBack}>
      <StudentSection openStudentClass={openStudentClass} />
      <TeacherSection email={cloud.email ?? ''} openClass={openClass} />
    </Screen>
  )
}

function StudentSection({ openStudentClass }: { openStudentClass: (code: string) => void }) {
  const mine = useAsync(myStudentClasses, [])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const savedName = mine.data?.name ?? ''

  async function join(e: React.FormEvent) {
    e.preventDefault()
    const c = normalizeCode(code)
    if (!c) return setMsg('الرمز 6 خانات، مثل ABC-234.')
    setBusy(true)
    setMsg(null)
    try {
      const info = await joinClass(c, name.trim() || savedName)
      setCode('')
      setMsg(`✓ انضممت إلى «${info.name}».`)
      mine.reload()
    } catch (err) {
      setMsg(cloudErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="text-lg font-bold">فصولي كطالب</h2>
      {mine.loading ? (
        <p className="mt-2 text-sm text-slate-500">جارٍ التحميل…</p>
      ) : mine.error ? (
        <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{cloudErrorText(mine.error)}</p>
      ) : mine.data!.classes.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">لم تنضم لأي فصل بعد.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {mine.data!.classes.map((c) => (
            <li key={c.code} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => openStudentClass(c.code)}>
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-slate-500">المدرس: {c.teacherName || '—'}</span>
              </button>
              <Button onClick={() => openStudentClass(c.code)}>الواجبات</Button>
              <Button
                variant="ghost"
                className="text-sm"
                onClick={async () => {
                  await leaveClass(c.code)
                  mine.reload()
                }}
              >
                مغادرة
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={join} className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
        <h3 className="mb-2 font-semibold">انضم لفصل</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className={`${input} font-en tracking-widest`}
            dir="ltr"
            aria-label="رمز الفصل"
            placeholder="ABC-234"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
          />
          <input
            className={input}
            aria-label="اسمك كما يراه المدرس"
            placeholder={savedName || 'اسمك كما يراه المدرس'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
          <Button type="submit" disabled={busy || !code.trim() || !(name.trim() || savedName)}>
            انضم
          </Button>
        </div>
        {msg && (
          <p aria-live="polite" className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {msg}
          </p>
        )}
      </form>
    </Card>
  )
}

function TeacherSection({ email, openClass }: { email: string; openClass: (code: string) => void }) {
  const classes = useAsync(myTeacherClasses, [])
  const [name, setName] = useState('')
  const [teacherName, setTeacherName] = useState(email.split('@')[0])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const c = await createClass(name, teacherName)
      setName('')
      openClass(c.code)
    } catch (err) {
      setMsg(cloudErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-bold">فصولي كمدرس</h2>
      {classes.loading ? (
        <p className="mt-2 text-sm text-slate-500">جارٍ التحميل…</p>
      ) : classes.error ? (
        <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{cloudErrorText(classes.error)}</p>
      ) : classes.data!.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">أنشئ فصلًا، وأعطِ طلابك رمزه لينضموا.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {classes.data!.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => openClass(c.code)}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-start hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                <span className="font-semibold">{c.name}</span>
                <span dir="ltr" className="font-en tracking-widest text-slate-500">
                  {formatCode(c.code)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={create} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800">
        <input className={input} aria-label="اسم الفصل" placeholder="اسم الفصل (مثل: مجموعة الأحد)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <input className={input} aria-label="اسمك كمدرس" placeholder="اسمك كمدرس" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} maxLength={40} />
        <Button type="submit" disabled={busy || !name.trim()}>
          أنشئ فصلًا
        </Button>
      </form>
      {msg && <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{msg}</p>}
    </Card>
  )
}
