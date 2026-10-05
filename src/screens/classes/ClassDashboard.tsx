import { useState } from 'react'
import { Button, Card, ProgressBar, Screen } from '../../components/ui'
import {
  deleteAnnouncement,
  deleteAssignment,
  deleteClass,
  getClass,
  listAnnouncements,
  listAssignments,
  listMembers,
  listResults,
  postAnnouncement,
  removeMember,
  type Assignment,
} from '../../data/classroom'
import { useCloudStatus } from '../../data/cloud'
import { useProfile } from '../../data/roles'
import { addToClass, roster, type RosterEntry } from '../../data/roster'
import { assignmentReport, attemptsLabel, formatCode, studentHomework, type AssignmentState, type Member, type Result } from '../../lib/classroom'
import { toDayKey } from '../../lib/dates'
import { exerciseLabel } from '../../lib/exercises'
import { cloudErrorText, useAsync } from '../../lib/useAsync'

const STATE: Record<AssignmentState, { label: string; cls: string }> = {
  done: { label: '✓ حلّ', cls: 'text-teal-700 dark:text-teal-400' },
  late: { label: '✓ حلّ متأخرًا', cls: 'text-amber-700 dark:text-amber-400' },
  todo: { label: 'لم يحل بعد', cls: 'text-slate-500' },
  overdue: { label: '✗ لم يحل (انتهى الموعد)', cls: 'text-rose-700 dark:text-rose-400' },
}

const dayOf = (ts: number) => toDayKey(new Date(ts))

function ago(ts?: number): string {
  if (!ts) return '—'
  const days = Math.floor((Date.now() - ts) / 864e5)
  return days <= 0 ? 'اليوم' : days === 1 ? 'أمس' : `قبل ${days} أيام`
}

