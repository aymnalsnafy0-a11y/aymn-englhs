import { useEffect, useMemo, useRef, useState } from 'react'
import { contentFor, contentStatus, ensureContent, useContentVersion } from '../data/content'
import { syncTodayPlan } from '../db/actions'
import { db } from '../db/db'
import { useProgressMap, useProgress, useSaved, useSettings, useWords } from '../db/hooks'
import { posLabel } from '../lib/format'
import { buildWordIndex, findWord, wordAround } from '../lib/lookup'
import { wordId, type Word } from '../lib/types'
import { Button, En, LevelBadge, SpeakButtons } from './ui'

interface Hit {
  token: string
  word: Word
  inList: boolean
  x: number
  y: number
}

/** الكلمة الإنجليزية تحت نقطة على الشاشة (كلك يمين أو ضغطة مطوّلة). */
function wordAtPoint(x: number, y: number): string | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  const pos = doc.caretPositionFromPoint?.(x, y)
  if (pos) {
    node = pos.offsetNode
    offset = pos.offset
  } else {
    const range = doc.caretRangeFromPoint?.(x, y)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  const parent = node.parentElement
  if (!parent || parent.closest('input, textarea, [data-no-lookup]')) return null
  return wordAround(node.nodeValue ?? '', offset)?.word ?? null
}

/** قاموس فوري في كل الموقع: كلك يمين (أو ضغطة مطوّلة على الجوال) على أي كلمة إنجليزية. */
export function WordLookup() {
  const words = useWords()
  const settings = useSettings()
  const progress = useProgressMap(useProgress())
  const saved = useSaved()
  useContentVersion()
  const index = useMemo(() => buildWordIndex(words ?? []), [words])
  const [hit, setHit] = useState<Hit | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function open(x: number, y: number): boolean {
      const token = wordAtPoint(x, y)
      if (!token) return false
      const found = findWord(token, index)
      const word: Word = found ?? {
        id: wordId(token.toLowerCase(), ''),
        word: token.toLowerCase(),
        level: settings?.startLevel ?? 'B1',
        pos: '',
        topic: 'general',
        order: -1,
      }
      setHit({ token, word, inList: !!found, x, y })
      void ensureContent([word])
      return true
    }
    let suppressUntil = 0
    function onContext(e: MouseEvent) {
      if (Date.now() < suppressUntil) return e.preventDefault()
      if (open(e.clientX, e.clientY)) e.preventDefault()
    }
    // iOS لا يرسل contextmenu عند الضغط المطوّل: نقيسه بأنفسنا.
    let timer: number | undefined
    let start: { x: number; y: number } | null = null
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY }
      timer = window.setTimeout(() => {
        if (start && open(start.x, start.y)) suppressUntil = Date.now() + 800
      }, 550)
    }
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0]
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) window.clearTimeout(timer)
    }
    const cancel = () => {
      window.clearTimeout(timer)
      start = null
    }
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', cancel)
    document.addEventListener('touchcancel', cancel)
    return () => {
      document.removeEventListener('contextmenu', onContext)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', cancel)
      document.removeEventListener('touchcancel', cancel)
    }
  }, [index, settings?.startLevel])

  useEffect(() => {
    if (!hit) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !boxRef.current?.contains(e.target as Node)) setHit(null)
    }
    const onScroll = () => setHit(null)
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    window.addEventListener('scroll', onScroll, { passive: true })
    boxRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', close)
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('scroll', onScroll)
    }
  }, [hit])

  if (!hit) return null
  const { word, inList } = hit
  const content = contentFor(word.id)
  const status = contentStatus(word.id)
  const example = content?.examples[0]
  const known = progress.get(word.id)
  const isSaved = saved?.some((s) => s.wordId === word.id)
  const width = Math.min(320, window.innerWidth - 24)
  const left = Math.max(12, Math.min(hit.x - width / 2, window.innerWidth - width - 12))
  const below = hit.y < window.innerHeight * 0.55
  const style = below ? { left, top: hit.y + 18, width } : { left, bottom: window.innerHeight - hit.y + 18, width }

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={`معنى ${word.word}`}
      tabIndex={-1}
      data-no-lookup
      style={style}
      className="fixed z-50 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 outline-none dark:bg-slate-900 dark:ring-slate-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="ltr" lang="en" className="font-en text-end text-2xl font-semibold">
            {word.word}
          </p>
          {hit.token.toLowerCase() !== word.word.toLowerCase() && (
            <p className="text-xs text-slate-500">
              أصل <En>{hit.token}</En>
            </p>
          )}
        </div>
        <button type="button" onClick={() => setHit(null)} aria-label="إغلاق" className="rounded-lg px-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          ✕
        </button>
      </div>
      {inList && (
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <LevelBadge level={word.level} />
          {word.pos && <span>{posLabel(word.pos)}</span>}
          {content?.syllables && <En>{content.syllables}</En>}
        </div>
      )}
      <p className="mt-2 text-lg font-medium" aria-live="polite">
        {content?.meaningAr ?? (status === 'failed' ? <span className="text-sm text-slate-500">لا يتوفر المعنى الآن (يحتاج إنترنت أو مفتاح Gemini).</span> : <span className="text-sm text-slate-500">نجهّز المعنى…</span>)}
      </p>
      <div className="mt-2">
        <SpeakButtons text={word.word} />
      </div>
      {example && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <En className="block text-base">{example.en}</En>
          {example.ar}
        </p>
      )}
      {inList && (
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          {known ? (
            <span className="text-teal-700 dark:text-teal-400">{known === 'learning' ? '📘 قيد التعلّم في خطتك' : '✓ من كلماتك المعروفة'}</span>
          ) : isSaved ? (
            <span className="text-teal-700 dark:text-teal-400">✓ أُضيفت لخطتك</span>
          ) : (
            <Button
              variant="secondary"
              className="min-h-9 w-full text-sm"
              onClick={async () => {
                await db.saved.put({ wordId: word.id, word: word.word, savedAt: Date.now() })
                await syncTodayPlan()
              }}
            >
              + أضفها لخطتي
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
