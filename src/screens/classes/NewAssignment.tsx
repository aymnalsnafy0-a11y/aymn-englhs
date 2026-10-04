import { useRef, useState } from 'react'
import { validateExercise } from '../../../server/exercises'
import { Button, Card, Screen } from '../../components/ui'
import { postAi } from '../../data/ai'
import { createAssignment, type AssignmentWord } from '../../data/classroom'
import { db } from '../../db/db'
import { useSettings } from '../../db/hooks'
import { MAX_ASSIGNMENT_WORDS } from '../../lib/classroom'
import { EXERCISE_TYPES, TYPE_LABEL, type Exercise, type ExerciseType } from '../../lib/exercises'
import { prepareImage, type PreparedImage } from '../../lib/image'
import { LEVELS, levelIndex, type Level } from '../../lib/types'

const field =
  'w-full min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700'
const MAX_IMAGES = 6

const AI_ERRORS: Record<string, string> = {
  not_configured: 'أضف مفتاح Gemini من الإعدادات أولًا (يُستخدم لتجهيز الواجب مرة واحدة).',
  unavailable: 'خدمة Gemini مزدحمة الآن. جرّب بعد دقيقة.',
  provider_rejected: 'رفض Gemini الطلب. تأكد من المفتاح في الإعدادات.',
  bad_request: 'أضف صور الدرس أو اكتب ملاحظاته أولًا.',
}

