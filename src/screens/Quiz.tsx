import { useEffect, useRef, useState } from 'react'
import { Button, Card, En, LevelBadge, ProgressBar, Screen, SpeakButtons } from '../components/ui'
import { DISTRACTOR_MEANINGS, contentFor, quizWordFor } from '../data/content'
import { saveQuizResult, updateSettings } from '../db/actions'
import type { QuizKind } from '../db/db'
import { useStats, useTodayPlan, useTodayStory } from '../db/hooks'
import { toDayKey } from '../lib/dates'
import { formatWords } from '../lib/format'
import { buildQuiz, grade, passed, score, type Grade, type Question, type QuestionType } from '../lib/quiz'
import { pickLevelTest, pickWeekly } from '../lib/selection'
import { RATE_NORMAL, speak, speechSupported, stopSpeaking } from '../lib/speech'
import { LEVELS, levelIndex, type Level, type Word } from '../lib/types'

const TITLES: Record<QuizKind, string> = {
  daily: 'الاختبار الشامل',
  weekly: 'الاختبار الأسبوعي',
  level: 'اختبار نهاية المستوى',
  mistakes: 'تدريب دفتر الأخطاء',
}

const TYPE_LABEL: Record<QuestionType, string> = {
  dictation: 'إملاء — استمع واكتب',
  arToEn: 'من العربي للإنجليزي',
  complete: 'أكمل الجملة',
  mcq: 'اختر المعنى',
}

const LIGHT_TYPES: QuestionType[] = ['mcq', 'arToEn', 'dictation']

