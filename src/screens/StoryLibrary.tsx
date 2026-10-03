import { Card, Screen } from '../components/ui'
import { useStories } from '../db/hooks'
import { formatWords } from '../lib/format'

export function StoryLibrary({ onBack, open }: { onBack: () => void; open: (id: number) => void }) {
  const stories = useStories()
  if (!stories) return null
  return (
    <Screen title="مكتبة القصص" onBack={onBack}>
      {stories.length === 0 ? (
        <Card className="text-center text-slate-600 dark:text-slate-400">لا توجد قصص بعد. أول قصة تُكتب بعد كلمات اليوم.</Card>
      ) : (
        <ul className="grid gap-2">
          {stories.map((s) => {
            const score = s.answers ? s.questions.filter((q, i) => s.answers![i] === q.answer).length : null
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => open(s.id!)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{s.titleAr}</span>
                    <span className="block text-sm text-slate-500">
                      {s.mode === 'serial' ? `الحلقة ${s.episode}` : 'قصة مستقلة'} · <span dir="ltr">{s.date}</span> ·{' '}
                      {formatWords(s.wordIds.length)}
                    </span>
                  </span>
                  {score !== null && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {score}/{s.questions.length}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
