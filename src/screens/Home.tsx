import { useEffect, useState } from 'react'
import { useCloudStatus } from '../data/cloud'
import { pendingHomework } from '../data/classroom'
import { Button, Card, LevelBadge, ProgressBar, Screen } from '../components/ui'
import { SetupCard } from '../components/AiSettings'
import { ensureContent } from '../data/content'
import { syncTodayPlan } from '../db/actions'
import { classifyTopicsInBackground } from '../db/topicsJob'
import { db, type QuizKind } from '../db/db'
import { useQuizzes, useSaved, useStats, useStreak, useTodayPlan, useTodayStory } from '../db/hooks'
import { toDayKey } from '../lib/dates'
import { formatWords } from '../lib/format'
import { weeklyDue } from '../lib/selection'
import { suggestedNewCount } from '../lib/srs'

type Go = (screen: 'learn' | 'review' | 'settings' | 'progress' | 'mistakes' | 'library' | 'classes') => void

function Step({
  index,
  title,
  detail,
  done,
  action,
}: {
  index: number
  title: string
  detail: string
  done?: boolean
  action?: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {done ? '✓' : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-slate-500">{detail}</p>
      </div>
      {action}
    </li>
  )
}

export function Home({
  go,
  startQuiz,
  openStory,
  openStudentClass,
}: {
  go: Go
  startQuiz: (kind: QuizKind) => void
  openStory: () => void
  openStudentClass: (code: string) => void
}) {
  const cloud = useCloudStatus()
  const [homework, setHomework] = useState<{ count: number; firstCode?: string }>({ count: 0 })
  useEffect(() => {
    if (cloud.state === 'signedIn') void pendingHomework().then(setHomework).catch(() => {})
  }, [cloud.state])
  const stats = useStats()
  const plan = useTodayPlan()
  const streak = useStreak()
  const quizzes = useQuizzes()
  const story = useTodayStory()
  const saved = useSaved()

  useEffect(() => {
    // نجهّز الخطة ثم محتوى كلماتها في الخلفية حتى تكون البطاقات جاهزة عند فتحها.
    void syncTodayPlan().then(async (plan) => {
      if (!plan) return
      const words = (await db.words.bulkGet(plan.wordIds)).filter((w) => !!w)
      void ensureContent(words)
      void classifyTopicsInBackground()
    })
  }, [])

  if (!stats || !quizzes) return null
  const { known, total, levels, due, settings, mistakes } = stats
  const newTotal = plan?.wordIds.length ?? 0
  const newDone = plan?.doneIds.length ?? 0
  const suggestion = suggestedNewCount(due.length, plan?.targetCount ?? settings.dailyCount)
  const reviewsDone = due.length === 0
  const newWordsDone = newTotal > 0 && newDone >= newTotal
  const quizReady = newDone > 0 && newDone >= newTotal
  const lastWeekly = quizzes.find((q) => q.kind === 'weekly')?.date
  const showWeekly = weeklyDue(stats.progress, lastWeekly, toDayKey())

  return (
    <Screen>
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-teal-700 dark:text-teal-400">سياق</span>
          <LevelBadge level={settings.startLevel!} />
        </div>
        <nav className="flex items-center gap-1" aria-label="التنقل">
          {streak && streak.current > 0 && (
            <span className="me-1 text-sm font-semibold text-amber-700 dark:text-amber-400" title="أيام متتالية">
              🔥 {streak.current}
            </span>
          )}
          <Button variant="ghost" onClick={() => go('classes')}>
            الفصول
          </Button>
          <Button variant="ghost" onClick={() => go('progress')}>
            تقدّمي
          </Button>
          <Button variant="ghost" onClick={() => go('settings')} aria-label="الإعدادات">
            <span aria-hidden="true">⚙︎</span>
          </Button>
        </nav>
      </header>

      <Card className="mb-4 text-center">
        <p className="text-slate-500">تعرف</p>
        <p className="my-1 text-5xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{known}</p>
        <p className="text-slate-500">من {total} كلمة</p>
        <ul className="mt-5 grid gap-2 text-start">
          {levels
            .filter((l) => l.total > 0)
            .map((l) => (
              <li key={l.level} className="flex items-center gap-3">
                <LevelBadge level={l.level} />
                <ProgressBar value={l.known} max={l.total} label={`المعروف في ${l.level}`} />
                <span className="w-16 shrink-0 text-sm tabular-nums text-slate-500">
                  {l.known}/{l.total}
                </span>
              </li>
            ))}
        </ul>
      </Card>

      <SetupCard onOpenSettings={() => go('settings')} />

      {homework.count > 0 && (
        <button
          type="button"
          onClick={() => (homework.firstCode ? openStudentClass(homework.firstCode) : go('classes'))}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 text-start ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-amber-950/30 dark:ring-amber-800"
        >
          <span>
            <span className="block font-bold">📚 عندك {homework.count === 1 ? 'واجب جديد' : `${homework.count} واجبات`} من المدرس</span>
            <span className="block text-sm text-slate-600 dark:text-slate-400">اضغط لتحلّه</span>
          </span>
          <span aria-hidden="true">←</span>
        </button>
      )}

      {saved && saved.some((s) => !stats.progressMap.has(s.wordId)) && (
        <p className="mb-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
          كلمات حفظتها من المتصفح تنتظر خطتك:{' '}
          <span dir="ltr" className="font-en">
            {saved
              .filter((s) => !stats.progressMap.has(s.wordId))
              .map((s) => s.word)
              .join(' · ')}
          </span>
        </p>
      )}

      {suggestion !== null && (
        <Card className="mb-4 bg-amber-50 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
          <p className="font-semibold">تراكمت عندك {due.length} مراجعة</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            نقترح تخفيف الكلمات الجديدة اليوم إلى {suggestion} حتى تلحق المراجعات. القرار لك.
          </p>
          <Button variant="secondary" className="mt-3" onClick={() => syncTodayPlan(suggestion)}>
            خفّف اليوم إلى {formatWords(suggestion)}
          </Button>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold">خطة اليوم</h2>
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          <Step
            index={1}
            title="المراجعات"
            detail={reviewsDone ? 'لا توجد مراجعات مستحقة' : `${due.length} كلمة مستحقة للمراجعة`}
            done={reviewsDone}
            action={!reviewsDone && <Button onClick={() => go('review')}>راجع</Button>}
          />
          <Step
            index={2}
            title="الكلمات الجديدة"
            detail={
              newTotal === 0
                ? 'لا توجد كلمات جديدة متاحة في هذا المستوى'
                : `${newDone} من ${formatWords(newTotal)}`
            }
            done={newWordsDone}
            action={
              newTotal > 0 &&
              !newWordsDone && (
                <Button variant={reviewsDone ? 'primary' : 'secondary'} onClick={() => go('learn')}>
                  {newDone > 0 ? 'أكمل' : 'ابدأ'}
                </Button>
              )
            }
          />
          <Step
            index={3}
            title="قصة اليوم"
            detail={
              story
                ? story.titleAr
                : quizReady
                  ? 'قصة قصيرة من كلمات اليوم مع الاستماع'
                  : 'تُكتب بعد إنهاء كلمات اليوم'
            }
            done={!!story?.answers}
            action={
              (quizReady || story) && (
                <Button variant={story?.answers ? 'secondary' : 'primary'} onClick={openStory}>
                  {story ? 'اقرأ' : 'اكتبها'}
                </Button>
              )
            }
          />
          <Step
            index={4}
            title="الاختبار الشامل"
            detail={
              plan?.quiz
                ? `نتيجتك: ${plan.quiz.correct} من ${plan.quiz.total}`
                : quizReady
                  ? `يغطي ${formatWords(newDone)} تعلّمتها اليوم`
                  : 'يُفتح بعد إنهاء كلمات اليوم'
            }
            done={!!plan?.quiz}
            action={
              quizReady && (
                <Button variant={plan?.quiz || !story?.answers ? 'secondary' : 'primary'} onClick={() => startQuiz('daily')}>
                  {plan?.quiz ? 'أعده' : 'ابدأ'}
                </Button>
              )
            }
          />
        </ol>
      </Card>

      {(mistakes.length > 0 || showWeekly) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {showWeekly && (
            <Card>
              <h2 className="font-bold">حان الاختبار الأسبوعي</h2>
              <p className="mb-3 text-sm text-slate-500">اختبار خفيف لكلمات هذا الأسبوع.</p>
              <Button variant="secondary" onClick={() => startQuiz('weekly')}>
                ابدأ
              </Button>
            </Card>
          )}
          {mistakes.length > 0 && (
            <Card>
              <h2 className="font-bold">دفتر الأخطاء</h2>
              <p className="mb-3 text-sm text-slate-500">{formatWords(mistakes.length)} تنتظر التصحيح.</p>
              <Button variant="secondary" onClick={() => go('mistakes')}>
                افتح الدفتر
              </Button>
            </Card>
          )}
        </div>
      )}
    </Screen>
  )
}
