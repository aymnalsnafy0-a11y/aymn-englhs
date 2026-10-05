import { useState } from 'react'
import { Button, Card, ProgressBar, Screen } from '../../components/ui'
import {
  allClasses,
  createTeacherInvite,
  deleteTeacherInvite,
  DURATIONS,
  durationLabel,
  extendTeacher,
  listTeacherInvites,
  listTeachers,
  revokeTeacher,
  setStudentsUseKey,
  setTeacherShareKey,
  shareGeminiKey,
  sharedState,
  shareWordList,
  unshareGeminiKey,
  unshareWordList,
  useProfile,
  type Teacher,
} from '../../data/roles'
import { setCoTeachers, transferClass, type ClassInfo } from '../../data/classroom'
import { sharedCount } from '../../data/library'
import { prepareAllWords, stopPrepare, usePrepare } from '../../data/prepare'
import { formatCode } from '../../lib/classroom'
import { cloudErrorText, useAsync } from '../../lib/useAsync'

const input =
  'min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

function inviteText(code: string) {
  return `تمت دعوتك كمعلم في موقع سياق لتعلّم الإنجليزية:\n${location.origin}${import.meta.env.BASE_URL}\nاختر «أنا معلم» ← سجّل الدخول ← رمز المعلم: ${formatCode(code)}\n(الرمز لك وحدك ويرتبط بحسابك)`
}

const dateText = (ms: number) => new Date(ms).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })

/** حالة صلاحية المعلم: بلا انتهاء، تنتهي في تاريخ، أو منتهية. */
function Expiry({ t }: { t: Teacher }) {
  if (t.expiresAt === null) return <span className="text-teal-700 dark:text-teal-400">بلا انتهاء</span>
  const left = Math.ceil((t.expiresAt - Date.now()) / 864e5)
  if (left <= 0) return <span className="font-semibold text-rose-700 dark:text-rose-400">انتهت ({dateText(t.expiresAt)})</span>
  return (
    <span className={left <= 7 ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}>
      تنتهي {dateText(t.expiresAt)} · باقي {left} يوم
    </span>
  )
}

const select =
  'rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'

function Share({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="flex gap-1">
      <Button
        variant="secondary"
        className="min-h-9 px-3 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(inviteText(code))
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            /* النسخ غير متاح */
          }
        }}
      >
        {copied ? '✓ نُسخ' : 'نسخ'}
      </Button>
      <a
        className="inline-flex min-h-9 items-center rounded-xl bg-[#25D366] px-3 text-sm font-medium text-white"
        href={`https://wa.me/?text=${encodeURIComponent(inviteText(code))}`}
        target="_blank"
        rel="noreferrer"
      >
        واتساب
      </a>
    </span>
  )
}

