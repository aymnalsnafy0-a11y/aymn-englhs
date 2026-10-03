/**
 * نص القصة: تقسيم الجمل المختلطة (عربي + إنجليزي) إلى مقاطع بلغة واحدة،
 * وتقسيم المقاطع إلى كلمات بمواضعها لربط أحداث النطق (boundary) بالكلمة المظللة.
 */
import { isFormOf } from './highlight.js'
import type { Level } from './types.js'

export type StoryKind = 'beginner' | 'advanced'

/** للمبتدئ (A1–A2): نص عربي وكلمات اليوم بالإنجليزية. للمتقدم (B1+): قصة إنجليزية كاملة. */
export function storyKindFor(level: Level): StoryKind {
  return level === 'A1' || level === 'A2' ? 'beginner' : 'advanced'
}

export interface StorySentence {
  /** للمبتدئ: عربي فيه كلمات إنجليزية. للمتقدم: إنجليزي. */
  text: string
  /** للمبتدئ: الجملة بالإنجليزية كاملة. للمتقدم: الترجمة العربية. */
  translation: string
}

export interface Token {
  text: string
  /** موضع الكلمة داخل نص المقطع (لأحداث boundary). */
  start: number
  end: number
}

export interface Segment {
  lang: 'ar' | 'en'
  text: string
  tokens: Token[]
}

const ARABIC = /[؀-ۿ]/
const LATIN_RUN = /[A-Za-z][A-Za-z'’-]*(?:[ ]+[A-Za-z][A-Za-z'’-]*)*/g
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}]+)*/gu

export function tokenize(text: string): Token[] {
  return [...text.matchAll(WORD)].map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }))
}

/** يقسم الجملة إلى مقاطع بلغة واحدة؛ الجملة الإنجليزية الخالصة مقطع واحد. */
export function segmentSentence(text: string): Segment[] {
  if (!ARABIC.test(text)) return [{ lang: 'en', text, tokens: tokenize(text) }]
  const segments: Segment[] = []
  let last = 0
  const push = (lang: Segment['lang'], chunk: string) => {
    if (!chunk.trim()) {
      if (segments.length) segments[segments.length - 1].text += chunk
      return
    }
    segments.push({ lang, text: chunk, tokens: [] })
  }
  for (const m of text.matchAll(LATIN_RUN)) {
    push('ar', text.slice(last, m.index))
    push('en', m[0])
    last = m.index! + m[0].length
  }
  push('ar', text.slice(last))
  return segments.map((s) => ({ ...s, tokens: tokenize(s.text) }))
}

/** الكلمة التي يقع فيها موضع الحرف (من حدث boundary)، أو أقرب كلمة بعده. */
export function tokenAt(tokens: Token[], charIndex: number): number {
  const inside = tokens.findIndex((t) => charIndex >= t.start && charIndex < t.end)
  if (inside !== -1) return inside
  const next = tokens.findIndex((t) => t.start >= charIndex)
  return next === -1 ? tokens.length - 1 : next
}

/** الكلمة المستهدفة التي يمثلها هذا الرمز (أو undefined). */
export function matchTarget<T extends { word: string }>(token: string, targets: T[]): T | undefined {
  if (!/^[A-Za-z]/.test(token)) return undefined
  return targets.find((t) => isFormOf(token, t.word))
}

/** الكلمات المستهدفة الغائبة عن القصة (للتحقق من مخرجات النموذج). */
export function missingTargets(sentences: StorySentence[], words: string[]): string[] {
  const tokens = sentences.flatMap((s) => tokenize(s.text).map((t) => t.text))
  return words.filter((w) => {
    const parts = w.split(/\s+/)
    if (parts.length > 1) return !sentences.some((s) => s.text.toLowerCase().includes(w.toLowerCase()))
    return !tokens.some((t) => isFormOf(t, w))
  })
}
