/**
 * دمج بيانات المتعلم بين الأجهزة — وحدة نقية.
 * القاعدة: لكل عنصر نأخذ الأحدث (updatedAt)، ولما يُجمع (الأيام المنجزة، الاختبارات، المحفوظات) نأخذ الاتحاد.
 */
import type { DayPlan, ProgressStatus } from './plan.js'
import type { SrsState } from './srs.js'

export interface SyncProgress {
  wordId: string
  status: ProgressStatus
  srs?: SrsState
  learnedAt?: string
  updatedAt: number
}

export interface SyncMistake {
  wordId: string
  count: number
  firstAt: string
  lastAt: string
  source: string
  resolvedAt?: string
  updatedAt?: number
}

export interface SyncQuiz {
  at?: number
  kind: string
  date: string
  level?: string
  total: number
  correct: number
  wrongIds: string[]
}

export interface SyncActivity {
  date: string
  cards: number
  reviews: number
  quizzes: number
  stories?: number
}

export interface SyncSaved {
  wordId: string
  word: string
  savedAt: number
}

export interface SyncSettings {
  updatedAt?: number
  [key: string]: unknown
}

export interface SyncStory {
  date: string
  answers?: number[]
  [key: string]: unknown
}

export interface CoreData {
  settings?: SyncSettings
  plans: DayPlan[]
  mistakes: SyncMistake[]
  quizzes: SyncQuiz[]
  activity: SyncActivity[]
  saved: SyncSaved[]
}

// ——— دمج عام بالمفتاح ———

function mergeBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>()
  for (const x of a) map.set(key(x), x)
  for (const y of b) {
    const k = key(y)
    const x = map.get(k)
    map.set(k, x === undefined ? y : pick(x, y))
  }
  return [...map.values()]
}

const newer = <T extends { updatedAt?: number }>(x: T, y: T) => ((y.updatedAt ?? 0) > (x.updatedAt ?? 0) ? y : x)

export function mergeProgress(a: SyncProgress[], b: SyncProgress[]): SyncProgress[] {
  return mergeBy(a, b, (p) => p.wordId, newer)
}

export function mergePlans(a: DayPlan[], b: DayPlan[]): DayPlan[] {
  return mergeBy(a, b, (p) => p.date, (x, y) => {
    const doneIds = [...new Set([...x.doneIds, ...y.doneIds])]
    const wordIds = [...new Set([...doneIds, ...x.wordIds, ...y.wordIds])]
    const quiz = !x.quiz ? y.quiz : !y.quiz ? x.quiz : y.quiz.correct > x.quiz.correct ? y.quiz : x.quiz
    return {
      ...x,
      targetCount: Math.max(x.targetCount, y.targetCount),
      wordIds: wordIds.slice(0, Math.max(x.targetCount, y.targetCount, doneIds.length)),
      doneIds,
      ...(quiz ? { quiz } : {}),
    }
  })
}

export function mergeMistakes(a: SyncMistake[], b: SyncMistake[]): SyncMistake[] {
  return mergeBy(a, b, (m) => m.wordId, (x, y) => {
    const ux = x.updatedAt ?? 0
    const uy = y.updatedAt ?? 0
    if (ux !== uy) return uy > ux ? y : x
    return y.lastAt > x.lastAt ? y : x
  })
}

const quizKey = (q: SyncQuiz) => `${q.at ?? 0}|${q.kind}|${q.date}|${q.correct}/${q.total}`

export function mergeQuizzes(a: SyncQuiz[], b: SyncQuiz[], limit = 300): SyncQuiz[] {
  return mergeBy(a, b, quizKey, (x) => x)
    .sort((x, y) => (x.at ?? 0) - (y.at ?? 0) || x.date.localeCompare(y.date))
    .slice(-limit)
}

