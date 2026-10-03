import { useEffect, useState } from 'react'
import { Button, Card, En, LevelBadge, ProgressBar, Screen, SpeakButtons } from '../components/ui'
import { contentFor, ensureContent } from '../data/content'
import { recordReview } from '../db/actions'
import { useStats } from '../db/hooks'
import { stopSpeaking } from '../lib/speech'
import type { Rating } from '../lib/srs'

const RATINGS: { rating: Rating; label: string; hint: string; variant: 'danger' | 'secondary' | 'primary' }[] = [
  { rating: 'forgot', label: 'نسيتها', hint: 'تعود للبداية وتتكرر الآن', variant: 'danger' },
  { rating: 'hard', label: 'صعبة', hint: 'تبقى في نفس المرحلة', variant: 'secondary' },
  { rating: 'easy', label: 'سهلة', hint: 'تنتقل للمرحلة التالية', variant: 'primary' },
]

export function Review({ onExit }: { onExit: () => void }) {
  const stats = useStats()
  const [queue, setQueue] = useState<string[] | null>(null)
  const [initial, setInitial] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)

  // نأخذ لقطة من المستحقات عند بدء الجلسة حتى لا تتغير القائمة أثناءها.
  useEffect(() => {
    if (stats && queue === null) {
      const ids = stats.due.map((p) => p.wordId)
      setQueue(ids)
      setInitial(ids.length)
      const byId = new Map(stats.words.map((w) => [w.id, w]))
      void ensureContent(ids.map((id) => byId.get(id)).filter((w) => !!w))
    }
  }, [stats, queue])

  if (!stats || queue === null) return null

  function exit() {
    stopSpeaking()
    onExit()
  }

  const currentId = queue[0]
  const word = stats.words.find((w) => w.id === currentId)

  if (!word) {
    return (
      <Screen title="المراجعة" onBack={exit}>
        <Card className="text-center">
          <p className="text-4xl">✅</p>
          <h2 className="mt-2 text-xl font-bold">خلصت مراجعات اليوم</h2>
          <Button className="mt-5" onClick={exit}>
            رجوع لخطة اليوم
          </Button>
        </Card>
      </Screen>
    )
  }

  const content = contentFor(word.id)
  const example = content?.examples[0]

  async function rate(rating: Rating) {
    setBusy(true)
    const repeat = await recordReview(currentId, rating)
    setQueue((q) => {
      const rest = (q ?? []).slice(1)
      return repeat ? [...rest, currentId] : rest
    })
    setRevealed(false)
    setBusy(false)
  }

  return (
    <Screen title="المراجعة" onBack={exit}>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={Math.max(0, initial - queue.length)} max={initial} label="تقدّم المراجعة" />
        <span className="shrink-0 text-sm text-slate-500">باقي {queue.length}</span>
      </div>
      <Card className="text-center">
        <div className="mb-3 flex justify-center">
          <LevelBadge level={word.level} />
        </div>
        <p dir="ltr" lang="en" className="font-en text-5xl font-semibold">
          {word.word}
        </p>
        <div className="mt-4 flex justify-center">
          <SpeakButtons text={word.word} compact />
        </div>

        {!revealed ? (
          <Button className="mt-6 w-full" onClick={() => setRevealed(true)}>
            أظهر المعنى
          </Button>
        ) : (
          <div className="mt-6" aria-live="polite">
            <p className="text-2xl font-medium">{content?.meaningAr ?? '—'}</p>
            {example && (
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                <En className="block text-lg">{example.en}</En>
                {example.ar}
              </p>
            )}
            <p className="mt-6 mb-2 text-sm text-slate-500">كيف كانت؟</p>
            <div className="grid grid-cols-3 gap-2">
              {RATINGS.map((r) => (
                <Button key={r.rating} variant={r.variant} disabled={busy} onClick={() => rate(r.rating)} title={r.hint}>
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </Screen>
  )
}
