import { useMemo } from 'react'
import { WordListImport } from '../components/AiSettings'
import { Button, Card, LevelBadge, Screen } from '../components/ui'
import { chooseStartLevel } from '../db/actions'
import { useLoadInfo, useSettings, useWords } from '../db/hooks'
import { formatDuration, formatWords } from '../lib/format'
import { DEFAULT_DAILY, estimateDays } from '../lib/plan'
import { LEVELS, type Level } from '../lib/types'

const LEVEL_INFO: Record<Level, { title: string; description: string; official: number }> = {
  A1: { title: 'مبتدئ', description: 'أول خطوة: كلمات الحياة اليومية — العائلة والطعام والبيت.', official: 900 },
  A2: { title: 'أساسي', description: 'تتكلم عن يومك وتجاربك البسيطة وتفهم جملًا قصيرة.', official: 800 },
  B1: { title: 'متوسط', description: 'تفهم الفكرة الرئيسية في مواضيع مألوفة وتعبّر عن رأيك.', official: 700 },
  B2: { title: 'فوق المتوسط', description: 'تناقش مواضيع متنوعة وتفهم الأخبار والمقالات.', official: 600 },
  C1: { title: 'متقدم', description: 'مفردات أكاديمية ومهنية لفهم النصوص المعقّدة.', official: 2000 },
}

export function LevelPicker({
  onDone,
  onBack,
  onPlacement,
}: {
  onDone: () => void
  onBack?: () => void
  onPlacement: () => void
}) {
  const words = useWords()
  const settings = useSettings()
  const info = useLoadInfo()
  const byLevel = useMemo(() => {
    const map = new Map<Level, string[]>()
    for (const w of words ?? []) map.set(w.level, [...(map.get(w.level) ?? []), w.word])
    return map
  }, [words])
  const isSample = info?.source === 'sample'

  async function pick(level: Level) {
    await chooseStartLevel(level)
    onDone()
  }

  return (
    <Screen title={onBack ? 'تغيير المستوى' : undefined} onBack={onBack}>
      {!onBack && (
        <div className="mb-6 text-center">
          <p className="mb-2 text-sm font-medium text-teal-700 dark:text-teal-400">خطوة 1 من 2</p>
          <h1 className="text-2xl font-bold">من وين تحب تبدأ؟</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            ما قبل مستواك يُحتسب «معروفًا». مش متأكد؟ في الأسفل اختبار قصير يحدد مستواك.
          </p>
        </div>
      )}
      {onBack && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          تغيير المستوى لا يمسح تقدّمك. الكلمات التي تعلّمتها تبقى في المراجعة.
        </p>
      )}

      {info?.source === 'custom' && (
        <p className="mb-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-900 dark:bg-teal-950/40 dark:text-teal-200" aria-live="polite">
          ✓ تم تحميل قائمتك: {info.count} كلمة، محفوظة في هذا الجهاز فقط.
        </p>
      )}
      {isSample && (
        <details className="mb-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <summary className="cursor-pointer font-semibold">عندك ملف قائمة الكلمات (oxford5000.csv)؟</summary>
          <p className="mb-3 mt-2 text-slate-600 dark:text-slate-400">حمّله لتبدأ بكل الكلمات. يبقى في حسابك فقط.</p>
          <WordListImport compact />
        </details>
      )}

      <ul className="grid gap-2">
        {LEVELS.map((level) => {
          const list = byLevel.get(level) ?? []
          const count = isSample ? LEVEL_INFO[level].official : list.length || LEVEL_INFO[level].official
          const current = settings?.startLevel === level
          return (
            <li key={level}>
              <button
                type="button"
                onClick={() => pick(level)}
                aria-label={`ابدأ من ${level}`}
                className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-start shadow-sm ring-1 transition hover:ring-2 hover:ring-teal-600 active:scale-[0.99] dark:bg-slate-900 ${
                  current ? 'ring-2 ring-teal-600 dark:ring-teal-500' : 'ring-slate-200 dark:ring-slate-800'
                }`}
              >
                <LevelBadge level={level} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{LEVEL_INFO[level].title}</span>
                    {current && <span className="text-xs text-teal-700 dark:text-teal-400">(الحالي)</span>}
                  </span>
                  <span className="block text-sm text-slate-500">{LEVEL_INFO[level].description}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {count} كلمة · {formatDuration(estimateDays(count, DEFAULT_DAILY))} بـ{formatWords(DEFAULT_DAILY)} يوميًا
                  </span>
                </span>
                <span aria-hidden="true" className="text-xl text-slate-400">
                  ←
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Card className="mt-4 border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">مش متأكد؟</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              اختبار تحديد مستوى (حوالي 5 دقائق) يقترح عليك مستوى، والقرار لك.
            </p>
          </div>
          <Button variant="secondary" onClick={onPlacement}>
            اختبار تحديد المستوى
          </Button>
        </div>
      </Card>
    </Screen>
  )
}