/** لوحة المالك: رموز دخول المعلمين، المعلمون، وكل الفصول. */
export function OwnerPanel({ onBack, openClass }: { onBack?: () => void; openClass: (code: string) => void }) {
  const data = useAsync(async () => {
    const [invites, teachers, classes] = await Promise.all([listTeacherInvites(), listTeachers(), allClasses()])
    return { invites, teachers, classes }
  }, [])
  const [label, setLabel] = useState('')
  const [days, setDays] = useState(30)
  const [shareKey, setShareKey] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      setFresh(await createTeacherInvite(label, days, shareKey))
      setLabel('')
      data.reload()
    } catch (err) {
      setMsg(cloudErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (data.error) {
    return (
      <Screen title="لوحة المالك" onBack={onBack}>
        <Card className="text-rose-700 dark:text-rose-400">{cloudErrorText(data.error)}</Card>
      </Screen>
    )
  }
  const d = data.data
  const unused = d?.invites.filter((i) => !i.usedBy) ?? []
  const classesBy = (uid: string) => d?.classes.filter((c) => c.teacherUid === uid).length ?? 0

  return (
    <Screen title="لوحة المالك" onBack={onBack}>
      {d && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          {[
            { n: d.teachers.length, label: 'معلم' },
            { n: d.classes.length, label: 'فصل' },
            { n: unused.length, label: 'رمز لم يُفعَّل' },
          ].map((s) => (
            <Card key={s.label} className="p-3">
              <p className="text-3xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{s.n}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      <SharedCard />

      <Card className="mb-4">
        <h2 className="text-lg font-bold">رمز دخول لمعلم جديد</h2>
        <p className="mt-1 text-sm text-slate-500">
          كل رمز لمعلم واحد: أول حساب يدخله يصبح صاحبه، ولا يعمل لغيره. المدة تبدأ من يوم التفعيل، وتقدر تمددها لاحقًا.
        </p>
        <form onSubmit={create} className="mt-3 flex flex-wrap gap-2">
          <input className={input} aria-label="اسم المعلم (لتتذكر لمن الرمز)" placeholder="لمن الرمز؟ (مثل: أ. سالم)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
          <select className={select} aria-label="مدة الصلاحية" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d.days} value={d.days}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="flex w-full items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-teal-700" checked={shareKey} onChange={(e) => setShareKey(e.target.checked)} />
            يستخدم مفتاح Gemini المشترك (لتوليد التمارين من الدرس)
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? '…' : 'أنشئ رمزًا'}
          </Button>
        </form>
        {msg && <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{msg}</p>}
        {fresh && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-teal-50 p-3 dark:bg-teal-950/40">
            <p dir="ltr" className="font-en text-2xl font-bold tracking-[0.2em] text-teal-800 dark:text-teal-300">
              {formatCode(fresh)}
            </p>
            <Share code={fresh} />
          </div>
        )}

        {d && d.invites.length > 0 && (
          <ul className="mt-4 grid gap-1 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            {d.invites.map((i) => (
              <li key={i.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-slate-50 dark:odd:bg-slate-800/50">
                <span className="min-w-0">
                  <span dir="ltr" className="font-en font-semibold tracking-widest">
                    {formatCode(i.code)}
                  </span>
                  <span className="ms-2 text-slate-500">
                    {i.label || '—'} · {durationLabel(i.days)}
                    {i.shareKey ? ' · بالمفتاح' : ''}
                  </span>
                </span>
                {i.usedBy ? (
                  <span className="text-teal-700 dark:text-teal-400">✓ مرتبط بـ{i.usedName || 'معلم'}</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Share code={i.code} />
                    <Button
                      variant="ghost"
                      className="min-h-9 px-2 text-sm text-rose-700 dark:text-rose-400"
                      onClick={async () => {
                        if (!window.confirm('إلغاء هذا الرمز؟')) return
                        await deleteTeacherInvite(i.code)
                        if (fresh === i.code) setFresh(null)
                        data.reload()
                      }}
                    >
                      إلغاء
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-bold">المعلمون</h2>
        {!d ? (
          <p className="mt-2 text-sm text-slate-500">جارٍ التحميل…</p>
        ) : d.teachers.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">لا يوجد معلمون بعد. أنشئ رمزًا وأرسله لمعلم.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {d.teachers.map((t) => (
              <li key={t.uid} className="rounded-lg px-2 py-2 odd:bg-slate-50 dark:odd:bg-slate-800/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-xs text-slate-500">
                      <span dir="ltr">{t.email}</span> · {classesBy(t.uid)} فصل
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    className="min-h-9 px-2 text-sm text-rose-700 dark:text-rose-400"
                    onClick={async () => {
                      if (!window.confirm(`سحب صلاحية المعلم من ${t.name}؟ لن يستطيع إدارة فصوله.`)) return
                      await revokeTeacher(t.uid)
                      data.reload()
                    }}
                  >
                    سحب الصلاحية
                  </Button>
                </div>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="size-4 accent-teal-700"
                    checked={t.shareKey}
                    onChange={async (e) => {
                      await setTeacherShareKey(t.uid, e.target.checked)
                      data.reload()
                    }}
                  />
                  يستخدم مفتاح Gemini المشترك
                </label>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Expiry t={t} />
                  <select
                    className={`${select} py-1 text-xs`}
                    aria-label={`تمديد صلاحية ${t.name}`}
                    value=""
                    onChange={async (e) => {
                      const add = Number(e.target.value)
                      const label = durationLabel(add)
                      if (!window.confirm(add ? `تمديد صلاحية ${t.name} ${label}؟` : `جعل صلاحية ${t.name} بلا انتهاء؟`)) return
                      await extendTeacher(t, add)
                      data.reload()
                    }}
                  >
                    <option value="" disabled>
                      تمديد…
                    </option>
                    {DURATIONS.map((d) => (
                      <option key={d.days} value={d.days}>
                        {d.days ? `+ ${d.label}` : d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">كل الفصول</h2>
        {!d ? (
          <p className="mt-2 text-sm text-slate-500">جارٍ التحميل…</p>
        ) : d.classes.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">لا توجد فصول بعد.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {d.classes.map((c) => (
              <ClassRow key={c.code} c={c} teachers={d.teachers} open={() => openClass(c.code)} onChanged={data.reload} />
            ))}
          </ul>
        )}
      </Card>
    </Screen>
  )
}

/** الموارد المشتركة: قائمة الكلمات للجميع، مفتاح Gemini، وتجهيز شرح كل الكلمات. */
function SharedCard() {
  const state = useAsync(sharedState, [])
  const ready = useAsync(sharedCount, [])
  const prep = usePrepare()
  const [msg, setMsg] = useState<string | null>(null)
  const act = (fn: () => Promise<unknown>, ok: string) => async () => {
    setMsg(null)
    try {
      await fn()
      setMsg(ok)
      state.reload()
    } catch (e) {
      const code = (e as { code?: string })?.code
      setMsg(
        code === 'no_word_list'
          ? 'حمّل ملف قائمة الكلمات أولًا من الإعدادات في هذا الجهاز.'
          : code === 'no_gemini_key'
            ? 'أضف مفتاح Gemini أولًا من الإعدادات في هذا الجهاز.'
            : cloudErrorText(e),
      )
    }
  }
  const s = state.data
  return (
    <Card className="mb-4">
      <h2 className="text-lg font-bold">ما تشاركه مع الجميع</h2>
      {!s ? (
        <p className="mt-2 text-sm text-slate-500">{state.error ? cloudErrorText(state.error) : 'جارٍ التحميل…'}</p>
      ) : (
        <div className="mt-3 grid gap-4 text-sm">
          <section>
            <h3 className="font-semibold">قائمة الكلمات الكاملة</h3>
            <p className="text-slate-500">
              {s.wordlist ? `✓ مشتركة: ${s.wordlist.count} كلمة — كل من يسجّل الدخول يحصل عليها.` : 'غير مشتركة: الطلاب يرون ملف التجربة فقط (60 كلمة).'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-9 text-sm" onClick={act(shareWordList, '✓ شاركت قائمة الكلمات.')}>
                {s.wordlist ? 'حدّث القائمة المشتركة من هذا الجهاز' : 'شارك قائمتي مع الجميع'}
              </Button>
              {s.wordlist && (
                <Button variant="ghost" className="min-h-9 text-sm text-rose-700 dark:text-rose-400" onClick={act(unshareWordList, 'أوقفت مشاركة القائمة.')}>
                  إيقاف المشاركة
                </Button>
              )}
            </div>
          </section>

          <section>
            <h3 className="font-semibold">مفتاح Gemini المشترك</h3>
            <p className="text-slate-500">
              {s.key ? '✓ مرفوع — يستخدمه المعلمون المسموح لهم.' : 'غير مرفوع.'} المفتاح يصل لأجهزة من تسمح لهم، فشاركه مع من تثق بهم.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-9 text-sm" onClick={act(shareGeminiKey, '✓ رفعت مفتاحك.')}>
                {s.key ? 'حدّث المفتاح من هذا الجهاز' : 'ارفع مفتاحي'}
              </Button>
              {s.key && (
                <Button variant="ghost" className="min-h-9 text-sm text-rose-700 dark:text-rose-400" onClick={act(unshareGeminiKey, 'حذفت المفتاح المشترك.')}>
                  حذف المفتاح المشترك
                </Button>
              )}
            </div>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-teal-700"
                checked={s.studentsUseKey}
                onChange={(e) => void act(() => setStudentsUseKey(e.target.checked), e.target.checked ? '✓ الطلاب يستخدمون المفتاح الآن.' : 'أوقفت استخدام الطلاب للمفتاح.')()}
              />
              الطلاب أيضًا يستخدمون المفتاح (القصص اليومية وشرح الكلمات الناقصة)
            </label>
          </section>

          <section>
            <h3 className="font-semibold">شرح كل الكلمات للطلاب</h3>
            <p className="text-slate-500">
              كل شرح كلمة يُولَّد (منك أو من المعلمين) يُحفظ للجميع، فيتعلّم الطلاب بلا مفتاح.
              {ready.data != null && ` الجاهز الآن: ${ready.data} كلمة.`} التجهيز المسبق يستخدم مفتاحك وقد يأخذ أيامًا مع المفتاح المجاني (يكمل من حيث توقف).
            </p>
            {prep.total > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={prep.done} max={prep.total} label="تجهيز الكلمات" />
                <span className="shrink-0 tabular-nums text-slate-500">
                  {prep.done}/{prep.total}
                </span>
              </div>
            )}
            {prep.message && <p className="mt-1 text-slate-600 dark:text-slate-400">{prep.message}</p>}
            <div className="mt-2 flex gap-2">
              {prep.running ? (
                <Button variant="secondary" className="min-h-9 text-sm" onClick={stopPrepare}>
                  أوقف
                </Button>
              ) : (
                <Button variant="secondary" className="min-h-9 text-sm" onClick={() => void prepareAllWords().then(ready.reload)}>
                  {prep.total ? 'أكمل التجهيز' : 'جهّز كل الكلمات'}
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
      {msg && (
        <p aria-live="polite" className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {msg}
        </p>
      )}
    </Card>
  )
}

/** فصل في لوحة المالك: فتحه، نقله لمعلم آخر، وتعيين المعلمين المشاركين. */
function ClassRow({ c, teachers, open, onChanged }: { c: ClassInfo; teachers: Teacher[]; open: () => void; onChanged: () => void }) {
  const { profile } = useProfile()
  const [manage, setManage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  // المالك نفسه يمكن أن يكون معلم الفصل.
  const people = [...(profile ? [{ uid: profile.uid, name: profile.teacherName || 'أنت (المالك)' }] : []), ...teachers.map((t) => ({ uid: t.uid, name: t.name }))]
  const nameOf = (uid: string) => people.find((p) => p.uid === uid)?.name ?? c.teacherNames?.[uid] ?? (uid === c.teacherUid ? c.teacherName : uid)
  // يتغيّر فورًا في الواجهة، ويرجع كما كان إن فشل الحفظ.
  const [co, setCo] = useState(c.teachers ?? [])
  const run = async (fn: () => Promise<void>, undo?: () => void) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      undo?.()
      setMsg(cloudErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className="rounded-xl bg-slate-50 dark:bg-slate-800/60">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={open} className="min-w-0 flex-1 text-start">
          <span className="block font-semibold">{c.name}</span>
          <span className="block text-sm text-slate-500">
            المعلم: {c.teacherName || '—'}
            {co.length > 0 && ` + ${co.map(nameOf).join('، ')}`}
            {c.students !== undefined && ` · ${c.students} طالب`}
          </span>
        </button>
        <span dir="ltr" className="font-en tracking-widest text-slate-500">
          {formatCode(c.code)}
        </span>
        <Button variant="ghost" className="min-h-9 px-2 text-sm" aria-expanded={manage} onClick={() => setManage((m) => !m)}>
          إدارة
        </Button>
      </div>
      {manage && (
        <div className="grid gap-3 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
          <label className="grid gap-1">
            <span className="font-semibold">المعلم الرئيسي (نقل الفصل)</span>
            <select
              className={select}
              value={c.teacherUid}
              disabled={busy}
              onChange={(e) => {
                const to = people.find((p) => p.uid === e.target.value)
                if (!to || !window.confirm(`نقل «${c.name}» إلى ${to.name}؟ الطلاب والواجبات والنتائج تبقى كما هي.`)) return
                void run(() => transferClass(c.code, to, co.map((uid) => ({ uid, name: nameOf(uid) }))))
              }}
            >
              {!people.some((p) => p.uid === c.teacherUid) && <option value={c.teacherUid}>{c.teacherName}</option>}
              {people.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-1 font-semibold">معلمون مشاركون (يديرون الفصل والواجبات معه)</legend>
            {people.filter((p) => p.uid !== c.teacherUid).length === 0 ? (
              <p className="text-slate-500">لا يوجد معلمون آخرون بعد.</p>
            ) : (
              people
                .filter((p) => p.uid !== c.teacherUid)
                .map((p) => (
                  <label key={p.uid} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-teal-700"
                      disabled={busy}
                      checked={co.includes(p.uid)}
                      onChange={(e) => {
                        const before = co
                        const next = e.target.checked ? [...co, p.uid] : co.filter((x) => x !== p.uid)
                        setCo(next)
                        void run(
                          () => setCoTeachers(c.code, next.map((uid) => ({ uid, name: nameOf(uid) }))),
                          () => setCo(before),
                        )
                      }}
                    />
                    {p.name}
                  </label>
                ))
            )}
          </fieldset>
          {msg && <p className="text-rose-700 dark:text-rose-400">{msg}</p>}
        </div>
      )}
    </li>
  )
}