function TypedAnswer({ q, response, result }: { q: Question; response: string; result: Grade }) {
  if (result.correct || q.type === 'mcq') return null
  const typed = response.trim()
  const at = result.mismatchAt
  return (
    <div className="mt-2 text-start">
      <p className="text-sm text-slate-500">كتبت:</p>
      <p dir="ltr" lang="en" className="font-en text-2xl">
        {typed ? (
          <>
            <span className="text-teal-700 dark:text-teal-400">{typed.slice(0, at)}</span>
            <span className="rounded bg-rose-100 px-0.5 text-rose-700 underline decoration-wavy dark:bg-rose-950 dark:text-rose-300">
              {typed[at] ?? '_'}
            </span>
            <span className="text-slate-400">{typed.slice(at + 1)}</span>
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </p>
    </div>
  )
}

function QuestionView({ q, onAnswered }: { q: Question; onAnswered: (correct: boolean) => void }) {
  const [response, setResponse] = useState('')
  const [result, setResult] = useState<Grade | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (q.type === 'dictation') speak(q.answer, RATE_NORMAL)
    inputRef.current?.focus()
  }, [q])

  useEffect(() => {
    if (result) nextRef.current?.focus()
  }, [result])

  function submit(value: string) {
    if (result || !value.trim()) return
    setResponse(value)
    setResult(grade(q, value))
  }

  const typing = q.type !== 'mcq'

  return (
    <Card>
      <p className="mb-4 inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {TYPE_LABEL[q.type]}
      </p>

      {q.type === 'dictation' && (
        <div className="mb-5 flex flex-col items-center gap-2">
          <p className="text-slate-600 dark:text-slate-400">استمع للكلمة واكتبها:</p>
          <SpeakButtons text={q.answer} />
        </div>
      )}
      {q.type === 'arToEn' && (
        <div className="mb-5 text-center">
          <p className="text-slate-600 dark:text-slate-400">اكتب بالإنجليزية:</p>
          <p className="mt-2 text-3xl font-semibold">{q.prompt}</p>
        </div>
      )}
      {q.type === 'complete' && (
        <div className="mb-5">
          <p dir="ltr" lang="en" className="font-en text-2xl leading-relaxed">
            {q.before}
            <span className="mx-1 inline-block min-w-16 border-b-2 border-teal-600 text-center text-teal-700 dark:text-teal-400">
              {result ? q.answer : ' '}
            </span>
            {q.after}
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{q.translation}</p>
        </div>
      )}
      {q.type === 'mcq' && (
        <div className="mb-5 text-center">
          <p dir="ltr" lang="en" className="font-en text-4xl font-semibold">
            {q.word}
          </p>
          <div className="mt-3 flex justify-center">
            <SpeakButtons text={q.word} compact />
          </div>
        </div>
      )}

      {typing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(response)
          }}
          className="flex flex-col items-center gap-3"
        >
          <input
            ref={inputRef}
            dir="ltr"
            lang="en"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            aria-label="إجابتك بالإنجليزية"
            value={response}
            readOnly={!!result}
            onChange={(e) => setResponse(e.target.value)}
            className={`font-en w-full max-w-sm rounded-xl bg-white px-4 py-3 text-center text-2xl ring-1 focus:ring-2 focus:outline-none dark:bg-slate-950 ${
              result
                ? result.correct
                  ? 'ring-teal-600'
                  : 'ring-rose-500'
                : 'ring-slate-300 focus:ring-teal-600 dark:ring-slate-700'
            }`}
          />
          {!result && (
            <Button type="submit" disabled={!response.trim()}>
              تحقّق
            </Button>
          )}
        </form>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {q.options.map((option) => {
            const chosen = result && option === response
            const isAnswer = result && option === q.answer
            return (
              <li key={option}>
                <button
                  type="button"
                  disabled={!!result}
                  onClick={() => submit(option)}
                  className={`min-h-12 w-full rounded-xl px-4 py-3 text-lg ring-1 transition ${
                    isAnswer
                      ? 'bg-teal-50 ring-2 ring-teal-600 dark:bg-teal-950/50'
                      : chosen
                        ? 'bg-rose-50 ring-2 ring-rose-500 dark:bg-rose-950/50'
                        : 'ring-slate-300 hover:bg-slate-100 disabled:hover:bg-transparent dark:ring-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  {option}
                  {isAnswer && <span className="sr-only"> (الإجابة الصحيحة)</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {result && (
        <div aria-live="polite" className="mt-5 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
          {result.correct ? (
            <p className="text-lg font-semibold text-teal-700 dark:text-teal-400">✓ صحيح</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-rose-700 dark:text-rose-400">✗ خطأ</p>
              <TypedAnswer q={q} response={response} result={result} />
              <p className="mt-2">
                الإجابة الصحيحة: <En className="text-xl font-semibold">{q.type === 'mcq' ? q.word : q.answer}</En>
                {q.type === 'mcq' && <> = {q.answer}</>}
              </p>
            </>
          )}
          <Button ref={nextRef} className="mt-4 min-w-32" onClick={() => onAnswered(result.correct)}>
            التالي
          </Button>
        </div>
      )}
    </Card>
  )
}

function Results({
  kind,
  level,
  questions,
  correctness,
  onExit,
  onRetry,
}: {
  kind: QuizKind
  level?: Level
  questions: Question[]
  correctness: boolean[]
  onExit: () => void
  onRetry: () => void
}) {
  const stats = useStats()
  const s = score(questions, correctness)
  const pct = Math.round((s.correct / Math.max(1, s.total)) * 100)
  const wrong = questions.filter((_, i) => !correctness[i])
  const next = level ? LEVELS[levelIndex(level) + 1] : undefined
  const canMoveOn =
    kind === 'level' && passed(s) && next && stats && levelIndex(stats.settings.startLevel!) <= levelIndex(level!)

  return (
    <Card className="text-center">
      <p className="text-slate-500">نتيجتك</p>
      <p className="my-1 text-5xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
        {s.correct}/{s.total}
      </p>
      <p className="text-lg">{pct >= 90 ? 'ممتاز! 🌟' : pct >= 70 ? 'أداء جيد 👍' : 'تحتاج مراجعة — ولا بأس، هذا هدف الاختبار.'}</p>

      {wrong.length > 0 && (
        <div className="mt-6 text-start">
          <h2 className="font-bold">
            {kind === 'mistakes' ? 'ما زالت في الدفتر' : 'أُضيفت إلى دفتر الأخطاء'} ({formatWords(wrong.length)})
          </h2>
          <p className="mb-2 text-sm text-slate-500">ستظهر أولًا في مراجعات الغد.</p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {wrong.map((q) => (
              <li key={q.wordId} className="flex items-center justify-between gap-3 py-2">
                <En className="text-lg font-semibold">{q.word}</En>
                <span className="text-slate-600 dark:text-slate-400">{contentFor(q.wordId)?.meaningAr ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canMoveOn && (
        <div className="mt-6 rounded-xl bg-teal-50 p-4 dark:bg-teal-950/40">
          <p className="font-semibold">
            نجحت في اختبار <LevelBadge level={level!} />. تقدر تنتقل إلى <LevelBadge level={next!} /> — القرار لك.
          </p>
          <Button className="mt-3" onClick={() => updateSettings({ startLevel: next! }).then(onExit)}>
            انتقل إلى {next}
          </Button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onExit}>رجوع</Button>
        <Button variant="secondary" onClick={onRetry}>
          أعد الاختبار
        </Button>
      </div>
    </Card>
  )
}

function useQuizWords(kind: QuizKind, level?: Level): Word[] | undefined {
  const stats = useStats()
  const plan = useTodayPlan()
  const [picked, setPicked] = useState<Word[]>()

  useEffect(() => {
    if (picked || !stats || (kind === 'daily' && plan === undefined)) return
    const byId = new Map(stats.words.map((w) => [w.id, w]))
    const lookup = (ids: string[]) => ids.map((id) => byId.get(id)).filter((w): w is Word => !!w)
    if (kind === 'daily') setPicked(lookup(plan?.doneIds ?? []))
    else if (kind === 'weekly') setPicked(lookup(pickWeekly(stats.progress, toDayKey(), Math.random)))
    else if (kind === 'mistakes') setPicked(lookup(stats.mistakes.map((m) => m.wordId)))
    else setPicked(pickLevelTest(stats.words, stats.progressMap, stats.settings.startLevel!, level!, Math.random))
  }, [kind, level, stats, plan, picked])

  return picked
}

export function Quiz({ kind, level, onExit }: { kind: QuizKind; level?: Level; onExit: () => void }) {
  const words = useQuizWords(kind, level)
  const story = useTodayStory()
  const storySentences =
    kind === 'daily' && story?.kind === 'advanced'
      ? story.sentences.map((s) => ({ en: s.text, ar: s.translation }))
      : []
  const [attempt, setAttempt] = useState(0)
  const [questions, setQuestions] = useState<Question[]>()
  const [correctness, setCorrectness] = useState<boolean[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!words || story === undefined || questions) return
    setQuestions(
      buildQuiz(words.map((w) => quizWordFor(w, storySentences)), {
        speech: speechSupported(),
        types: kind === 'weekly' ? LIGHT_TYPES : undefined,
        distractorPool: DISTRACTOR_MEANINGS,
      }),
    )
    setCorrectness([])
    setSaved(false)
  }, [words, attempt, kind, story, questions])

  function exit() {
    stopSpeaking()
    onExit()
  }

  const title = level ? `${TITLES[kind]} ${level}` : TITLES[kind]
  if (!questions) return null

  if (questions.length === 0) {
    return (
      <Screen title={title} onBack={exit}>
        <Card className="text-center text-slate-600 dark:text-slate-400">لا توجد كلمات لاختبارها الآن.</Card>
      </Screen>
    )
  }

  const index = correctness.length
  const finished = index >= questions.length

  async function answer(correct: boolean) {
    stopSpeaking()
    const next = [...correctness, correct]
    setCorrectness(next)
    if (next.length === questions!.length && !saved) {
      setSaved(true)
      const s = score(questions!, next)
      const correctIds = questions!.filter((_, i) => next[i]).map((q) => q.wordId)
      await saveQuizResult(kind, s, correctIds, level)
    }
  }

  return (
    <Screen title={title} onBack={exit}>
      {finished ? (
        <Results
          kind={kind}
          level={level}
          questions={questions}
          correctness={correctness}
          onExit={exit}
          onRetry={() => {
            setQuestions(undefined)
            setAttempt((a) => a + 1)
          }}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <ProgressBar value={index} max={questions.length} label="تقدّم الاختبار" />
            <span className="shrink-0 text-sm tabular-nums text-slate-500">
              {index + 1}/{questions.length}
            </span>
          </div>
          <QuestionView key={`${attempt}-${index}`} q={questions[index]} onAnswered={answer} />
        </>
      )}
    </Screen>
  )
}
