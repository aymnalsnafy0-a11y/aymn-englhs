import { useEffect } from 'react'
import { Button, Card, LevelBadge, ProgressBar, Screen } from '../components/ui'
import { syncTodayPlan } from '../db/actions'
import type { QuizKind } from '../db/db'
import { useLoadInfo, useQuizzes, useStats, useStreak, useTodayPlan } from '../db/hooks'
import { toDayKey } from '../lib/dates'
import { formatWords } from '../lib/format'
import { weeklyDue } from '../lib/selection'
import { suggestedNewCount } from '../lib/srs'

type Go = (screen: 'learn' | 'review' | 'settings' | 'progress' | 'mistakes') => void

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

export function Home({ go, startQuiz }: { go: Go; startQuiz: (kind: QuizKind) => void }) {
  const stats = useStats()
  const plan = useTodayPlan()
  const info = useLoadInfo()
  const streak = useStreak()
  const quizzes = useQuizzes()

  useEffect(() => {
    void syncTodayPlan()
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

      {info?.source === 'sample' && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          تعمل الآن على ملف التجربة ({info.count} كلمة). لاستخدام القائمة الكاملة ضع الملف في{' '}
          <code dir="ltr">data/oxford5000.csv</code>.
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
          <Step index={3} title="قصة اليوم" detail="قريبًا — قصة قصيرة من كلمات اليوم مع الاستماع" />
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
                <Button variant={plan?.quiz ? 'secondary' : 'primary'} onClick={() => startQuiz('daily')}>
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
