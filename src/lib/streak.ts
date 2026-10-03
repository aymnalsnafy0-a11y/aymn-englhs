import { addDays, type DayKey } from './dates'

/**
 * سلسلة الأيام المتتالية. اليوم الحالي غير المكتمل لا يكسر السلسلة:
 * إن لم يكن اليوم نشطًا بعد نعدّ من الأمس.
 */
export function currentStreak(activeDays: Iterable<DayKey>, today: DayKey): number {
  const days = new Set(activeDays)
  let cursor = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function bestStreak(activeDays: Iterable<DayKey>): number {
  const sorted = [...new Set(activeDays)].sort()
  let best = 0
  let run = 0
  let prev: DayKey | null = null
  for (const day of sorted) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}
