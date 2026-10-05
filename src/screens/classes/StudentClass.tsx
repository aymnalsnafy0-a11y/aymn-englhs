import { Card, Screen } from '../../components/ui'
import { getClass, getMyResult, listAssignments } from '../../data/classroom'
import { cloudSdk } from '../../data/cloud'
import { assignmentState, attemptsLeft, isAssignedTo, type AssignmentState } from '../../lib/classroom'
import { toDayKey } from '../../lib/dates'
import { cloudErrorText, useAsync } from '../../lib/useAsync'

const BADGE: Record<AssignmentState, { label: string; cls: string }> = {
  todo: { label: 'جديد', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  overdue: { label: 'متأخر', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  done: { label: 'تم ✓', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200' },
  late: { label: 'تم (متأخر)', cls: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200' },
}

/** واجبات فصل واحد للطالب، الجديدة أولًا. */
export function StudentClass({ code, onBack, open }: { code: string; onBack: () => void; open: (id: string) => void }) {
  const data = useAsync(async () => {
    const [info, all, { uid }] = await Promise.all([getClass(code), listAssignments(code), cloudSdk()])
    // واجب لطلاب محددين يظهر لهم فقط.
    const assignments = all.filter((a) => isAssignedTo(a, uid))
    const results = await Promise.all(assignments.map((a) => getMyResult(code, a.id).catch(() => null)))
    return { info, items: assignments.map((a, i) => ({ a, r: results[i] })) }
  }, [code])

  if (data.loading) return <Screen title="الواجبات" onBack={onBack}>{null}</Screen>
  if (data.error || !data.data?.info) {
    return (
      <Screen title="الواجبات" onBack={onBack}>
        <Card className="text-rose-700 dark:text-rose-400">{data.error ? cloudErrorText(data.error) : 'الفصل غير موجود.'}</Card>
      </Screen>
    )
  }
  const today = toDayKey()
  const items = data.data.items
    .map(({ a, r }) => ({ a, r, state: assignmentState(a, r ?? undefined, today, (ts) => toDayKey(new Date(ts))) }))
    .sort((x, y) => Number(x.state === 'done' || x.state === 'late') - Number(y.state === 'done' || y.state === 'late'))

  return (
    <Screen title={data.data.info.name} onBack={onBack}>
      <p className="mb-3 text-slate-500">
        المعلم: {[data.data.info.teacherName, ...Object.values(data.data.info.teacherNames ?? {})].filter(Boolean).join('، ')}
      </p>
      {items.length === 0 ? (
        <Card className="text-center text-slate-500">لا توجد واجبات بعد.</Card>
      ) : (
        <ul className="grid gap-2">
          {items.map(({ a, r, state }) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => open(a.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm text-slate-500">
                    {[a.exercises?.length ? `${a.exercises.length} تمرين` : null, a.words.length ? `${a.words.length} كلمة` : null].filter(Boolean).join(' + ')}
                    {a.dueAt && <> · التسليم <span dir="ltr">{a.dueAt}</span></>}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${BADGE[state].cls}`}>{BADGE[state].label}</span>
                  {r && <span className="text-sm tabular-nums">{r.score}/{r.total}</span>}
                  {a.maxAttempts ? (
                    <span className="text-xs text-slate-500">
                      {attemptsLeft(a, r) ? `باقي ${attemptsLeft(a, r)} محاولة` : 'انتهت المحاولات'}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
