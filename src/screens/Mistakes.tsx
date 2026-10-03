import { Button, Card, En, Screen } from '../components/ui'
import { contentFor } from '../data/content'
import type { MistakeRow } from '../db/db'
import { useActiveMistakes, useWords } from '../db/hooks'
import { formatWords } from '../lib/format'

const SOURCE: Record<MistakeRow['source'], string> = {
  daily: 'الاختبار الشامل',
  weekly: 'الاختبار الأسبوعي',
  level: 'اختبار المستوى',
  mistakes: 'تدريب الدفتر',
  review: 'المراجعة',
}

export function Mistakes({ onBack, onPractice }: { onBack: () => void; onPractice: () => void }) {
  const mistakes = useActiveMistakes()
  const words = useWords()
  if (!mistakes || !words) return null
  const byId = new Map(words.map((w) => [w.id, w]))

  return (
    <Screen title="دفتر الأخطاء" onBack={onBack}>
      <p className="mb-4 text-slate-600 dark:text-slate-400">
        الكلمات التي أخطأت فيها أو نسيتها. تظهر أولًا في مراجعات اليوم التالي، وتخرج من الدفتر عندما تجيبها صح
        في يوم لاحق.
      </p>
      {mistakes.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">📒</p>
          <p className="mt-2 font-semibold">الدفتر فارغ — ممتاز!</p>
        </Card>
      ) : (
        <>
          <Button className="mb-4 w-full" onClick={onPractice}>
            تدرّب على {formatWords(mistakes.length)}
          </Button>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {mistakes.map((m) => {
                const w = byId.get(m.wordId)
                return (
                  <li key={m.wordId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <En className="text-xl font-semibold">{w?.word ?? m.wordId}</En>
                      <p className="text-sm text-slate-500">
                        {SOURCE[m.source]} · <span dir="ltr">{m.lastAt}</span>
                      </p>
                    </div>
                    <div className="text-end">
                      <p>{contentFor(m.wordId)?.meaningAr ?? ''}</p>
                      {m.count > 1 && (
                        <p className="text-sm text-rose-700 dark:text-rose-400">أخطأت فيها {m.count} مرات</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </Screen>
  )
}