function ExerciseEditor({ ex, index, onChange, onRemove }: { ex: Exercise; index: number; onChange: (e: Exercise) => void; onRemove: () => void }) {
  const valid = !!validateExercise({ ...ex, answer: ex.type === 'tf' ? String(ex.answer) : ex.type === 'mcq' ? String(ex.answer) : undefined })
  return (
    <li>
      <Card className={valid ? '' : 'ring-2 ring-rose-400'}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-500">
            {index + 1}. {TYPE_LABEL[ex.type]}
          </span>
          <Button variant="ghost" className="min-h-9 text-sm text-rose-700 dark:text-rose-400" onClick={onRemove} aria-label={`احذف التمرين ${index + 1}`}>
            حذف
          </Button>
        </div>
        <div className="grid gap-2" dir="ltr">
          {ex.type !== 'order' && (
            <input className={`${field} font-en`} aria-label="نص السؤال" value={ex.q} onChange={(e) => onChange({ ...ex, q: e.target.value })} />
          )}
          {ex.type === 'mcq' &&
            ex.options.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input type="radio" name={`ans-${index}`} checked={ex.answer === i} onChange={() => onChange({ ...ex, answer: i })} className="size-4 accent-teal-700" aria-label={`الخيار ${i + 1} هو الصحيح`} />
                <input
                  className={`${field} font-en`}
                  aria-label={`الخيار ${i + 1}`}
                  value={o}
                  onChange={(e) => onChange({ ...ex, options: ex.options.map((x, j) => (j === i ? e.target.value : x)) })}
                />
              </label>
            ))}
          {ex.type === 'tf' && (
            <div className="flex gap-2" dir="rtl">
              {[true, false].map((v) => (
                <Button key={String(v)} variant={ex.answer === v ? 'primary' : 'secondary'} onClick={() => onChange({ ...ex, answer: v })}>
                  {v ? 'الإجابة: صح' : 'الإجابة: خطأ'}
                </Button>
              ))}
            </div>
          )}
          {ex.type === 'fill' && (
            <input
              className={`${field} font-en`}
              aria-label="الإجابات المقبولة (افصل بفاصلة)"
              placeholder="answers, separated, by commas"
              value={ex.answers.join(', ')}
              onChange={(e) => onChange({ ...ex, answers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          )}
          {ex.type === 'order' && (
            <>
              <input
                className={`${field} font-en`}
                aria-label="الجملة الصحيحة"
                value={ex.words.join(' ')}
                onChange={(e) => onChange({ ...ex, words: e.target.value.split(/\s+/).filter(Boolean) })}
              />
              <input dir="rtl" className={field} aria-label="معنى الجملة بالعربية" value={ex.q ?? ''} onChange={(e) => onChange({ ...ex, q: e.target.value })} />
            </>
          )}
          <input dir="rtl" className={field} aria-label="شرح الإجابة" placeholder="شرح الإجابة (يظهر للطالب)" value={ex.explain ?? ''} onChange={(e) => onChange({ ...ex, explain: e.target.value })} />
        </div>
        {!valid && <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">هذا التمرين غير مكتمل — صحّحه أو احذفه.</p>}
      </Card>
    </li>
  )
}

export function NewAssignment({ code, onBack, onDone }: { code: string; onBack: () => void; onDone: () => void }) {
  const settings = useSettings()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState<PreparedImage[]>([])
  const [level, setLevel] = useState<Level | ''>('')
  const [count, setCount] = useState(10)
  const [types, setTypes] = useState<ExerciseType[]>(EXERCISE_TYPES)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [summary, setSummary] = useState('')
  const [wordsText, setWordsText] = useState('')
  const [words, setWords] = useState<AssignmentWord[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lvl: Level = level || settings?.startLevel || 'A2'

  async function addImages(files: FileList) {
    const room = MAX_IMAGES - images.length
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)
    setBusy('نجهّز الصور…')
    try {
      const prepared = await Promise.all(picked.map((f) => prepareImage(f)))
      setImages((im) => [...im, ...prepared])
    } catch {
      setMsg('تعذّر قراءة إحدى الصور.')
    } finally {
      setBusy(null)
    }
  }

  async function generate() {
    setBusy('يقرأ الدرس ويكتب التمارين… (حوالي 10–40 ثانية)')
    setMsg(null)
    const res = await postAi('exercises', {
      level: lvl,
      count,
      types,
      notes,
      images: images.map(({ mime, data }) => ({ mime, data })),
    })
    setBusy(null)
    if (!res.ok) return setMsg(AI_ERRORS[res.json?.error] ?? 'تعذّر توليد التمارين. حاول مرة أخرى.')
    if (!res.json.exercises?.length) return setMsg(res.json.summary || 'لم نستطع استخراج تمارين من هذه المادة. جرّب صورًا أوضح أو أضف ملاحظات.')
    setExercises((ex) => [...ex, ...res.json.exercises])
    if (!title) setTitle(res.json.title)
    if (!summary) setSummary(res.json.summary)
  }

  async function prepareWords() {
    const list = [...new Set(wordsText.split(/[\n,،]+/).map((w) => w.trim()).filter((w) => /^[A-Za-z][A-Za-z' -]{0,24}$/.test(w)))]
    if (list.length === 0) return setMsg('اكتب كلمات إنجليزية (كل كلمة في سطر).')
    if (list.length > MAX_ASSIGNMENT_WORDS) return setMsg(`الحد ${MAX_ASSIGNMENT_WORDS} كلمة في الواجب.`)
    setBusy('نجهّز شرح الكلمات…')
    setMsg(null)
    const all = await db.words.toArray()
    const items = list.map((w) => {
      const match = all.filter((x) => x.word.toLowerCase() === w.toLowerCase()).sort((a, b) => levelIndex(a.level) - levelIndex(b.level))[0]
      return { word: match?.word ?? w, pos: match?.pos ?? '', level: match?.level ?? lvl }
    })
    const ready: AssignmentWord[] = []
    const failed: string[] = []
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10)
      const res = await postAi('content', { words: batch.map((b) => ({ word: b.word, pos: b.pos || undefined, level: b.level })) })
      if (!res.ok) {
        setBusy(null)
        return setMsg(AI_ERRORS[res.json?.error] ?? 'تعذّر تجهيز الكلمات.')
      }
      batch.forEach((b, j) => {
        const c = res.json.items?.[j]
        if (c) {
          const { topic: _topic, ...content } = c
          ready.push({ ...b, content })
        } else failed.push(b.word)
      })
    }
    setBusy(null)
    setWords(ready)
    if (failed.length) setMsg(`لم نستطع تجهيز: ${failed.join('، ')}`)
  }

  async function publish() {
    const invalid = exercises.findIndex(
      (ex) => !validateExercise({ ...ex, answer: ex.type === 'mcq' || ex.type === 'tf' ? String(ex.answer) : undefined }),
    )
    if (invalid !== -1) return setMsg(`صحّح التمرين رقم ${invalid + 1} أو احذفه.`)
    if (!exercises.length && !words.length) return setMsg('الواجب فارغ: ولّد تمارين أو جهّز كلمات.')
    setBusy('ننشر الواجب…')
    try {
      await createAssignment(code, {
        title: title.trim() || 'واجب',
        note: note.trim() || undefined,
        summary: summary || undefined,
        dueAt: dueAt || undefined,
        words,
        exercises,
      })
      onDone()
    } catch {
      setBusy(null)
      setMsg('تعذّر النشر. تأكد من الاتصال وحاول مرة أخرى.')
    }
  }

  return (
    <Screen title="واجب جديد" onBack={onBack}>
      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-bold">١. مادة الدرس</h2>
        <p className="mb-3 text-sm text-slate-500">صوّر السبورة أو الشرائح أو صفحات الكتاب، و/أو اكتب ما شرحته. الصور تُستخدم للتوليد فقط ولا تُحفظ.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="صور الدرس"
          onChange={(e) => {
            if (e.target.files?.length) void addImages(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((im, i) => (
            <div key={i} className="relative">
              <img src={im.url} alt={`صورة الدرس ${i + 1}`} className="size-24 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
              <button
                type="button"
                onClick={() => setImages((list) => list.filter((_, j) => j !== i))}
                className="absolute -end-2 -top-2 flex size-7 items-center justify-center rounded-full bg-rose-600 text-white"
                aria-label={`احذف الصورة ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="text-2xl">📷</span>
              أضف صورة
            </button>
          )}
        </div>
        <textarea
          className={`${field} min-h-24`}
          aria-label="ملاحظات الدرس"
          placeholder="ملاحظات الدرس (اختياري): ماذا شرحت؟ ماذا تريد التركيز عليه؟"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={8000}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-sm">
            مستوى الطلاب
            <select className={`${field} mt-1`} value={lvl} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            عدد التمارين
            <select className={`${field} mt-1`} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 8, 10, 15, 20].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend>الأنواع</legend>
            <div className="mt-1 flex flex-wrap gap-x-3">
              {EXERCISE_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="accent-teal-700"
                    checked={types.includes(t)}
                    onChange={(e) => setTypes((ts) => (e.target.checked ? [...ts, t] : ts.filter((x) => x !== t)))}
                  />
                  {TYPE_LABEL[t]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <Button className="mt-4 w-full" disabled={!!busy || (!notes.trim() && !images.length) || !types.length} onClick={() => void generate()}>
          {exercises.length ? '+ ولّد تمارين إضافية' : '✨ ولّد التمارين من الدرس'}
        </Button>
      </Card>

      {exercises.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-1 text-lg font-bold">٢. راجع التمارين ({exercises.length})</h2>
          <p className="mb-3 text-sm text-slate-500">عدّل أي سؤال أو احذفه قبل النشر.</p>
          {summary && <Card className="mb-3 bg-teal-50 text-sm dark:bg-teal-950/30">ملخص الدرس: {summary}</Card>}
          <ul className="grid gap-3">
            {exercises.map((ex, i) => (
              <ExerciseEditor
                key={i}
                ex={ex}
                index={i}
                onChange={(next) => setExercises((list) => list.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setExercises((list) => list.filter((_, j) => j !== i))}
              />
            ))}
          </ul>
        </section>
      )}

      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-bold">كلمات الدرس (اختياري)</h2>
        <p className="mb-3 text-sm text-slate-500">يحفظها الطلاب ببطاقات ثم تُختبر. اكتب كل كلمة في سطر.</p>
        <textarea className={`${field} font-en min-h-20`} dir="ltr" aria-label="كلمات الدرس" placeholder={'running\nswimming\nat the moment'} value={wordsText} onChange={(e) => setWordsText(e.target.value)} />
        <Button variant="secondary" className="mt-2" disabled={!!busy || !wordsText.trim()} onClick={() => void prepareWords()}>
          جهّز شرح الكلمات
        </Button>
        {words.length > 0 && (
          <ul className="mt-3 grid gap-1 text-sm">
            {words.map((w) => (
              <li key={w.word} className="flex justify-between gap-2">
                <span dir="ltr" className="font-en font-semibold">
                  {w.word}
                </span>
                <span>{w.content.meaningAr}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">٣. النشر</h2>
        <div className="grid gap-2">
          <input className={field} aria-label="عنوان الواجب" placeholder="عنوان الواجب" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <input className={field} aria-label="ملاحظة للطلاب" placeholder="ملاحظة للطلاب (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <label className="text-sm">
            موعد التسليم (اختياري)
            <input type="date" className={`${field} mt-1`} value={dueAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueAt(e.target.value)} />
          </label>
        </div>
        <Button className="mt-4 w-full" disabled={!!busy || (!exercises.length && !words.length)} onClick={() => void publish()}>
          انشر الواجب للطلاب
        </Button>
      </Card>

      {(busy || msg) && (
        <p aria-live="polite" className="sticky bottom-2 rounded-xl bg-slate-900/90 p-3 text-center text-sm text-white dark:bg-slate-100/90 dark:text-slate-900">
          {busy ?? msg}
        </p>
      )}
    </Screen>
  )
}
