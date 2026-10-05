import { useState } from 'react'
import { Button, Card, Screen } from '../../components/ui'
import { classesOf, getMyResultFor, listAssignments, type Assignment, type ClassInfo, type Result } from '../../data/classroom'
import { addToClass, getNotes, getRosterEntry, removeFromClass, removeStudent, renameStudent, setNotes } from '../../data/roster'
import { assignmentState, attemptsLabel, formatCode, isAssignedTo, type AssignmentState } from '../../lib/classroom'
import { toDayKey } from '../../lib/dates'
import { cloudErrorText, useAsync } from '../../lib/useAsync'
import { ago, StudentStatus, studentInvite } from './StudentsScreen'
import { ShareText } from './Teachers'

const field =
  'w-full min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

const STATE: Record<AssignmentState, { label: string; cls: string }> = {
  done: { label: '✓ حلّ', cls: 'text-teal-700 dark:text-teal-400' },
  late: { label: '✓ حلّ متأخرًا', cls: 'text-amber-700 dark:text-amber-400' },
  todo: { label: 'لم يحل بعد', cls: 'text-slate-500' },
  overdue: { label: '✗ لم يحل', cls: 'text-rose-700 dark:text-rose-400' },
}

/** صفحة طالب للمعلم: الرمز، الحالة، الملاحظات، الفصول، وكل واجباته ودرجاته. */
export function StudentPage({ code, onBack, openClass }: { code: string; onBack: () => void; openClass: (code: string) => void }) {
  const data = useAsync(async () => {
    const entry = await getRosterEntry(code)
    if (!entry) return null
    const [notes, classes] = await Promise.all([getNotes(code).catch(() => ''), classesOf(entry.code.teacherUid)])
    // واجبات الطالب في فصول المعلم التي هو فيها.
    const inClasses = entry.student ? classes.filter((c) => entry.student!.classes.includes(c.code)) : []
    const homework: { cls: ClassInfo; a: Assignment; r: Result | null }[] = []
    for (const c of inClasses) {
      const list = (await listAssignments(c.code).catch(() => [])).filter((a) => isAssignedTo(a, entry.student!.uid))
      const results = await Promise.all(list.map((a) => getMyResultFor(c.code, a.id, entry.student!.uid).catch(() => null)))
      list.forEach((a, i) => homework.push({ cls: c, a, r: results[i] }))
    }
    return { entry, notes, classes, homework }
  }, [code])

  if (data.loading && !data.data) return <Screen title="الطالب" onBack={onBack}>{null}</Screen>
  if (data.error || !data.data) {
    return (
      <Screen title="الطالب" onBack={onBack}>
        <Card className="text-rose-700 dark:text-rose-400">{data.error ? cloudErrorText(data.error) : 'الطالب غير موجود.'}</Card>
      </Screen>
    )
  }
  const { entry, classes, homework } = data.data
  const s = entry.student
  const memberOf = new Set(s ? s.classes : entry.code.classes)
  const done = homework.filter((h) => h.r).length
  const avg = done ? Math.round(homework.filter((h) => h.r).reduce((sum, h) => sum + (h.r!.total ? (h.r!.score / h.r!.total) * 100 : 0), 0) / done) : null
  const today = toDayKey()
  const dayOf = (ts: number) => toDayKey(new Date(ts))

  return (
    <Screen title={entry.code.name} onBack={onBack}>
      <Card className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm">
              <StudentStatus e={entry} />
            </p>
            <p className="mt-1 text-sm text-slate-500">
              رمز الدخول:{' '}
              <span dir="ltr" className="font-en font-semibold tracking-widest whitespace-nowrap text-slate-700 dark:text-slate-300">
                {formatCode(entry.code.code)}
              </span>
              {s && ' · مُستخدَم'}
            </p>
          </div>
          {!s && <ShareText text={studentInvite(entry.code.code, entry.code.name, entry.code.teacherName)} />}
        </div>
        {s && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              { n: s.known ?? 0, label: 'يعرف' },
              { n: s.learning ?? 0, label: 'يتعلّم' },
              { n: `${s.streak ?? 0}🔥`, label: 'أيام متتالية' },
              { n: avg === null ? '—' : `${avg}%`, label: 'متوسط الواجبات' },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <p className="text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">{x.n}</p>
                <p className="text-xs text-slate-500">{x.label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Notes code={code} initial={data.data.notes} />

      <Card className="mb-3">
        <h2 className="mb-2 font-bold">فصوله</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد فصول بعد. أنشئ فصلًا من تبويب «الفصول».</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {classes.map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/50">
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-teal-700"
                    checked={memberOf.has(c.code)}
                    onChange={async (e) => {
                      await (e.target.checked ? addToClass(entry, c.code) : removeFromClass(entry, c.code))
                      data.reload()
                    }}
                  />
                  <span className="[overflow-wrap:anywhere]">{c.name}</span>
                </label>
                {memberOf.has(c.code) && (
                  <button type="button" className="shrink-0 text-teal-700 underline dark:text-teal-400" onClick={() => openClass(c.code)}>
                    افتح الفصل
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!s && memberOf.size > 0 && <p className="mt-2 text-xs text-slate-500">يدخل هذه الفصول تلقائيًا أول ما يستخدم رمزه.</p>}
      </Card>

      {s && (
        <Card className="mb-3">
          <h2 className="mb-2 font-bold">
            واجباته {homework.length > 0 && <span className="text-sm font-normal text-slate-500">({done} من {homework.length} محلول)</span>}
          </h2>
          {homework.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد واجبات له بعد.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {homework.map(({ cls, a, r }) => {
                const st = STATE[assignmentState(a, r ?? undefined, today, dayOf)]
                return (
                  <li key={`${cls.code}-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/50">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-xs text-slate-500">
                        {cls.name}
                        {a.dueAt && ` · التسليم ${a.dueAt}`}
                        {a.maxAttempts ? ` · ${attemptsLabel(a.maxAttempts)}` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 ${st.cls}`}>
                      {st.label}
                      {r && (
                        <span className="ms-2 tabular-nums text-slate-700 dark:text-slate-300">
                          {r.score}/{r.total}
                          {r.attempts > 1 && <span className="text-xs text-slate-500"> ({r.attempts} محاولات)</span>}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          {s.joinedAt && <p className="mt-3 text-xs text-slate-500">دخل الموقع {ago(s.joinedAt)}</p>}
        </Card>
      )}

      <Rename entry={entry} onDone={data.reload} />

      <div className="mt-6 text-center">
        <Button
          variant="ghost"
          className="text-sm text-rose-700 dark:text-rose-400"
          onClick={async () => {
            if (!window.confirm(`حذف ${entry.code.name} من طلابك؟ يخرج من فصولك ويُلغى رمزه.`)) return
            await removeStudent(entry, classes.map((c) => c.code))
            onBack()
          }}
        >
          حذف الطالب
        </Button>
      </div>
    </Screen>
  )
}

function Notes({ code, initial }: { code: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  return (
    <Card className="mb-3">
      <h2 className="mb-1 font-bold">ملاحظاتك عنه</h2>
      <p className="mb-2 text-xs text-slate-500">لا يراها الطالب.</p>
      <textarea
        className={`${field} min-h-20`}
        aria-label="ملاحظات"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setState('idle')
        }}
        maxLength={2000}
        placeholder="مثل: مستواه في القراءة جيد، يحتاج تدريب على النطق…"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={text === initial && state !== 'error'}
          onClick={async () => {
            setState('saving')
            try {
              await setNotes(code, text)
              setState('saved')
            } catch {
              setState('error')
            }
          }}
        >
          احفظ الملاحظات
        </Button>
        <span aria-live="polite" className="text-sm text-slate-500">
          {state === 'saving' ? 'جارٍ الحفظ…' : state === 'saved' ? '✓ حُفظت' : state === 'error' ? 'تعذّر الحفظ' : ''}
        </span>
      </div>
    </Card>
  )
}

function Rename({ entry, onDone }: { entry: Parameters<typeof renameStudent>[0]; onDone: () => void }) {
  const [name, setName] = useState(entry.code.name)
  return (
    <Card>
      <h2 className="mb-2 font-bold">اسم الطالب</h2>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          await renameStudent(entry, name)
          onDone()
        }}
      >
        <input className={field} aria-label="اسم الطالب" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === entry.code.name}>
          احفظ
        </Button>
      </form>
    </Card>
  )
}