export function ClassDashboard({
  code,
  onBack,
  newAssignment,
  openStudent: openStudentPage,
}: {
  code: string
  onBack: () => void
  newAssignment: () => void
  openStudent: (studentCode: string) => void
}) {
  const data = useAsync(async () => {
    const [info, members, assignments, news] = await Promise.all([getClass(code), listMembers(code), listAssignments(code), listAnnouncements(code).catch(() => [])])
    const lists = await Promise.all(assignments.map((a) => listResults(code, a.id).catch(() => [] as Result[])))
    const results: Record<string, Result[]> = Object.fromEntries(assignments.map((a, i) => [a.id, lists[i]]))
    // طلاب المعلم (لفتح صفحة الطالب وإضافة طلاب للفصل). المعلم المشارك لا يرى قائمة غيره.
    const mine: RosterEntry[] = info ? await roster(info.teacherUid).catch(() => []) : []
    return { info, members, assignments, results, news, mine }
  }, [code])
  const [tab, setTab] = useState<'students' | 'assignments' | 'grades' | 'news'>('students')
  // «تحديث» يعيد تحميل نتائج كل واجب أيضًا (كل بطاقة تحمّل نتائجها بنفسها).
  const [version, setVersion] = useState(0)
  const refresh = () => {
    data.reload()
    setVersion((v) => v + 1)
  }
  const [copied, setCopied] = useState(false)
  const [openStudent, setOpenStudent] = useState<string | null>(null)

  if (data.loading && !data.data) return <Screen title="الفصل" onBack={onBack}>{null}</Screen>
  if (data.error || !data.data?.info) {
    return (
      <Screen title="الفصل" onBack={onBack}>
        <Card className="text-rose-700 dark:text-rose-400">{data.error ? cloudErrorText(data.error) : 'الفصل غير موجود.'}</Card>
      </Screen>
    )
  }
  const { info, members, assignments, results, news, mine } = data.data
  const entryOf = (uid: string) => mine.find((e) => e.student?.uid === uid)
  const notIn = mine.filter((e) => !(e.student ? members.some((m) => m.uid === e.student!.uid) : e.code.classes.includes(code)))
  const invite = `انضم لفصل «${info.name}» في موقع سنافي AE لتعلّم الإنجليزية:\n${location.origin}${import.meta.env.BASE_URL}\nاختر «أنا طالب» ← سجّل الدخول ← رمز الفصل: ${formatCode(code)}`

  return (
    <Screen title={info.name} onBack={onBack}>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">رمز الفصل — أعطه لطلابك</p>
            <p dir="ltr" className="font-en text-3xl font-bold tracking-[0.2em] whitespace-nowrap text-teal-700 dark:text-teal-400">
              {formatCode(code)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invite)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  /* النسخ غير متاح */
                }
              }}
            >
              {copied ? '✓ نُسخت الدعوة' : 'انسخ الدعوة'}
            </Button>
            <a
              className="inline-flex min-h-11 items-center rounded-xl bg-[#25D366] px-4 py-2 font-medium text-white"
              href={`https://wa.me/?text=${encodeURIComponent(invite)}`}
              target="_blank"
              rel="noreferrer"
            >
              واتساب
            </a>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {members.length} طالب · {assignments.length} واجب
          {info.teacherNames && Object.keys(info.teacherNames).length > 0 && (
            <> · المعلمون: {[info.teacherName, ...Object.values(info.teacherNames)].join('، ')}</>
          )}
        </p>
      </Card>

      <div className="mb-1 flex justify-end">
        <Button variant="ghost" className="min-h-9 text-sm" onClick={refresh}>
          ↻ تحديث
        </Button>
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {(
          [
            ['students', 'الطلاب'],
            ['assignments', 'الواجبات'],
            ['grades', 'الدرجات'],
            ['news', 'الإعلانات'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-1 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-teal-800 shadow-sm dark:bg-slate-900 dark:text-teal-300' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'grades' ? (
        <Gradebook members={members} assignments={assignments} results={results} />
      ) : tab === 'news' ? (
        <News code={code} items={news} onChanged={data.reload} />
      ) : tab === 'assignments' ? (
        <>
          <Button className="mb-3 w-full" onClick={newAssignment}>
            + واجب جديد (من صور الدرس أو ملاحظاتك)
          </Button>
          {assignments.length === 0 ? (
            <Card className="text-center text-slate-500">لا توجد واجبات بعد.</Card>
          ) : (
            <>
            <p className="mb-2 text-sm text-slate-500">اضغط على أي واجب لترى نتيجة كل طالب فيه.</p>
            <ul className="grid gap-3">
              {assignments.map((a) => (
                <AssignmentItem key={`${a.id}-${version}`} code={code} a={a} members={members} onDeleted={refresh} />
              ))}
            </ul>
            </>
          )}
        </>
      ) : (
        <>
          {notIn.length > 0 && <AddFromRoster code={code} candidates={notIn} onAdded={data.reload} />}
          {members.length === 0 ? (
            <Card className="text-center text-slate-500">لا يوجد طلاب بعد. أضف طلابك من تبويب «الطلاب»، أو شارك رمز الفصل.</Card>
          ) : (
            <ul className="grid gap-3">
              {members.map((m) => {
                const hw = studentHomework(m.uid, assignments, results, toDayKey(), dayOf)
                const isOpen = openStudent === m.uid
                return (
                  <li key={m.uid}>
                    <Card>
                      <button type="button" className="w-full text-start" onClick={() => setOpenStudent(isOpen ? null : m.uid)} aria-expanded={isOpen}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold">{m.name}</p>
                          <span className="shrink-0 text-sm text-slate-500">{isOpen ? '▲' : '▼'}</span>
                        </div>
                        <p className="mt-1 text-sm">
                          الواجبات: <span className="tabular-nums font-semibold">{hw.done}/{hw.total}</span> محلول
                          {hw.average !== null && (
                            <>
                              {' '}
                              · متوسط <span dir="ltr" className="font-semibold">{hw.average}%</span>
                            </>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          آخر نشاط: {ago(m.lastSeen)} · يعرف {m.known ?? 0} · يتعلّم {m.learning ?? 0} · {m.streak ?? 0} 🔥
                        </p>
                      </button>
                      {isOpen && (
                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <StudentResults hw={hw} />
                          <div className="mt-3 flex flex-wrap justify-between gap-2">
                            {entryOf(m.uid) ? (
                              <Button variant="secondary" className="min-h-9 text-sm" onClick={() => openStudentPage(entryOf(m.uid)!.code.code)}>
                                صفحة الطالب
                              </Button>
                            ) : (
                              <span />
                            )}
                            <Button
                              variant="ghost"
                              className="min-h-9 text-xs text-rose-700 dark:text-rose-400"
                              onClick={async () => {
                                if (!window.confirm(`إزالة ${m.name} من الفصل؟`)) return
                                await removeMember(code, m.uid)
                                data.reload()
                              }}
                            >
                              إزالة من الفصل
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <div className="mt-8 text-center">
        <Button
          variant="ghost"
          className="text-sm text-rose-700 dark:text-rose-400"
          onClick={async () => {
            if (!window.confirm('حذف الفصل نهائيًا؟ لن يتمكن الطلاب من رؤية واجباته.')) return
            await deleteClass(code)
            onBack()
          }}
        >
          حذف الفصل
        </Button>
      </div>
    </Screen>
  )
}

function AssignmentItem({
  code,
  a,
  members,
  onDeleted,
}: {
  code: string
  a: Assignment
  members: Member[]
  onDeleted: () => void
}) {
  const results = useAsync(() => listResults(code, a.id), [code, a.id])
  const [open, setOpen] = useState(false)
  const report = results.data ? assignmentReport(a, members, results.data, toDayKey(), dayOf) : null
  const parts = [
    a.exercises?.length ? `${a.exercises.length} تمرين` : null,
    a.words.length ? `${a.words.length} كلمة` : null,
    a.to?.length ? `لـ${a.to.length} ${a.to.length === 1 ? 'طالب' : 'طلاب'}` : null,
    a.maxAttempts ? attemptsLabel(a.maxAttempts) : null,
  ].filter(Boolean)

  return (
    <li>
      <Card>
        <button type="button" className="w-full text-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{a.title}</p>
              <p className="text-sm text-slate-500">
                {parts.join(' · ')} {a.dueAt && <>· التسليم <span dir="ltr">{a.dueAt}</span></>}
              </p>
            </div>
            <span className="shrink-0 text-sm text-slate-500">{open ? '▲' : '▼'}</span>
          </div>
          {report && (
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={report.done} max={Math.max(1, report.members)} label="من حلّ الواجب" />
              <span className="shrink-0 text-sm tabular-nums">
                {report.done}/{report.members}
                {report.average !== null && <> · متوسط <span dir="ltr">{report.average}%</span></>}
              </span>
            </div>
          )}
        </button>

        {open && report && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {report.rows.length === 0 ? (
              <p className="text-sm text-slate-500">لا يوجد طلاب في الفصل بعد.</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {report.rows.map((r) => (
                  <li key={r.uid} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/50">
                    <span className="font-medium">{r.name}</span>
                    <span className={STATE[r.state].cls}>
                      {STATE[r.state].label}
                      {r.total !== undefined && (
                        <span className="ms-2 tabular-nums text-slate-700 dark:text-slate-300">
                          {r.score}/{r.total}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {report.missedQuestions.length > 0 && a.exercises && (
              <div className="mt-4">
                <h3 className="mb-1 text-sm font-bold">الأسئلة الأكثر خطأ</h3>
                <ul className="grid gap-1 text-sm">
                  {report.missedQuestions.slice(0, 5).map((m) => (
                    <li key={m.index} className="flex justify-between gap-2">
                      <span dir="ltr" className="font-en min-w-0 text-start">
                        {a.exercises![m.index] ? exerciseLabel(a.exercises![m.index]) : `#${m.index + 1}`}
                      </span>
                      <span className="shrink-0 text-rose-700 dark:text-rose-400">{m.count} طالب</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.missed.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-bold">الكلمات الأكثر خطأ: </span>
                <span dir="ltr" className="font-en">
                  {report.missed.slice(0, 8).map((m) => `${m.word} (${m.count})`).join(' · ')}
                </span>
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                className="text-sm text-rose-700 dark:text-rose-400"
                onClick={async () => {
                  if (!window.confirm('حذف هذا الواجب؟')) return
                  await deleteAssignment(code, a.id)
                  onDeleted()
                }}
              >
                حذف الواجب
              </Button>
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}

function StudentResults({ hw }: { hw: ReturnType<typeof studentHomework> }) {
  if (hw.items.length === 0) return <p className="text-sm text-slate-500">لا توجد واجبات بعد.</p>
  return (
    <ul className="grid gap-1 text-sm">
      {hw.items.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/50">
          <span className="min-w-0">{i.title}</span>
          <span className={`shrink-0 ${STATE[i.state].cls}`}>
            {STATE[i.state].label}
            {i.total !== undefined && (
              <span className="ms-2 tabular-nums text-slate-700 dark:text-slate-300">
                {i.score}/{i.total}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** جدول الدرجات: الطلاب صفوف والواجبات أعمدة. */
function Gradebook({ members, assignments, results }: { members: Member[]; assignments: Assignment[]; results: Record<string, Result[]> }) {
  if (!members.length || !assignments.length) {
    return <Card className="text-center text-slate-500">يظهر الجدول بعد أن يكون في الفصل طلاب وواجبات.</Card>
  }
  const cols = [...assignments].sort((a, b) => a.createdAt - b.createdAt)
  const today = toDayKey()
  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60">
              <th className="sticky start-0 z-10 bg-slate-50 p-2 text-start font-semibold dark:bg-slate-800">الطالب</th>
              {cols.map((a) => (
                <th key={a.id} className="max-w-28 p-2 text-center font-medium" title={a.title}>
                  <span className="line-clamp-2 block text-xs">{a.title}</span>
                </th>
              ))}
              <th className="p-2 text-center font-semibold">المتوسط</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const hw = studentHomework(m.uid, cols, results, today, dayOf)
              return (
                <tr key={m.uid} className="border-t border-slate-100 dark:border-slate-800">
                  <th className="sticky start-0 z-10 bg-white p-2 text-start font-medium dark:bg-slate-900">{m.name}</th>
                  {cols.map((a) => {
                    const item = hw.items.find((i) => i.id === a.id)
                    if (!item) return <td key={a.id} className="p-2 text-center text-slate-300">·</td>
                    const pct = item.total ? Math.round(((item.score ?? 0) / item.total) * 100) : null
                    return (
                      <td
                        key={a.id}
                        className={`p-2 text-center tabular-nums ${
                          pct === null
                            ? item.state === 'overdue'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-400'
                            : pct >= 80
                              ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
                              : pct >= 50
                                ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300'
                        }`}
                      >
                        {item.total !== undefined ? `${item.score}/${item.total}` : item.state === 'overdue' ? '✗' : '—'}
                      </td>
                    )
                  })}
                  <td className="p-2 text-center font-semibold tabular-nums">{hw.average === null ? '—' : `${hw.average}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="p-3 text-xs text-slate-500">— لم يحل بعد · ✗ انتهى الموعد ولم يحل · · ليس له</p>
    </Card>
  )
}

/** إعلانات الفصل: يكتبها المعلم وتظهر لطلابه في الرئيسية. */
function News({ code, items, onChanged }: { code: string; items: import('../../data/classroom').Announcement[]; onChanged: () => void }) {
  const cloud = useCloudStatus()
  const { profile } = useProfile()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <>
      <Card className="mb-3">
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setMsg(null)
            try {
              await postAnnouncement(code, text, cloud.name || profile?.teacherName || 'المعلم')
              setText('')
              onChanged()
            } catch (err) {
              setMsg(cloudErrorText(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          <textarea
            className="min-h-20 w-full rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700"
            aria-label="نص الإعلان"
            placeholder="اكتب إعلانًا لطلاب الفصل (مثل: اختبار يوم الأحد على الدرس الثالث)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            انشر الإعلان
          </Button>
          {msg && <p className="text-sm text-rose-700 dark:text-rose-400">{msg}</p>}
        </form>
      </Card>
      {items.length === 0 ? (
        <Card className="text-center text-slate-500">لا توجد إعلانات بعد.</Card>
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card>
                <p className="whitespace-pre-line">{n.text}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {n.byName} · {ago(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    className="text-rose-700 underline dark:text-rose-400"
                    onClick={async () => {
                      if (!window.confirm('حذف الإعلان؟')) return
                      await deleteAnnouncement(code, n.id)
                      onChanged()
                    }}
                  >
                    حذف
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** إضافة طالب من قائمة المعلم إلى هذا الفصل. */
function AddFromRoster({ code, candidates, onAdded }: { code: string; candidates: RosterEntry[]; onAdded: () => void }) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Card className="mb-3">
      <h2 className="mb-2 font-bold">أضف من طلابك</h2>
      <div className="flex gap-2">
        <select
          className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 dark:bg-slate-950 dark:ring-slate-700"
          aria-label="اختر طالبًا"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">اختر طالبًا…</option>
          {candidates.map((e) => (
            <option key={e.code.code} value={e.code.code}>
              {e.code.name}
              {e.student ? '' : ' (لم يدخل بعد)'}
            </option>
          ))}
        </select>
        <Button
          disabled={!pick || busy}
          onClick={async () => {
            const e = candidates.find((c) => c.code.code === pick)
            if (!e) return
            setBusy(true)
            await addToClass(e, code)
            setBusy(false)
            setPick('')
            onAdded()
          }}
        >
          أضف
        </Button>
      </div>
    </Card>
  )
}
