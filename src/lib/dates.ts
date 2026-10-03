/** مفتاح يوم محلي بصيغة YYYY-MM-DD. كل الجدولة تعمل بالأيام لا بالساعات. */
export type DayKey = string

export function toDayKey(date: Date = new Date()): DayKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromDayKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((fromDayKey(to).getTime() - fromDayKey(from).getTime()) / 86_400_000)
}
