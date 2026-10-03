/** اختيار كلمات الاختبار الأسبوعي واختبار نهاية المستوى — دوال نقية. */
import { diffDays, type DayKey } from './dates'
import { isKnown, type ProgressStatus } from './plan'
import { shuffle, type Rng } from './quiz'
import type { Level, Word } from './types'

export const WEEKLY_LIMIT = 15
export const WEEKLY_MIN = 5
export const LEVEL_TEST_SIZE = 20
export const LEVEL_TEST_MIN = 5

interface LearnedRow {
  wordId: string
  status: ProgressStatus
  learnedAt?: DayKey
}

/** كلمات تعلّمها المتعلم عبر البطاقات في آخر 7 أيام (بما فيها اليوم). */
export function weeklyCandidates(rows: LearnedRow[], today: DayKey): string[] {
  return rows
    .filter((r) => r.learnedAt && r.status !== 'known' && diffDays(r.learnedAt, today) < 7)
    .map((r) => r.wordId)
}

export function pickWeekly(rows: LearnedRow[], today: DayKey, rng: Rng): string[] {
  return shuffle(weeklyCandidates(rows, today), rng).slice(0, WEEKLY_LIMIT)
}

/**
 * هل حان الاختبار الأسبوعي؟ مرّ أسبوع على بدء التعلّم (أو على آخر اختبار أسبوعي)
 * وفي الأسبوع كلمات كافية.
 */
export function weeklyDue(rows: LearnedRow[], lastWeekly: DayKey | undefined, today: DayKey): boolean {
  if (weeklyCandidates(rows, today).length < WEEKLY_MIN) return false
  const firstLearned = rows
    .map((r) => r.learnedAt)
    .filter((d): d is DayKey => !!d)
    .sort()[0]
  const since = lastWeekly ?? firstLearned
  return !!since && diffDays(since, today) >= 6
}

/** كلمات المستوى التي «مرّت» على المتعلم: معروفة أو قيد التعلّم أو محفوظة. */
export function levelCandidates(
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
  level: Level,
): Word[] {
  return words.filter((w) => w.level === level && (isKnown(w, startLevel, progress.get(w.id)) || progress.has(w.id)))
}

export function pickLevelTest(
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
  level: Level,
  rng: Rng,
): Word[] {
  return shuffle(levelCandidates(words, progress, startLevel, level), rng).slice(0, LEVEL_TEST_SIZE)
}
