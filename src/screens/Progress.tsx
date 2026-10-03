import { Button, Card, LevelBadge, ProgressBar, Screen } from '../components/ui'
import type { QuizKind } from '../db/db'
import { useActivity, useQuizzes, useStats, useStreak } from '../db/hooks'
import { addDays, toDayKey } from '../lib/dates'
import { formatWords } from '../lib/format'
import { LEVEL_TEST_MIN, levelCandidates, weeklyCandidates, WEEKLY_MIN } from '../lib/selection'
import { INTERVALS } from '../lib/srs'
import type { Level } from '../lib/types'

const KIND_LABEL: Record<QuizKind, string> = {
  daily: 'الشامل',
  weekly: 'الأسبوعي',
  level: 'نهاية المستوى',
  mistakes: 'دفتر الأخطاء',
}

const STAGE_LABEL = ['بعد يوم', 'بعد 3 أيام', 'بعد أسبوع', 'بعد أسبوعين', 'بعد شهر']

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <Card className="p-4 text-center">
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Card>
  )
}

function heat(n: number): string {
  if (n === 0) return 'bg-slate-100 dark:bg-slate-800'
  if (n < 5) return 'bg-teal-200 dark:bg-teal-900'
  if (n < 15) return 'bg-teal-400 dark:bg-teal-700'
  return 'bg-teal-600 dark:bg-teal-500'
}

export function Progress({
  onBack,
  startQuiz,
  openMistakes,
}: {
  onBack: () => void
  startQuiz: (kind: QuizKind, level?: Level) => void
  openMistakes: () => void
}) {
  const stats = useStats()
  const streak = useStreak()
  const quizzes = useQuizzes()
  const activity = useActivity()
  if (!stats || !streak || !quizzes || !activity) return null

  const today = toDayKey()
  const learning = stats.progress.filter((p) => p.status === 'learning')
  const mastered = stats.progress.filter((p) => p.status === 'mastered').length
  const stageCounts = INTERVALS.map((_, i) => learning.filter((p) => p.srs?.stage === i).length)
  const ladder = [...stageCounts.map((n, i) => ({ label: STAGE_LABEL[i], n })), { label: 'محفوظة', n: mastered }]
  const ladderMax = Math.max(1, ...ladder.map((s) => s.n))
  const byDay = new Map(activity.map((a) => [a.date, a.cards + a.reviews + a.quizzes]))
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27))
  const pct = stats.total ? Math.round((stats.known / stats.total) * 100) : 0
  const weeklyReady = weeklyCandidates(stats.progress, today).length >= WEEKLY_MIN

  return (
    <Screen title="تقدّمي" onBack={onBack}>
      <Card className="mb-3 text-center">
        <p className="text-slate-500">تعرف</p>
        <p className="my-1 text-6xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{stats.known}</p>
        <p className="text-slate-500">
          من {stats.total} كلمة · <span dir="ltr">{pct}%</span>
        </p>
      </Card>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={`${streak.current} 🔥`} label="أيام متتالية" />
        <Tile value={streak.best} label="أطول سلسلة" />
        <Tile value={learning.length} label="قيد التعلّم" />
        <Tile value={mastered} label="محفوظة نهائيًا" />
      </div>

      <Card className="mb-3">
        <h2 className="mb-3 text-lg font-bold">المستويات</h2>
        <ul className="grid gap-4">
          {stats.levels
            .filter((l) => l.total > 0)
            .map((l) => {
              const testable = levelCandidates(stats.words, stats.progressMap, stats.settings.startLevel!, l.level).length
              return (
                <li key={l.level}>
                  <div className="mb-1.5 flex items-center gap-3">
                    <LevelBadge level={l.level} />
                    <ProgressBar value={l.known} max={l.total} label={`المعروف في ${l.level}`} />
                    <span className="w-16 shrink-0 text-sm tabular-nums text-slate-500">
                      {l.known}/{l.total}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                    <span>{l.learning > 0 ? `قيد التعلّم: ${l.learning}` : ' '}</span>
                    {testable >= LEVEL_TEST_MIN && (
                      <Button variant="ghost" className="min-h-9 text-sm" onClick={() => startQuiz('level', l.level)}>
                        اختبار نهاية {l.level} (اختياري)
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
        </ul>
      </Card>

      <Card className="mb-3">
        <h2 className="text-lg font-bold">سلّم المراجعة</h2>
        <p className="mb-3 text-sm text-slate-500">أين تقف كلماتك: كل نجاح ينقل الكلمة درجة للأعلى.</p>
        <ul className="grid gap-2">
          {ladder.map((s) => (
            <li key={s.label} className="flex items-center gap-3" title={`${s.label}: ${formatWords(s.n)}`}>
              <span className="w-24 shrink-0 text-sm text-slate-600 dark:text-slate-400">{s.label}</span>
              <span className="flex h-5 flex-1 items-center">
                <span
                  className="h-full rounded-e bg-teal-600 dark:bg-teal-500"
                  style={{ width: s.n ? `max(4px, ${(s.n / ladderMax) * 100}%)` : 0 }}
                />
              </span>
              <span className="w-8 shrink-0 text-end text-sm tabular-nums">{s.n}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-3 text-lg font-bold">آخر 4 أسابيع</h2>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="النشاط اليومي">
          {days.map((d) => {
            const n = byDay.get(d) ?? 0
            return (
              <li
                key={d}
                title={`${d}: ${n ? `${n} نشاط` : 'لا نشاط'}`}
                aria-label={`${d}: ${n} نشاط`}
                className={`aspect-square rounded ${heat(n)} ${d === today ? 'ring-2 ring-amber-500' : ''}`}
              />
            )
          })}
        </ol>
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-slate-500">
          <span>أقل</span>
          {[0, 1, 5, 15].map((n) => (
            <span key={n} className={`size-3 rounded-sm ${heat(n)}`} />
          ))}
          <span>أكثر</span>
        </div>
      </Card>

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-bold">الاختبار الأسبوعي</h2>
          <p className="mb-3 text-sm text-slate-500">اختبار خفيف لكلمات آخر 7 أيام.</p>
          <Button variant="secondary" disabled={!weeklyReady} onClick={() => startQuiz('weekly')}>
            {weeklyReady ? 'ابدأ' : `يحتاج ${WEEKLY_MIN} كلمات على الأقل`}
          </Button>
        </Card>
        <Card>
          <h2 className="font-bold">دفتر الأخطاء</h2>
          <p className="mb-3 text-sm text-slate-500">{formatWords(stats.mistakes.length)} تنتظر التصحيح.</p>
          <Button variant="secondary" onClick={openMistakes}>
            افتح الدفتر
          </Button>
        </Card>
      </div>

      {quizzes.length > 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-bold">آخر الاختبارات</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {quizzes.slice(0, 8).map((q) => (
              <li key={q.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {KIND_LABEL[q.kind]} {q.level && <LevelBadge level={q.level} />}{' '}
                  <span dir="ltr" className="text-slate-500">
                    {q.date}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {q.correct}/{q.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Screen>
  )
}
