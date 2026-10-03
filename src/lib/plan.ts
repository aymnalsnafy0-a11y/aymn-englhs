import { levelIndex, LEVELS, type Level, type Word } from './types'

export const DAILY_OPTIONS = [5, 10, 20, 25, 30] as const
export const DEFAULT_DAILY = 10

export type ProgressStatus = 'learning' | 'known' | 'mastered'

/** وقت تقريبي بالدقائق: بطاقات + قصة + اختبار. */
export function estimateMinutes(newWords: number): number {
  const cards = newWords * 1.5
  const story = 3
  const quiz = newWords * 0.5
  return Math.round(cards + story + quiz)
}

/** مدة تقريبية لإنهاء مستوى بعدد كلمات يومي معيّن (بالأيام). */
export function estimateDays(totalWords: number, perDay: number): number {
  return Math.ceil(totalWords / Math.max(1, perDay))
}

/**
 * الكلمة «معروفة» إذا: علّمها المتعلم بـ«أعرفها» أو حُفظت بالمراجعة،
 * أو كانت من مستوى أقل من مستوى البداية ولم يبدأ تعلّمها بعد.
 */
export function isKnown(word: Word, startLevel: Level, status: ProgressStatus | undefined): boolean {
  if (status === 'known' || status === 'mastered') return true
  return status === undefined && levelIndex(word.level) < levelIndex(startLevel)
}

/**
 * الكلمات الجديدة التالية بالترتيب، من مستوى البداية فما فوق، دون ما له تقدّم سابق.
 * priority: كلمات حفظها المتعلم من المتصفح — تأتي أولًا حتى لو كانت من مستوى أقل.
 */
export function pickNewWords(
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
  count: number,
  exclude: Set<string> = new Set(),
  priority: string[] = [],
): Word[] {
  const minLevel = levelIndex(startLevel)
  const result: Word[] = []
  const byId = new Map(words.map((w) => [w.id, w]))
  for (const id of priority) {
    const w = byId.get(id)
    if (result.length >= count) break
    if (!w || progress.has(id) || exclude.has(id) || result.includes(w)) continue
    result.push(w)
  }
  for (const w of words) {
    if (result.includes(w)) continue
    if (result.length >= count) break
    if (levelIndex(w.level) < minLevel) continue
    if (progress.has(w.id) || exclude.has(w.id)) continue
    result.push(w)
  }
  return result
}

export interface LevelSummary {
  level: Level
  total: number
  known: number
  learning: number
}

export function summarize(
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
): { known: number; total: number; levels: LevelSummary[] } {
  const levels = LEVELS.map((level) => ({ level, total: 0, known: 0, learning: 0 }))
  let known = 0
  for (const w of words) {
    const entry = levels[levelIndex(w.level)]
    const status = progress.get(w.id)
    entry.total++
    if (isKnown(w, startLevel, status)) {
      entry.known++
      known++
    } else if (status === 'learning') {
      entry.learning++
    }
  }
  return { known, total: words.length, levels }
}

export interface DayPlan {
  date: string
  /** عدد الكلمات الجديدة المستهدف لهذا اليوم (قد يقل عن الإعداد عند تراكم المراجعات). */
  targetCount: number
  startLevel: Level
  wordIds: string[]
  doneIds: string[]
  /** نتيجة آخر محاولة للاختبار الشامل لهذا اليوم. */
  quiz?: { total: number; correct: number }
}

/**
 * يبني خطة اليوم أو يحدّثها دون فقدان ما أُنجز:
 * - الكلمات المنجزة تبقى.
 * - الكلمات غير المنجزة تبقى ما دامت بلا تقدّم ومن مستوى البداية فما فوق
 *   (كلمة «أعرفها» تخرج وتحل محلها الكلمة التالية).
 * - تُكمّل الخطة حتى العدد المستهدف أو تُقص الزيادة.
 */
export function reconcilePlan(
  existing: DayPlan | undefined,
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
  targetCount: number,
  today: string,
  priority: string[] = [],
): DayPlan {
  const fresh = !existing || existing.date !== today
  const doneIds = fresh ? [] : existing.doneIds
  const byId = new Map(words.map((w) => [w.id, w]))
  const minLevel = levelIndex(startLevel)
  const remaining = Math.max(0, targetCount - doneIds.length)

  const keep = fresh
    ? []
    : existing.wordIds.filter((id) => {
        if (doneIds.includes(id)) return false
        const w = byId.get(id)
        return !!w && !progress.has(id) && levelIndex(w.level) >= minLevel
      })
  const kept = keep.slice(0, remaining)
  const extra = pickNewWords(words, progress, startLevel, remaining - kept.length, new Set([...doneIds, ...kept]), priority)

  return {
    date: today,
    targetCount,
    startLevel,
    wordIds: [...doneIds, ...kept, ...extra.map((w) => w.id)],
    doneIds,
    ...(fresh || !existing.quiz ? {} : { quiz: existing.quiz }),
  }
}
