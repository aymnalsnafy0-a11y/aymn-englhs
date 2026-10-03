import { useState } from 'react'
import type { WordContent } from '../data/sampleContent'
import { posLabel } from '../lib/format'
import { splitHighlight } from '../lib/highlight'
import type { Word } from '../lib/types'
import { HiddenDrill, TracingDrill } from './TypingDrills'
import { Button, Card, En, LevelBadge, SpeakButtons } from './ui'

const STAGES = ['التعرّف', 'الجملة', 'التذكّر', 'الكتابة', 'من الذاكرة'] as const

const MEMORY_LABEL: Record<WordContent['memory']['kind'], string> = {
  link: 'ربط ذكي',
  story: 'قصة صغيرة',
  family: 'عائلة الكلمة',
}

function Missing() {
  return (
    <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      محتوى هذه الكلمة لم يُجهَّز بعد — سيُولَّد تلقائيًا في مرحلة لاحقة.
    </p>
  )
}

export function WordCard({
  word,
  content,
  onFinish,
  onKnown,
}: {
  word: Word
  content?: WordContent
  onFinish: () => void
  onKnown: () => void
}) {
  const [stage, setStage] = useState(0)
  const [exampleIndex, setExampleIndex] = useState(0)
  const [traced, setTraced] = useState(false)
  const [recalled, setRecalled] = useState(false)
  const example = content?.examples[exampleIndex]
  const last = stage === STAGES.length - 1

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <ol className="flex flex-1 gap-1" aria-label="مراحل البطاقة">
          {STAGES.map((label, i) => (
            <li key={label} className="flex-1" aria-current={i === stage ? 'step' : undefined}>
              <span
                className={`block h-1.5 rounded-full ${i <= stage ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-200 dark:bg-slate-800'}`}
              />
              <span className={`mt-1 hidden text-xs sm:block ${i === stage ? 'font-semibold' : 'text-slate-500'}`}>
                {label}
              </span>
            </li>
          ))}
        </ol>
        <Button variant="ghost" onClick={onKnown} className="shrink-0 text-sm">
          أعرفها ✓
        </Button>
      </div>

      <section className="min-h-72 px-5 py-6" aria-live="polite">
        <h2 className="mb-4 text-sm font-semibold text-slate-500 sm:sr-only">
          {stage + 1}. {STAGES[stage]}
        </h2>

        {stage === 0 && (
          <div className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm text-slate-500">
              <LevelBadge level={word.level} />
              <span>{posLabel(word.pos)}</span>
            </div>
            <p dir="ltr" lang="en" className="font-en text-5xl font-semibold">
              {word.word}
            </p>
            {content && (
              <p dir="ltr" lang="en" className="font-en mt-2 text-xl tracking-wide text-slate-500">
                {content.syllables}
              </p>
            )}
            <p className="mt-4 text-2xl font-medium">{content?.meaningAr ?? '—'}</p>
            <div className="mt-5 flex justify-center">
              <SpeakButtons text={word.word} />
            </div>
          </div>
        )}

        {stage === 1 &&
          (example ? (
            <div>
              <p dir="ltr" lang="en" className="font-en text-2xl leading-relaxed">
                {splitHighlight(example.en, word.word).map((seg, i) =>
                  seg.match ? (
                    <mark key={i} className="rounded bg-amber-200 px-1 text-inherit dark:bg-amber-500/30">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  ),
                )}
              </p>
              <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">{example.ar}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <SpeakButtons text={example.en} />
                {content!.examples.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setExampleIndex((i) => (i + 1) % content!.examples.length)}
                  >
                    جملة أخرى
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Missing />
          ))}

        {stage === 2 &&
          (content ? (
            <div>
              <p className="mb-2 inline-block rounded-lg bg-teal-50 px-2 py-0.5 text-sm font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                {MEMORY_LABEL[content.memory.kind]}
              </p>
              <p className="text-lg leading-relaxed">{content.memory.text}</p>
              {content.family && content.family.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-500">عائلة الكلمة</h3>
                  <ul className="flex flex-wrap gap-2">
                    {content.family.map((f) => (
                      <li key={f.en + f.pos} className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
                        <En className="text-lg font-semibold">{f.en}</En>
                        <span className="mx-1 text-xs text-slate-500">({posLabel(f.pos)})</span>
                        <span>{f.ar}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <Missing />
          ))}

        {stage === 3 && <TracingDrill target={word.word} onDone={() => setTraced(true)} />}
        {stage === 4 && <HiddenDrill target={word.word} onDone={() => setRecalled(true)} />}
      </section>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <Button variant="secondary" onClick={() => setStage((s) => s - 1)} disabled={stage === 0}>
          السابق
        </Button>
        {last ? (
          <Button onClick={onFinish} disabled={!recalled}>
            إنهاء الكلمة
          </Button>
        ) : (
          <div className="flex gap-2">
            {stage === 3 && !traced && (
              <Button variant="ghost" onClick={() => setStage(4)}>
                تخطَّ
              </Button>
            )}
            <Button onClick={() => setStage((s) => s + 1)} disabled={stage === 3 && !traced}>
              التالي
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
