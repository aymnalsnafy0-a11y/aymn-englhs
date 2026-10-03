import { useEffect, useRef } from 'react'
import { contentFor } from '../data/content'
import { posLabel } from '../lib/format'
import type { Word } from '../lib/types'
import { Button, En, LevelBadge, SpeakButtons } from './ui'

/** بطاقة مختصرة للكلمة تُفتح عند الضغط عليها داخل القصة. */
export function WordPeek({ word, onClose }: { word: Word | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (word && !dialog.open) dialog.showModal()
    if (!word && dialog.open) dialog.close()
  }, [word])

  const content = word ? contentFor(word.id) : undefined
  const example = content?.examples[0]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100"
      aria-label={word ? `بطاقة ${word.word}` : undefined}
    >
      {word && (
        <div className="p-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-sm text-slate-500">
            <LevelBadge level={word.level} />
            <span>{posLabel(word.pos)}</span>
          </div>
          <p dir="ltr" lang="en" className="font-en text-4xl font-semibold">
            {word.word}
          </p>
          {content && <p className="font-en mt-1 text-slate-500" dir="ltr">{content.syllables}</p>}
          <p className="mt-3 text-2xl">{content?.meaningAr ?? '—'}</p>
          <div className="mt-4 flex justify-center">
            <SpeakButtons text={word.word} />
          </div>
          {example && (
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              <En className="block text-lg">{example.en}</En>
              {example.ar}
            </p>
          )}
          <Button variant="secondary" className="mt-5 w-full" onClick={onClose} autoFocus>
            رجوع للقصة
          </Button>
        </div>
      )}
    </dialog>
  )
}
