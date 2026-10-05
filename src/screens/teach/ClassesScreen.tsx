import { useState } from 'react'
import { Button, Card, Screen } from '../../components/ui'
import { useCloudStatus } from '../../data/cloud'
import { createClass, myTeacherClasses } from '../../data/classroom'
import { allClasses, listTeachers, useProfile } from '../../data/roles'
import { formatCode } from '../../lib/classroom'
import { cloudErrorText, useAsync } from '../../lib/useAsync'
import { ClassRow } from './Teachers'

const field =
  'w-full min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

/** الفصول: المعلم يرى فصوله وينشئ فصلًا؛ المالك يرى كل الفصول وينشئ فصلًا لأي معلم. */
export function ClassesScreen({ openClass }: { openClass: (code: string) => void }) {
  const cloud = useCloudStatus()
  const { profile } = useProfile()
  const owner = !!profile?.owner
  const myName = cloud.name || profile?.teacherName || (cloud.email ?? '').split('@')[0]
  const data = useAsync(async () => {
    const [classes, teachers] = await Promise.all([owner ? allClasses() : myTeacherClasses(), owner ? listTeachers() : Promise.resolve([])])
    return { classes, teachers }
  }, [owner])
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const t = data.data?.teachers.find((x) => x.uid === teacher)
      const c = t ? await createClass(name, t.name, t.uid) : await createClass(name, myName)
      setName('')
      openClass(c.code)
    } catch (err) {
      setMsg(cloudErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="الفصول">
      <Card className="mb-4">
        <h2 className="mb-2 font-bold">فصل جديد</h2>
        <form onSubmit={create} className="grid gap-2">
          <input className={field} aria-label="اسم الفصل" placeholder="اسم الفصل (مثل: مجموعة الأحد)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          {owner && (
            <label className="text-sm">
              معلم الفصل
              <select className={`${field} mt-1`} aria-label="معلم الفصل" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                <option value="">أنا ({myName})</option>
                {data.data?.teachers.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" disabled={busy || !name.trim()}>
            أنشئ الفصل
          </Button>
        </form>
        {msg && <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{msg}</p>}
      </Card>

      <h2 className="mb-2 font-bold">{owner ? 'كل الفصول' : 'فصولي'}</h2>
      {data.loading && !data.data ? (
        <p className="text-sm text-slate-500">جارٍ التحميل…</p>
      ) : data.error ? (
        <Card className="text-rose-700 dark:text-rose-400">{cloudErrorText(data.error)}</Card>
      ) : !data.data?.classes.length ? (
        <Card className="text-center text-slate-500">لا توجد فصول بعد. أنشئ أول فصل من الأعلى.</Card>
      ) : owner ? (
        <ul className="grid gap-2">
          {data.data.classes.map((c) => (
            <ClassRow key={c.code} c={c} teachers={data.data!.teachers} open={() => openClass(c.code)} onChanged={data.reload} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2">
          {data.data.classes.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => openClass(c.code)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 hover:ring-teal-600 dark:bg-slate-900 dark:ring-slate-800"
              >
                <span className="min-w-0 flex-1 basis-40 [overflow-wrap:anywhere]">
                  <span className="block font-bold">{c.name}</span>
                  <span className="block text-sm text-slate-500">
                    {c.students === undefined ? '' : c.students === 0 ? 'لا يوجد طلاب بعد' : `${c.students} طالب`}
                    {c.teacherUid !== profile?.uid && ` · معلم مشارك (الرئيسي: ${c.teacherName})`}
                  </span>
                </span>
                <span dir="ltr" className="font-en shrink-0 tracking-widest whitespace-nowrap text-slate-500">
                  {formatCode(c.code)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
