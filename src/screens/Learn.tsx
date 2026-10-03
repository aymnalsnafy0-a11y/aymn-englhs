import { useEffect } from 'react'
import { Button, Card, Screen } from '../components/ui'
import { WordCard } from '../components/WordCard'
import { contentFor, contentStatus, ensureContent } from '../data/content'
import { completeWord, markKnown } from '../db/actions'
import { useTodayPlan, useWords } from '../db/hooks'
import { formatWords } from '../lib/format'
import { stopSpeaking } from '../lib/speech'

export function Learn({ onExit }: { onExit: () => void }) {
  const plan = useTodayPlan()
  const words = useWords()
  const planWords = (plan?.wordIds ?? []).map((id) => words?.find((w) => w.id === id)).filter((w) => !!w)
  const planKey = planWords.map((w) => w.id).join()

  // نجهّز محتوى كلمات اليوم كلها مسبقًا (دفعة واحدة لكل 10 كلمات).
  useEffect(() => {
    if (planWords.length) void ensureContent(planWords)
  }, [planKey])

  if (!plan || !words) return null

  const currentId = plan.wordIds.find((id) => !plan.doneIds.includes(id))
  const word = words.find((w) => w.id === currentId)
  const position = plan.doneIds.length + 1

  function exit() {
    stopSpeaking()
    onExit()
  }

  if (!word) {
    return (
      <Screen title="الكلمات الجديدة" onBack={exit}>
        <Card className="text-center">
          <p className="text-4xl">🌟</p>
          <h2 className="mt-2 text-xl font-bold">أنهيت كلمات اليوم!</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            تعلّمت {formatWords(plan.doneIds.length)}. ستظهر لك للمراجعة بعد يوم.
          </p>
          <Button className="mt-5" onClick={exit}>
            رجوع لخطة اليوم
          </Button>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen title={`كلمة ${position} من ${plan.wordIds.length}`} onBack={exit}>
      <WordCard
        key={word.id}
        word={word}
        content={contentFor(word.id)}
        status={contentStatus(word.id)}
        onRetry={() => void ensureContent([word], true)}
        onFinish={() => {
          stopSpeaking()
          void completeWord(word.id)
        }}
        onKnown={() => {
          stopSpeaking()
          void markKnown(word.id)
        }}
      />
    </Screen>
  )
}
