/**
 * اختبار تحديد المستوى (حوالي 5 دقائق): اختبار «أعرفها / لا أعرفها» بكلمات حقيقية من كل مستوى
 * وكلمات مختلقة تشبه الإنجليزية. اختيار كلمة مختلقة يكشف التخمين، فنصحّح النتيجة:
 *   الدرجة المصحّحة = (نسبة المعروف − نسبة المختلق) ÷ (1 − نسبة المختلق)
 * المستوى المقترح = أول مستوى درجته المصحّحة أقل من 80%.
 */
import { shuffle, type Rng } from './quiz'
import { LEVELS, levelIndex, type Level, type Word } from './types'

export const PER_LEVEL = 8
export const PSEUDO_COUNT = 12
export const KNOWN_THRESHOLD = 0.8
const MIN_PER_LEVEL = 4

/** كلمات ليست في الإنجليزية (على نمط اختبارات LexTALE). */
export const PSEUDOWORDS = [
  'platery', 'mensible', 'kermshaw', 'alberation', 'plaudate', 'spaunch', 'exprate', 'rebondicate',
  'pristle', 'crumper', 'purrage', 'pulsh', 'pastoric', 'ploss', 'abstrition', 'fendle',
  'glandish', 'tranble', 'wenning', 'drosent',
]

export type PlacementItem = { kind: 'real'; word: string; level: Level } | { kind: 'fake'; word: string }

/** كلمة صالحة للاختبار: كلمة واحدة بحروف صغيرة، وأول ظهور لها في القائمة (لا معنى لاحق لكلمة أساسية). */
function candidates(words: Word[]): Word[] {
  const first = new Map<string, number>()
  for (const w of words) {
    const key = w.word.toLowerCase()
    first.set(key, Math.min(first.get(key) ?? Infinity, levelIndex(w.level)))
  }
  const seen = new Set<string>()
  return words.filter((w) => {
    if (!/^[a-z]{3,12}$/.test(w.word) || seen.has(w.word)) return false
    seen.add(w.word)
    return first.get(w.word) === levelIndex(w.level)
  })
}

export function buildPlacement(words: Word[], rng: Rng): PlacementItem[] {
  const pool = candidates(words)
  const real: PlacementItem[] = LEVELS.flatMap((level) => {
    const inLevel = pool.filter((w) => w.level === level)
    if (inLevel.length < MIN_PER_LEVEL) return []
    return shuffle(inLevel, rng)
      .slice(0, PER_LEVEL)
      .map((w) => ({ kind: 'real' as const, word: w.word, level }))
  })
  const fake = shuffle(PSEUDOWORDS, rng)
    .slice(0, PSEUDO_COUNT)
    .map((word) => ({ kind: 'fake' as const, word }))
  return shuffle([...real, ...fake], rng)
}

export interface LevelResult {
  level: Level
  total: number
  yes: number
  /** الدرجة المصحّحة بعد خصم التخمين (0–1). */
  score: number
}

export interface PlacementResult {
  levels: LevelResult[]
  falseAlarms: number
  fakeTotal: number
  suggested: Level
  /** نتيجة غير موثوقة: اختار كلمات مختلقة كثيرة. */
  unreliable: boolean
}

export function scorePlacement(items: PlacementItem[], answers: boolean[]): PlacementResult {
  const fakes = items.map((it, i) => [it, answers[i]] as const).filter(([it]) => it.kind === 'fake')
  const falseAlarms = fakes.filter(([, yes]) => yes).length
  const f = fakes.length ? falseAlarms / fakes.length : 0
  const levels = LEVELS.map((level) => {
    const own = items.map((it, i) => [it, answers[i]] as const).filter(([it]) => it.kind === 'real' && it.level === level)
    const yes = own.filter(([, a]) => a).length
    const h = own.length ? yes / own.length : 0
    const score = f >= 1 ? 0 : Math.max(0, (h - f) / (1 - f))
    return { level, total: own.length, yes, score }
  }).filter((l) => l.total > 0)
  const firstWeak = levels.find((l) => l.score < KNOWN_THRESHOLD)
  const suggested = firstWeak?.level ?? levels[levels.length - 1]?.level ?? 'A1'
  return { levels, falseAlarms, fakeTotal: fakes.length, suggested, unreliable: f > 0.25 }
}
