/**
 * المراجعة المتباعدة — وحدة نقية بلا آثار جانبية.
 *
 * الفواصل: 1 ← 3 ← 7 ← 14 ← 30 يومًا.
 * - «نسيتها»: ترجع للبداية وتُعاد في نفس الجلسة (relearning).
 * - «صعبة»: تبقى في نفس المرحلة وتُجدول بنفس الفاصل.
 * - «سهلة»: تنتقل للمرحلة التالية. النجاح «سهلة» في مراجعة الـ 30 يومًا يجعلها «محفوظة».
 */
import { addDays, diffDays, type DayKey } from './dates'

export const INTERVALS = [1, 3, 7, 14, 30] as const
export const LAST_STAGE = INTERVALS.length - 1

/** عند تجاوز هذا العدد من المراجعات المستحقة نقترح تقليل الكلمات الجديدة. */
export const REVIEW_OVERLOAD = 100
export const OVERLOAD_SUGGESTED_NEW = 5

export type Rating = 'forgot' | 'hard' | 'easy'

export interface SrsState {
  /** فهرس الفاصل الحالي في INTERVALS. */
  stage: number
  /** يوم الاستحقاق التالي، أو null إذا أصبحت محفوظة. */
  due: DayKey | null
  /** نُسيت في هذه الجلسة وتنتظر إعادتها قبل جدولتها من جديد. */
  relearning: boolean
  mastered: boolean
  lapses: number
  reviews: number
  lastReviewed: DayKey | null
}

/** حالة كلمة أنهى المتعلم بطاقتها اليوم لأول مرة: أول مراجعة بعد يوم. */
export function startLearning(today: DayKey): SrsState {
  return {
    stage: 0,
    due: addDays(today, INTERVALS[0]),
    relearning: false,
    mastered: false,
    lapses: 0,
    reviews: 0,
    lastReviewed: null,
  }
}

export interface ReviewResult {
  state: SrsState
  /** يجب عرضها مرة أخرى في نفس الجلسة. */
  repeatInSession: boolean
}

export function review(state: SrsState, rating: Rating, today: DayKey): ReviewResult {
  if (state.mastered) return { state, repeatInSession: false }

  const base = { ...state, reviews: state.reviews + 1, lastReviewed: today }

  if (rating === 'forgot') {
    return {
      state: { ...base, stage: 0, due: today, relearning: true, lapses: state.lapses + 1 },
      repeatInSession: true,
    }
  }

  // بعد النسيان: أي إجابة غير «نسيتها» تعيدها لبداية السلّم (بعد يوم).
  if (state.relearning) {
    return {
      state: { ...base, stage: 0, due: addDays(today, INTERVALS[0]), relearning: false },
      repeatInSession: false,
    }
  }

  if (rating === 'hard') {
    return {
      state: { ...base, due: addDays(today, INTERVALS[state.stage]) },
      repeatInSession: false,
    }
  }

  // easy
  if (state.stage >= LAST_STAGE) {
    return { state: { ...base, stage: LAST_STAGE, due: null, mastered: true }, repeatInSession: false }
  }
  const stage = state.stage + 1
  return { state: { ...base, stage, due: addDays(today, INTERVALS[stage]) }, repeatInSession: false }
}

export function isDue(state: SrsState, today: DayKey): boolean {
  return !state.mastered && state.due !== null && diffDays(state.due, today) >= 0
}

/**
 * المستحقة اليوم: المُعاد تعلّمها أولًا، ثم كلمات دفتر الأخطاء (priority)،
 * ثم الأقدم استحقاقًا، ثم المرحلة الأدنى.
 */
export function dueQueue<T extends { wordId?: string; srs: SrsState }>(
  items: T[],
  today: DayKey,
  priority: Set<string> = new Set(),
): T[] {
  const first = (item: T) => Number(item.wordId !== undefined && priority.has(item.wordId))
  return items
    .filter((item) => isDue(item.srs, today))
    .sort(
      (a, b) =>
        Number(b.srs.relearning) - Number(a.srs.relearning) ||
        first(b) - first(a) ||
        (a.srs.due ?? '').localeCompare(b.srs.due ?? '') ||
        a.srs.stage - b.srs.stage,
    )
}

/** يعيد عددًا مقترحًا أقل للكلمات الجديدة عند تراكم المراجعات، أو null إن لم يلزم. */
export function suggestedNewCount(dueCount: number, requested: number): number | null {
  if (dueCount <= REVIEW_OVERLOAD) return null
  return requested > OVERLOAD_SUGGESTED_NEW ? OVERLOAD_SUGGESTED_NEW : null
}

/**
 * خطأ في اختبار (يومي/أسبوعي/نهاية مستوى/دفتر الأخطاء): الكلمة تعود لبداية السلّم
 * وتُستحق غدًا لتظهر أول المراجعات. كلمة بلا حالة (معروفة ضمنيًا) تبدأ التعلّم الآن.
 */
export function relapse(state: SrsState | undefined, today: DayKey): SrsState {
  const base = state ?? startLearning(today)
  return {
    ...base,
    stage: 0,
    due: addDays(today, INTERVALS[0]),
    relearning: false,
    mastered: false,
    lapses: base.lapses + (state ? 1 : 0),
  }
}
