import { useState } from 'react'
import { Button, Card, Screen } from '../../components/ui'
import { useCloudStatus } from '../../data/cloud'
import { classesOf, myTeacherClasses, type ClassInfo } from '../../data/classroom'
import { allClasses, listTeachers, useProfile } from '../../data/roles'
import { createStudentCode, roster, type RosterEntry } from '../../data/roster'
import { formatCode } from '../../lib/classroom'
import { cloudErrorText, useAsync } from '../../lib/useAsync'
import { ShareText } from './Teachers'

const field =
  'w-full min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

export function studentInvite(code: string, name: string, teacher: string) {
  return `مرحبًا ${name}، هذا رمز دخولك لموقع سنافي AE لتعلّم الإنجليزية مع ${teacher}:\n${location.origin}${import.meta.env.BASE_URL}\nاختر «أنا طالب» ← سجّل الدخول ← رمز الطالب: ${formatCode(code)}\n(الرمز لك وحدك)`
}

export function ago(ts?: number): string {
  if (!ts) return '—'
  const days = Math.floor((Date.now() - ts) / 864e5)
  return days <= 0 ? 'اليوم' : days === 1 ? 'أمس' : `قبل ${days} أيام`
}

/** حالة الطالب في قائمة المعلم. */
export function StudentStatus({ e }: { e: RosterEntry }) {
  if (!e.student) return <span className="text-amber-700 dark:text-amber-400">لم يدخل بعد</span>
  const days = e.student.lastSeen ? Math.floor((Date.now() - e.student.lastSeen) / 864e5) : null
  if (days === null) return <span className="text-slate-500">دخل · لم يبدأ</span>
  return <span className={days >= 3 ? 'text-rose-700 dark:text-rose-400' : 'text-teal-700 dark:text-teal-400'}>آخر نشاط: {ago(e.student.lastSeen)}</span>
}

