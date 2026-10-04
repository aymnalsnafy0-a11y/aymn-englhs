import { useEffect, useMemo, useRef, useState } from 'react'
import { BLANK, correctAnswerText, gradeExercise, scramble, splitPrompt, TYPE_LABEL, type Exercise, type ExerciseResponse } from '../lib/exercises'
import { Button, Card, En } from './ui'

/** تمرين واحد من تمارين الدرس: إجابة، تصحيح فوري مع الشرح، ثم «التالي». */
export function ExerciseView({ ex, onAnswered }: { ex: Exercise; onAnswered: (correct: boolean) => void }) {
  const [response, setResponse] = useState<ExerciseResponse | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [typed, setTyped] = useState('')
  const [built, setBuilt] = useState<number[]>([])
  const pool = useMemo(() => (ex.type === 'order' ? scramble(ex.words) : []), [ex])
  const nextRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [ex])
  useEffect(() => {
    if (correct !== null) nextRef.current?.focus()
  }, [correct])

  function answer(value: ExerciseResponse) {
    if (correct !== null) return
    setResponse(value)
    setCorrect(gradeExercise(ex, value))
  }

  const done = correct !== null
  const { ask, body } = splitPrompt(ex)
  const choice = (label: string, value: number | boolean, isAnswer: boolean, key: string) => {
    const chosen = done && response === value
    return (
      <button
        key={key}
        type="button"
        disabled={done}
        onClick={() => answer(value)}
        className={`min-h-12 w-full rounded-xl px-4 py-3 text-start text-lg ring-1 transition ${
          done && isAnswer
            ? 'bg-teal-50 ring-2 ring-teal-600 dark:bg-teal-950/50'
            : chosen
              ? 'bg-rose-50 ring-2 ring-rose-500 dark:bg-rose-950/50'
              : 'ring-slate-300 hover:bg-slate-100 disabled:hover:bg-transparent dark:ring-slate-700 dark:hover:bg-slate-800'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <Card>
      <p className="mb-2 inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {TYPE_LABEL[ex.type]}
      </p>
      {/* المطلوب أولًا (عنوان)، ثم جملة الدرس وحدها */}
      <h2 dir="auto" className="mb-4 text-lg font-bold">
        {ask}
      </h2>

      {ex.type === 'mcq' && (
        <>
          <p dir="ltr" lang="en" className="font-en mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xl leading-relaxed dark:bg-slate-800/60">
            {body}
          </p>
          <div dir="ltr" className="grid gap-2 sm:grid-cols-2">
            {ex.options.map((o, i) => choice(o, i, i === ex.answer, String(i)))}
          </div>
        </>
      )}

      {ex.type === 'tf' && (
        <>
          <p dir="ltr" lang="en" className="font-en mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xl leading-relaxed dark:bg-slate-800/60">
            {body}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {choice('✓ صح', true, ex.answer === true, 't')}
            {choice('✗ خطأ', false, ex.answer === false, 'f')}
          </div>
        </>
      )}

      {ex.type === 'fill' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) answer(typed)
          }}
        >
          <p dir="ltr" lang="en" className="font-en mb-3 rounded-xl bg-slate-50 px-4 py-3 text-xl leading-relaxed dark:bg-slate-800/60">
            {body.split(BLANK)[0]}
            <span className="mx-1 inline-block min-w-16 border-b-2 border-teal-600 text-center text-teal-700 dark:text-teal-400">
              {done ? correctAnswerText(ex) : ' '}
            </span>
            {body.split(BLANK)[1]}
          </p>
          {ex.hint && <p className="mb-3 text-sm text-slate-500">💡 {ex.hint}</p>}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              dir="ltr"
              lang="en"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label="إجابتك"
              value={typed}
              readOnly={done}
              onChange={(e) => setTyped(e.target.value)}
              className={`font-en min-w-0 flex-1 rounded-xl bg-white px-4 py-2 text-xl ring-1 focus:ring-2 focus:outline-none dark:bg-slate-950 ${
                done ? (correct ? 'ring-teal-600' : 'ring-rose-500') : 'ring-slate-300 focus:ring-teal-600 dark:ring-slate-700'
              }`}
            />
            {!done && (
              <Button type="submit" disabled={!typed.trim()}>
                تحقّق
              </Button>
            )}
          </div>
        </form>
      )}

      {ex.type === 'order' && (
        <div>
          {body && <p className="mb-3 text-slate-600 dark:text-slate-400">المعنى: «{body}»</p>}
          <div
            dir="ltr"
            className={`font-en mb-3 flex min-h-14 flex-wrap items-center gap-2 rounded-xl p-2 ring-1 ${
              done ? (correct ? 'ring-teal-600' : 'ring-rose-500') : 'ring-slate-300 dark:ring-slate-700'
            }`}
            aria-label="جملتك"
          >
            {built.map((idx, pos) => (
              <button
                key={pos}
                type="button"
                disabled={done}
                onClick={() => setBuilt((b) => b.filter((_, i) => i !== pos))}
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-lg text-white dark:bg-teal-600"
              >
                {pool[idx]}
              </button>
            ))}
            {built.length === 0 && <span className="px-2 text-sm text-slate-400">اضغط الكلمات بالترتيب</span>}
          </div>
          <div dir="ltr" className="font-en flex flex-wrap gap-2">
            {pool.map((w, idx) => (
              <button
                key={idx}
                type="button"
                disabled={done || built.includes(idx)}
                onClick={() => setBuilt((b) => [...b, idx])}
                className="rounded-lg px-3 py-1.5 text-lg ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-30 dark:ring-slate-700 dark:hover:bg-slate-800"
              >
                {w}
              </button>
            ))}
          </div>
          {!done && (
            <Button className="mt-3" disabled={built.length !== pool.length} onClick={() => answer(built.map((i) => pool[i]))}>
              تحقّق
            </Button>
          )}
        </div>
      )}

      {done && (
        <div aria-live="polite" className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className={`text-lg font-semibold ${correct ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {correct ? '✓ صحيح' : '✗ خطأ'}
          </p>
          {!correct && ex.type !== 'mcq' && ex.type !== 'tf' && (
            <p className="mt-1">
              الإجابة الصحيحة: <En className="text-lg font-semibold">{correctAnswerText(ex)}</En>
            </p>
          )}
          {ex.explain && <p className="mt-2 text-slate-600 dark:text-slate-400">{ex.explain}</p>}
          <Button ref={nextRef} className="mt-4 min-w-32" onClick={() => onAnswered(!!correct)}>
            التالي
          </Button>
        </div>
      )}
    </Card>
  )
}
