import { useMemo, useState } from 'react'
import { ExerciseView } from '../../components/ExerciseView'
import { Button, Card, En, ProgressBar, Screen } from '../../components/ui'
import { WordCard } from '../../components/WordCard'
import { distractorMeanings } from '../../data/content'
import { getAssignment, getMyResult, submitResult, type Assignment, type AssignmentWord } from '../../data/classroom'
import { completeWord } from '../../db/actions'
import { db } from '../../db/db'
import { buildQuiz, type Question, type QuizWord } from '../../lib/quiz'
import { speechSupported, stopSpeaking } from '../../lib/speech'
import { levelIndex, wordId, type Word } from '../../lib/types'
import { attemptsLabel, attemptsLeft } from '../../lib/classroom'
import { cloudErrorText, useAsync } from '../../lib/useAsync'
import { QuestionView } from '../Quiz'
import { exerciseLabel, type Exercise } from '../../lib/exercises'

type Item = { kind: 'ex'; ex: Exercise; index: number } | { kind: 'q'; q: Question }

const asWord = (w: AssignmentWord): Word => ({ id: wordId(w.word, w.pos), word: w.word, level: w.level, pos: w.pos, topic: 'general', order: 0 })

/** كلمة الواجب تدخل مراجعة الطالب الشخصية إن كانت في قائمته (مع شرحها الجاهز). */
async function addToMyReviews(w: AssignmentWord): Promise<void> {
  const local = (await db.words.toArray())
    .filter((x) => x.word.toLowerCase() === w.word.toLowerCase())
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level))[0]
  if (!local) return
  if (!(await db.content.get(local.id))) await db.content.put({ wordId: local.id, content: w.content, model: 'assignment', createdAt: Date.now() })
  if (!(await db.progress.get(local.id))) await completeWord(local.id)
}

export function DoAssignment({ code, id, onBack }: { code: string; id: string; onBack: () => void }) {
  const data = useAsync(async () => ({ a: await getAssignment(code, id), prev: await getMyResult(code, id) }), [code, id])
  if (data.loading) return <Screen title="الواجب" onBack={onBack}>{null}</Screen>
  if (data.error || !data.data?.a) {
    return (
      <Screen title="الواجب" onBack={onBack}>
        <Card className="text-rose-700 dark:text-rose-400">{data.error ? cloudErrorText(data.error) : 'الواجب غير موجود.'}</Card>
      </Screen>
    )
  }
  return <Runner code={code} a={data.data.a} prev={data.data.prev} onBack={onBack} />
}

