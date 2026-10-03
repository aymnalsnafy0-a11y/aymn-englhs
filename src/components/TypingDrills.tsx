import { useEffect, useRef, useState } from 'react'
import { firstMismatch, isExactMatch, letterStatuses } from '../lib/typing'
import { Button } from './ui'

const inputProps = {
  dir: 'ltr' as const,
  lang: 'en',
  autoCapitalize: 'none',
  autoCorrect: 'off',
  autoComplete: 'off',
  spellCheck: false,
}

/** المرحلة 4: الكلمة بحروف باهتة، وما يكتبه المتعلم يلوّنها حرفًا بحرف. */
export function TracingDrill({ target, onDone }: { target: string; onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const statuses = letterStatuses(target, typed)
  const done = isExactMatch(target, typed)
  const wrongCount = statuses.filter((s) => s === 'wrong').length

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (done) onDone()
  }, [done, onDone])

  const caret = (
    <span aria-hidden="true" className="caret-blink absolute -left-px bottom-2 top-2 w-0.5 rounded bg-teal-600 dark:bg-teal-400" />
  )

  return (
    <div>
      <p className="mb-3 text-slate-600 dark:text-slate-400">اكتب الكلمة فوق الحروف الباهتة.</p>
      <div
        className="relative rounded-2xl bg-slate-50 px-3 py-6 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-teal-600 dark:bg-slate-950 dark:ring-slate-800"
        onClick={() => inputRef.current?.focus()}
      >
        <div aria-hidden="true" dir="ltr" className="font-en flex flex-wrap justify-center text-4xl tracking-wide sm:text-5xl">
          {[...target].map((ch, i) => {
            const status = statuses[i]
            const shown = status === 'wrong' ? typed[i] : ch
            return (
              <span
                key={i}
                className={`relative inline-block min-w-[0.3em] whitespace-pre ${
                  status === 'correct'
                    ? 'text-teal-700 dark:text-teal-400'
                    : status === 'wrong'
                      ? 'rounded bg-rose-100 text-rose-700 underline decoration-rose-500 decoration-wavy dark:bg-rose-950 dark:text-rose-300'
                      : 'text-slate-300 dark:text-slate-700'
                }`}
              >
                {focused && i === typed.length && caret}
                {shown}
              </span>
            )
          })}
          {focused && typed.length >= target.length && <span className="relative inline-block w-1">{caret}</span>}
        </div>
        <input
          ref={inputRef}
          {...inputProps}
          aria-label={`اكتب الكلمة ${target}`}
          value={typed}
          maxLength={target.length}
          onChange={(e) => setTyped(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
      <p aria-live="polite" className="mt-3 min-h-6 text-center text-sm">
        {done ? (
          <span className="font-semibold text-teal-700 dark:text-teal-400">ممتاز! كتبتها صح ✓</span>
        ) : wrongCount > 0 ? (
          <span className="text-rose-700 dark:text-rose-400">في حرف غلط — امسحه وجرّب مرة ثانية.</span>
        ) : (
          <span className="text-slate-500">
            {typed.length}/{target.length}
          </span>
        )}
      </p>
    </div>
  )
}

type HiddenPhase = 'show' | 'hidden' | 'wrong' | 'right'

/** المرحلة 5: يُخفي الكلمة ويكتبها من الذاكرة؛ عند الخطأ يُظهر الحرف الخطأ بالضبط. */
export function HiddenDrill({ target, onDone }: { target: string; onDone: () => void }) {
  const [phase, setPhase] = useState<HiddenPhase>('show')
  const [value, setValue] = useState('')
  const [attempt, setAttempt] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase === 'hidden') inputRef.current?.focus()
  }, [phase])

  function check(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    if (isExactMatch(target, value)) {
      setPhase('right')
      onDone()
    } else {
      setAttempt(value.trim())
      setPhase('wrong')
    }
  }

  function retry() {
    setValue('')
    setPhase('hidden')
  }

  if (phase === 'show') {
    return (
      <div className="text-center">
        <p className="mb-3 text-slate-600 dark:text-slate-400">ركّز على الكلمة، ثم اضغط «إخفاء» واكتبها من ذاكرتك.</p>
        <p dir="ltr" lang="en" className="font-en my-6 text-5xl font-semibold">
          {target}
        </p>
        <Button onClick={() => setPhase('hidden')}>إخفاء</Button>
      </div>
    )
  }

  if (phase === 'right') {
    return (
      <div className="py-6 text-center" aria-live="polite">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 text-lg font-semibold text-teal-700 dark:text-teal-400">أحسنت! كتبتها من الذاكرة.</p>
        <p dir="ltr" lang="en" className="font-en mt-2 text-3xl">
          {target}
        </p>
      </div>
    )
  }

  if (phase === 'wrong') {
    const at = firstMismatch(target, attempt)
    const typedChar = attempt[at]
    const rightChar = target[at]
    const message =
      typedChar === undefined
        ? `ينقصك حرف عند الموضع ${at + 1}: الحرف الصحيح «${rightChar}».`
        : rightChar === undefined
          ? `كتبت حروفًا زائدة بعد نهاية الكلمة.`
          : `الحرف رقم ${at + 1}: كتبت «${typedChar}» والصحيح «${rightChar}».`
    return (
      <div className="text-center" aria-live="polite">
        <p className="mb-2 text-sm text-slate-500">كتبت:</p>
        <p dir="ltr" lang="en" className="font-en text-4xl">
          <span className="text-teal-700 dark:text-teal-400">{attempt.slice(0, at)}</span>
          <span className="rounded bg-rose-100 px-0.5 text-rose-700 underline decoration-wavy dark:bg-rose-950 dark:text-rose-300">
            {typedChar ?? '_'}
          </span>
          <span className="text-slate-400">{attempt.slice(at + 1)}</span>
        </p>
        <p className="mt-4 font-medium text-rose-700 dark:text-rose-400">{message}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={retry}>حاول مرة أخرى</Button>
          <Button variant="secondary" onClick={() => setPhase('show')}>
            أظهر الكلمة
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={check} className="text-center">
      <p className="mb-3 text-slate-600 dark:text-slate-400">اكتب الكلمة من ذاكرتك:</p>
      <p aria-hidden="true" dir="ltr" className="font-en mb-4 text-4xl tracking-[0.3em] text-slate-300 dark:text-slate-700">
        {'•'.repeat(target.length)}
      </p>
      <input
        ref={inputRef}
        {...inputProps}
        aria-label="اكتب الكلمة من الذاكرة"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-en w-full max-w-sm rounded-xl bg-white px-4 py-3 text-center text-3xl ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700"
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="submit" disabled={!value.trim()}>
          تحقّق
        </Button>
        <Button variant="secondary" onClick={() => setPhase('show')}>
          أظهر الكلمة
        </Button>
      </div>
    </form>
  )
}
