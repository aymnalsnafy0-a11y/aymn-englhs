import { useState } from 'react'
import { Button, Card, Screen } from '../components/ui'
import { syncTodayPlan, updateSettings } from '../db/actions'
import { useSettings } from '../db/hooks'
import { formatMinutes, formatWords } from '../lib/format'
import { DAILY_OPTIONS, DEFAULT_DAILY, estimateMinutes } from '../lib/plan'

export function DailyCount({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const settings = useSettings()
  const [choice, setChoice] = useState<number | null>(null)
  const selected = choice ?? settings?.dailyCount ?? DEFAULT_DAILY

  async function save() {
    await updateSettings({ dailyCount: selected, onboarded: true })
    await syncTodayPlan(selected)
    onDone()
  }

  return (
    <Screen title="كم كلمة جديدة في اليوم؟" onBack={onBack}>
      <p className="mb-4 text-slate-600 dark:text-slate-400">
        اختر عددًا تقدر تلتزم به كل يوم. الوقت يشمل البطاقات والقصة والاختبار. تقدر تغيّره لاحقًا من الإعدادات.
      </p>
      <fieldset>
        <legend className="sr-only">عدد الكلمات اليومي</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DAILY_OPTIONS.map((n) => {
            const active = n === selected
            return (
              <label
                key={n}
                className={`flex cursor-pointer items-center justify-between rounded-2xl p-4 ring-1 transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-amber-500 ${
                  active
                    ? 'bg-teal-50 ring-2 ring-teal-600 dark:bg-teal-950/40 dark:ring-teal-500'
                    : 'bg-white ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="daily"
                    value={n}
                    checked={active}
                    onChange={() => setChoice(n)}
                    className="size-4 accent-teal-700"
                  />
                  <span className="text-lg font-bold">{formatWords(n)}</span>
                  {n === DEFAULT_DAILY && (
                    <span className="rounded-md bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      مقترح
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-500">≈ {formatMinutes(estimateMinutes(n))}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <Card className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        ترتيب كل يوم: المراجعات المستحقة ← الكلمات الجديدة ← قصة اليوم ← الاختبار الشامل.
      </Card>
      <Button onClick={save} className="mt-5 w-full text-lg">
        يلا نبدأ
      </Button>
    </Screen>
  )
}