/** الطلاب: إضافة طالب برمز دخول خاص به، وقائمة الطلاب. */
export function StudentsScreen({ openStudent }: { openStudent: (code: string) => void }) {
  const cloud = useCloudStatus()
  const { profile } = useProfile()
  const owner = !!profile?.owner
  const myName = cloud.name || profile?.teacherName || (cloud.email ?? '').split('@')[0]
  const data = useAsync(async () => {
    const [list, classes, teachers, everyClass] = await Promise.all([
      roster(owner ? '*' : undefined),
      myTeacherClasses(),
      owner ? listTeachers() : Promise.resolve([]),
      owner ? allClasses() : Promise.resolve([]),
    ])
    // أسماء الفصول للعرض (المالك يرى فصول كل المعلمين).
    const names = new Map([...everyClass, ...classes].map((c) => [c.code, c.name]))
    return { list, classes, teachers, names }
  }, [owner])
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('')

  const list = (data.data?.list ?? []).filter((e) => !filter || e.code.name.includes(filter.trim()))
  return (
    <Screen title="الطلاب">
      {adding ? (
        <NewStudent
          myName={myName}
          myClasses={data.data?.classes ?? []}
          teachers={owner ? data.data?.teachers ?? [] : []}
          onClose={() => {
            setAdding(false)
            data.reload()
          }}
        />
      ) : (
        <Button className="mb-4 w-full min-h-12" onClick={() => setAdding(true)}>
          + طالب جديد (رمز دخول خاص به)
        </Button>
      )}

      {data.loading && !data.data ? (
        <p className="text-sm text-slate-500">جارٍ التحميل…</p>
      ) : data.error ? (
        <Card className="text-rose-700 dark:text-rose-400">{cloudErrorText(data.error)}</Card>
      ) : !data.data?.list.length ? (
        <Card className="text-center text-slate-500">لا يوجد طلاب بعد. اضغط «طالب جديد» واكتب اسمه، وأرسل له رمزه.</Card>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-bold">{list.length} طالب</h2>
            <input className={`${field} max-w-48 py-1.5 text-sm`} aria-label="بحث" placeholder="ابحث بالاسم" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <ul className="grid gap-2">
            {list.map((e) => (
              <li key={e.code.code}>
                <button
                  type="button"
                  onClick={() => openStudent(e.code.code)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 hover:ring-teal-600 dark:bg-slate-900 dark:ring-slate-800"
                >
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <span className="block font-bold">{e.code.name}</span>
                    <span className="block text-sm">
                      <StudentStatus e={e} />
                      {e.student && ` · يعرف ${e.student.known ?? 0} كلمة`}
                    </span>
                    {(() => {
                      const names = (e.student?.classes ?? e.code.classes)
                        .map((c) => data.data?.names.get(c))
                        .filter(Boolean)
                      return names.length ? <span className="block text-xs text-slate-500">الفصول: {names.join('، ')}</span> : null
                    })()}
                    {owner && <span className="block text-xs text-slate-500">المعلم: {e.code.teacherName}</span>}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">
                    ←
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  )
}

function NewStudent({
  myName,
  myClasses,
  teachers,
  onClose,
}: {
  myName: string
  myClasses: ClassInfo[]
  teachers: { uid: string; name: string }[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [teacher, setTeacher] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [made, setMade] = useState<{ code: string; name: string; teacher: string } | null>(null)
  const t = teachers.find((x) => x.uid === teacher)
  const classes = useAsync(async () => (t ? classesOf(t.uid) : myClasses), [teacher, myClasses.map((c) => c.code).join()])

  if (made) {
    return (
      <Card className="mb-4 ring-2 ring-teal-600">
        <p className="text-sm text-slate-500">رمز دخول {made.name}</p>
        <p dir="ltr" className="font-en my-2 text-center text-3xl font-bold tracking-[0.2em] whitespace-nowrap text-teal-700 dark:text-teal-400">
          {formatCode(made.code)}
        </p>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">أرسله له: يختار «أنا طالب» ويسجّل الدخول ثم يكتب الرمز، فيدخل فصوله ويشوف دروسك.</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ShareText text={studentInvite(made.code, made.name, made.teacher)} />
          <span className="flex gap-2">
            <Button variant="secondary" onClick={() => { setMade(null); setName(''); setNotes(''); setPicked([]) }}>
              طالب آخر
            </Button>
            <Button onClick={onClose}>تم</Button>
          </span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <h2 className="mb-2 font-bold">طالب جديد</h2>
      <form
        className="grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setMsg(null)
          try {
            const code = await createStudentCode({ name, notes, classes: picked, myName, teacher: t })
            setMade({ code, name: name.trim(), teacher: t?.name ?? myName })
          } catch (err) {
            setMsg(cloudErrorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <input className={field} aria-label="اسم الطالب" placeholder="اسم الطالب" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <textarea className={`${field} min-h-16`} aria-label="ملاحظات عن الطالب" placeholder="ملاحظات خاصة بك عن الطالب (اختياري — لا يراها الطالب)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        {teachers.length > 0 && (
          <label className="text-sm">
            معلم الطالب
            <select className={`${field} mt-1`} aria-label="معلم الطالب" value={teacher} onChange={(e) => { setTeacher(e.target.value); setPicked([]) }}>
              <option value="">أنا ({myName})</option>
              {teachers.map((x) => (
                <option key={x.uid} value={x.uid}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="text-sm">
          <legend className="mb-1">يدخل هذه الفصول تلقائيًا (اختياري)</legend>
          {classes.loading ? (
            <p className="text-slate-500">…</p>
          ) : !classes.data?.length ? (
            <p className="text-slate-500">لا توجد فصول بعد — تقدر تضيفه لفصل لاحقًا من صفحته.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {classes.data.map((c) => (
                <label key={c.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-teal-700"
                    checked={picked.includes(c.code)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.code] : p.filter((x) => x !== c.code)))}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <div className="mt-1 flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy || !name.trim()}>
            {busy ? '…' : 'أنشئ رمز الطالب'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </div>
        {msg && <p className="text-sm text-rose-700 dark:text-rose-400">{msg}</p>}
      </form>
    </Card>
  )
}