/** النشاط يُحسب على كل جهاز؛ نأخذ الأكبر لكل حقل حتى لا يتضاعف عند المزامنة المتكررة. */
export function mergeActivity(a: SyncActivity[], b: SyncActivity[]): SyncActivity[] {
  return mergeBy(a, b, (r) => r.date, (x, y) => ({
    date: x.date,
    cards: Math.max(x.cards, y.cards),
    reviews: Math.max(x.reviews, y.reviews),
    quizzes: Math.max(x.quizzes, y.quizzes),
    stories: Math.max(x.stories ?? 0, y.stories ?? 0),
  }))
}

export function mergeSaved(a: SyncSaved[], b: SyncSaved[]): SyncSaved[] {
  return mergeBy(a, b, (s) => s.wordId, (x, y) => (y.savedAt < x.savedAt ? y : x))
}

export function mergeSettings(a?: SyncSettings, b?: SyncSettings): SyncSettings | undefined {
  if (!a) return b
  if (!b) return a
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a
}

/** القصة الواحدة لكل يوم: نحتفظ بالتي فيها إجابات أسئلة الفهم، وإلا الموجودة محليًا. */
export function mergeStories(a: SyncStory[], b: SyncStory[], limit = 60): SyncStory[] {
  return mergeBy(a, b, (s) => s.date, (x, y) => (!x.answers && y.answers ? y : x))
    .sort((x, y) => x.date.localeCompare(y.date))
    .slice(-limit)
}

export function mergeCore(a: CoreData, b: CoreData): CoreData {
  return {
    settings: mergeSettings(a.settings, b.settings),
    plans: mergePlans(a.plans, b.plans).sort((x, y) => x.date.localeCompare(y.date)).slice(-30),
    mistakes: mergeMistakes(a.mistakes, b.mistakes),
    quizzes: mergeQuizzes(a.quizzes, b.quizzes),
    activity: mergeActivity(a.activity, b.activity),
    saved: mergeSaved(a.saved, b.saved),
  }
}

// ——— ترميز مضغوط للتقدّم (آلاف الكلمات تحت حد المستند 1MB) ———

const STATUS_CODE: Record<ProgressStatus, string> = { learning: 'l', known: 'k', mastered: 'm' }
const CODE_STATUS: Record<string, ProgressStatus> = { l: 'learning', k: 'known', m: 'mastered' }

/** [wordId, s, updatedAt, learnedAt?, stage, due, flags, lapses, reviews, lastReviewed] */
type Packed = [string, string, number, string?, number?, (string | null)?, number?, number?, number?, (string | null)?]

export function packProgress(rows: SyncProgress[]): Packed[] {
  return rows.map((r) => {
    const base: Packed = [r.wordId, STATUS_CODE[r.status], r.updatedAt]
    if (!r.srs && !r.learnedAt) return base
    base.push(r.learnedAt ?? '')
    if (r.srs) {
      const s = r.srs
      base.push(s.stage, s.due, (s.relearning ? 1 : 0) | (s.mastered ? 2 : 0), s.lapses, s.reviews, s.lastReviewed)
    }
    return base
  })
}

export function unpackProgress(rows: Packed[]): SyncProgress[] {
  return rows
    .filter((r) => Array.isArray(r) && typeof r[0] === 'string' && CODE_STATUS[r[1]])
    .map((r) => {
      const out: SyncProgress = { wordId: r[0], status: CODE_STATUS[r[1]], updatedAt: Number(r[2]) || 0 }
      if (r[3]) out.learnedAt = r[3]
      if (r.length > 4) {
        const flags = Number(r[6]) || 0
        out.srs = {
          stage: Number(r[4]) || 0,
          due: (r[5] as string | null) ?? null,
          relearning: (flags & 1) === 1,
          mastered: (flags & 2) === 2,
          lapses: Number(r[7]) || 0,
          reviews: Number(r[8]) || 0,
          lastReviewed: (r[9] as string | null) ?? null,
        }
      }
      return out
    })
}
