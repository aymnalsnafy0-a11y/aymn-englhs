/** القاموس الفوري: من كلمة في جملة (مع تصريفها) إلى كلمة القائمة. */
import { deinflect } from './browse.js'
import { levelIndex, type Word } from './types.js'

export type WordIndex = Map<string, Word>

/** فهرس بالكلمة (أحرف صغيرة) → أدنى مستوى لها. */
export function buildWordIndex(words: Word[]): WordIndex {
  const index: WordIndex = new Map()
  for (const w of words) {
    const key = w.word.toLowerCase()
    const prev = index.get(key)
    if (!prev || levelIndex(w.level) < levelIndex(prev.level)) index.set(key, w)
  }
  return index
}

/** يجد الكلمة الأساسية: older ← old، running ← run، studies ← study. */
export function findWord(token: string, index: WordIndex): Word | undefined {
  for (const form of deinflect(token)) {
    const hit = index.get(form)
    if (hit) return hit
  }
  return undefined
}

const WORD_CHAR = /[A-Za-z'’-]/

/** يستخرج الكلمة الإنجليزية حول موضع داخل نص. */
export function wordAround(text: string, offset: number): { word: string; start: number; end: number } | null {
  let start = Math.min(offset, text.length)
  let end = start
  if (!WORD_CHAR.test(text[start] ?? '') && WORD_CHAR.test(text[start - 1] ?? '')) start--, end--
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--
  while (end < text.length && WORD_CHAR.test(text[end])) end++
  const raw = text.slice(start, end).replace(/^['’-]+|['’-]+$/g, '')
  if (!/^[A-Za-z]/.test(raw)) return null
  const lead = text.slice(start, end).indexOf(raw)
  return { word: raw, start: start + lead, end: start + lead + raw.length }
}
