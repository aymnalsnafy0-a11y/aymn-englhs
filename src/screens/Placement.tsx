import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, LevelBadge, ProgressBar, Screen, SpeakButtons } from '../components/ui'
import { chooseStartLevel } from '../db/actions'
import { useWords } from '../db/hooks'
import { buildPlacement, scorePlacement, KNOWN_THRESHOLD } from '../lib/placement'

export function Placement({ onBack, onChosen }: { onBack: () => void; onChosen: () => void }) {
  const words = useWords()
  const items = useMemo(() => (words ? buildPlacement(words, Math.random) : []), [words])
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<boolean[]>([])
  const yesRef = useRef<HTMLButtonElement>(null)

  const index = answers.length
  const finished = items.length > 0 && index >= items.length
  const result = useMemo(() => (finished ? scorePlacement(items, answers) : null), [finished, items, answers])

  useEffect(() => {
    if (started && !finished) yesRef.current?.focus()
  }, [started, finished, index])

  if (!words) return null

  function answer(yes: boolean) {
    setAnswers((a) => [...a, yes])
  }

  if (!started) {
    return (
      <Screen title="اختبار تحديد المستوى" onBack={onBack}>
        <Card>
          <p className="text-lg">سنعرض عليك {items.length} كلمة واحدة تلو الأخرى (حوالي 5 دقائق).</p>
          <ul className="mt-3 grid list-disc gap-1 ps-5 text-slate-600 dark:text-slate-400">
            <li>اضغط «أعرفها» فقط إذا كنت تعرف معناها فعلًا.</li>
            <li>بعض الكلمات مختلقة وليست إنجليزية — هي لقياس دقة الإجابات، فلا تخمّن.</li>
            <li>في النهاية نقترح عليك مستوى، والقرار لك.</li>
          </ul>
          <Button className="mt-5 w-full" onClick={() => setStarted(true)} disabled={items.length === 0}>
            ابدأ الاختبار
          </Button>
        </Card>
      </Screen>
    )
  }

  if (result) {
    return (
      <Screen title="نتيجة تحديد المستوى" onBack={onBack}>
        <Card className="text-center">
          <p className="text-slate-500">نقترح أن تبدأ من</p>
          <p className="my-3 flex justify-center">
            <span className="scale-150">
              <LevelBadge level={result.suggested} />
            </span>
          </p>
          <ul className="mt-5 grid gap-3 text-start">
            {result.levels.map((l) => (
              <li key={l.level} className="flex items-center gap-3">
                <LevelBadge level={l.level} />
                <ProgressBar value={Math.round(l.score * 100)} max={100} label={`تعرف من ${l.level}`} />
                <span className="w-12 shrink-0 text-sm tabular-nums text-slate-500">
                  <span dir="ltr">{Math.round(l.score * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            المستوى المقترح هو أول مستوى تعرف منه أقل من {Math.round(KNOWN_THRESHOLD * 100)}% (بعد خصم التخمين).
          </p>
          {result.falseAlarms > 0 && (
            <p className={`mt-2 text-sm ${result.unreliable ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
              اخترت «أعرفها» لـ {result.falseAlarms} من {result.fakeTotal} كلمات مختلقة
              {result.unreliable ? '، لذلك النتيجة تقريبية — يمكنك إعادة الاختبار.' : '.'}
            </p>
          )}
          <div className="mt-6 grid gap-2">
            <Button onClick={() => chooseStartLevel(result.suggested).then(onChosen)}>ابدأ من {result.suggested}</Button>
            <Button variant="secondary" onClick={onBack}>
              اختر مستوى آخر بنفسي
            </Button>
          </div>
        </Card>
      </Screen>
    )
  }

  const item = items[index]
  return (
    <Screen title="اختبار تحديد المستوى" onBack={onBack}>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={index} max={items.length} label="تقدّم الاختبار" />
        <span className="shrink-0 text-sm tabular-nums text-slate-500">
          {index + 1}/{items.length}
        </span>
      </div>
      <Card className="py-10 text-center">
        <p className="text-slate-500">هل تعرف معنى هذه الكلمة؟</p>
        <p dir="ltr" lang="en" className="font-en my-6 text-5xl font-semibold">
          {item.word}
        </p>
        {item.kind === 'real' && (
          <div className="mb-6 flex justify-center">
            <SpeakButtons text={item.word} compact />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button ref={yesRef} onClick={() => answer(true)} className="text-lg">
            أعرفها
          </Button>
          <Button variant="secondary" onClick={() => answer(false)} className="text-lg">
            لا أعرفها
          </Button>
        </div>
        {index > 0 && (
          <Button variant="ghost" className="mt-4 text-sm" onClick={() => setAnswers((a) => a.slice(0, -1))}>
            رجوع للكلمة السابقة
          </Button>
        )}
      </Card>
    </Screen>
  )
}
