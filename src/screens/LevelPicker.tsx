import { useMemo } from 'react'
import { Button, Card, En, LevelBadge, Screen } from '../components/ui'
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

export function LevelPicker({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
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
          <p className="mb-2 text-sm font-medium text-teal-700 dark:text-teal-400">سياق · كلمات أكسفورد 5000</p>
          <h1 className="text-3xl font-bold">من وين تحب تبدأ؟</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            اختر مستوى البداية. الكلمات في المستويات التي قبله تُحتسب «معروفة»، ويمكنك مراجعتها متى شئت.
          </p>
        </div>
      )}
      {onBack && (
        <p className="mb-4 text-slate-600 dark:text-slate-400">
          تغيير المستوى لا يمسح تقدّمك. الكلمات التي تعلّمتها تبقى في المراجعة.
        </p>
      )}

      <ul className="grid gap-3">
        {LEVELS.map((level) => {
          const list = byLevel.get(level) ?? []
          const count = isSample ? LEVEL_INFO[level].official : list.length || LEVEL_INFO[level].official
          const current = settings?.startLevel === level
          return (
            <li key={level}>
              <Card className={current ? 'ring-2 ring-teal-600 dark:ring-teal-500' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <LevelBadge level={level} />
                      <h2 className="text-lg font-bold">{LEVEL_INFO[level].title}</h2>
                      {current && <span className="text-sm text-teal-700 dark:text-teal-400">(الحالي)</span>}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{LEVEL_INFO[level].description}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <div className="flex gap-1">
                        <dt className="text-slate-500">الكلمات:</dt>
                        <dd className="font-medium">
                          {count}
                          {isSample && <span className="text-slate-500"> (في ملف التجربة: {list.length})</span>}
                        </dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="text-slate-500">المدة:</dt>
                        <dd className="font-medium">
                          {formatDuration(estimateDays(count, DEFAULT_DAILY))} بـ{formatWords(DEFAULT_DAILY)} يوميًا
                        </dd>
                      </div>
                    </dl>
                    {list.length > 0 && (
                      <p className="mt-2 text-sm text-slate-500">
                        أمثلة: <En className="text-base text-slate-700 dark:text-slate-300">{list.slice(0, 5).join(' · ')}</En>
                      </p>
                    )}
                  </div>
                  <Button onClick={() => pick(level)} className="w-full sm:w-auto" aria-label={`ابدأ من ${level}`}>
                    ابدأ من هنا
                  </Button>
                </div>
              </Card>
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
          <Button variant="secondary" disabled title="قريبًا">
            اختبار تحديد المستوى (قريبًا)
          </Button>
        </div>
      </Card>
    </Screen>
  )
}