function Runner({ code, a, prev, onBack }: { code: string; a: Assignment; prev: Awaited<ReturnType<typeof getMyResult>>; onBack: () => void }) {
  const [stage, setStage] = useState<'intro' | 'cards' | 'test' | 'result'>('intro')
  const [card, setCard] = useState(0)
  const [answers, setAnswers] = useState<boolean[]>([])
  const [attempt, setAttempt] = useState(0)
  const [saved, setSaved] = useState<{ score: number; total: number; best: number; attempts: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // المحاولات المستخدمة (من الخادم ثم تزيد مع كل إرسال).
  const [used, setUsed] = useState(prev?.attempts ?? 0)
  const left = attemptsLeft(a, { attempts: used })

  const items = useMemo<Item[]>(() => {
    const exItems: Item[] = (a.exercises ?? []).map((ex, index) => ({ kind: 'ex', ex, index }))
    const quizWords: QuizWord[] = a.words.map((w) => ({ id: w.word, word: w.word, meaningAr: w.content.meaningAr, sentences: w.content.examples }))
    const wordItems: Item[] = buildQuiz(quizWords, {
      speech: speechSupported(),
      types: ['mcq', 'arToEn', 'complete', ...(speechSupported() ? (['dictation'] as const) : [])],
      distractorPool: [...a.words.map((w) => w.content.meaningAr), ...distractorMeanings()],
    }).map((q) => ({ kind: 'q', q }))
    return [...exItems, ...wordItems]
    // كل محاولة جديدة تخلط الأسئلة من جديد
  }, [a, attempt])

  function exit() {
    stopSpeaking()
    onBack()
  }

  async function finish(all: boolean[]) {
    setStage('result')
    const wrong: string[] = []
    const wrongQ: number[] = []
    items.forEach((it, i) => {
      if (all[i]) return
      if (it.kind === 'ex') wrongQ.push(it.index)
      else wrong.push(it.q.word)
    })
    const score = all.filter(Boolean).length
    try {
      const r = await submitResult(code, a.id, score, items.length, wrong, wrongQ)
      setUsed(r.attempts)
      setSaved({ score, total: items.length, best: r.best, attempts: r.attempts })
    } catch (e) {
      setSaved({ score, total: items.length, best: score, attempts: 1 })
      setSaveError(cloudErrorText(e))
    }
  }

  if (stage === 'intro') {
    return (
      <Screen title={a.title} onBack={exit}>
        <Card>
          {a.note && <p className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">📌 {a.note}</p>}
          {a.summary && <p className="mb-3 text-slate-600 dark:text-slate-400">{a.summary}</p>}
          <ul className="mb-4 grid gap-1 text-sm">
            {a.words.length > 0 && <li>🃏 {a.words.length} كلمة تحفظها ببطاقات</li>}
            {(a.exercises?.length ?? 0) > 0 && <li>✍️ {a.exercises!.length} تمرين على الدرس</li>}
            {a.dueAt && (
              <li>
                ⏰ التسليم: <span dir="ltr">{a.dueAt}</span>
              </li>
            )}
          </ul>
          {a.maxAttempts ? <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">🔁 {attemptsLabel(a.maxAttempts)}</p> : null}
          {prev && (
            <p className="mb-4 text-sm text-teal-700 dark:text-teal-400">
              حلّيته من قبل: آخر نتيجة {prev.score}/{prev.total} · أفضل نتيجة {prev.best} · {prev.attempts} محاولة
            </p>
          )}
          {left === 0 ? (
            <p className="rounded-xl bg-slate-100 p-3 text-center text-sm dark:bg-slate-800">
              {a.maxAttempts === 1 ? 'هذا الواجب يُحل مرة واحدة فقط، وقد حللته.' : 'استخدمت كل المحاولات المسموحة لهذا الواجب.'}
            </p>
          ) : (
            <Button className="w-full" onClick={() => setStage(a.words.length ? 'cards' : 'test')}>
              {prev ? `أعد المحاولة${left !== null ? ` (باقي ${left})` : ''}` : 'ابدأ الواجب'}
            </Button>
          )}
        </Card>
      </Screen>
    )
  }

  if (stage === 'cards') {
    const w = a.words[card]
    const next = () => {
      stopSpeaking()
      void addToMyReviews(w)
      if (card + 1 < a.words.length) setCard(card + 1)
      else setStage('test')
    }
    return (
      <Screen title={`كلمة ${card + 1} من ${a.words.length}`} onBack={exit}>
        <WordCard key={w.word} word={asWord(w)} content={w.content} onFinish={next} onKnown={next} />
        <div className="mt-3 text-center">
          <Button variant="ghost" onClick={() => setStage('test')}>
            تخطَّ البطاقات وابدأ الأسئلة
          </Button>
        </div>
      </Screen>
    )
  }

  if (stage === 'test') {
    const i = answers.length
    const it = items[i]
    const answer = (correct: boolean) => {
      stopSpeaking()
      const all = [...answers, correct]
      setAnswers(all)
      if (all.length === items.length) void finish(all)
    }
    return (
      <Screen title={a.title} onBack={exit}>
        <div className="mb-4 flex items-center gap-3">
          <ProgressBar value={i} max={items.length} label="تقدّم الواجب" />
          <span className="shrink-0 text-sm tabular-nums text-slate-500">
            {i + 1}/{items.length}
          </span>
        </div>
        {it.kind === 'ex' ? (
          <ExerciseView key={`${attempt}-${i}`} ex={it.ex} onAnswered={answer} />
        ) : (
          <QuestionView key={`${attempt}-${i}`} q={it.q} onAnswered={answer} />
        )}
      </Screen>
    )
  }

  const wrongItems = items.filter((_, i) => !answers[i])
  return (
    <Screen title={a.title} onBack={exit}>
      <Card className="text-center">
        <p className="text-slate-500">نتيجتك</p>
        <p className="my-1 text-5xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
          {answers.filter(Boolean).length}/{items.length}
        </p>
        <p aria-live="polite" className="text-sm">
          {saveError ? (
            <span className="text-rose-700 dark:text-rose-400">لم تُرسل النتيجة للمدرس: {saveError}</span>
          ) : saved ? (
            <span className="text-teal-700 dark:text-teal-400">✓ أُرسلت نتيجتك للمدرس · أفضل نتيجة {saved.best} · محاولة {saved.attempts}</span>
          ) : (
            'نرسل نتيجتك للمدرس…'
          )}
        </p>
        {wrongItems.length > 0 && (
          <div className="mt-5 text-start">
            <h2 className="mb-2 font-bold">راجع هذه</h2>
            <ul className="grid gap-1 text-sm">
              {wrongItems.map((it, k) => (
                <li key={k} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                  {it.kind === 'ex' ? (
                    <En>{exerciseLabel(it.ex)}</En>
                  ) : (
                    <>
                      <En className="font-semibold">{it.q.word}</En>
                      <span className="ms-2">{a.words.find((w) => w.word === it.q.word)?.content.meaningAr}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={exit}>رجوع للواجبات</Button>
          {left !== 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers([])
                setSaved(null)
                setSaveError(null)
                setAttempt((n) => n + 1)
                setStage('test')
              }}
            >
              أعد المحاولة{left !== null ? ` (باقي ${left})` : ''}
            </Button>
          )}
        </div>
      </Card>
    </Screen>
  )
}
