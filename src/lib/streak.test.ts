import { describe, expect, it } from 'vitest'
import { bestStreak, currentStreak } from './streak'

describe('streak', () => {
  const today = '2026-10-03'
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-10-01', '2026-10-02', '2026-10-03'], today)).toBe(3)
  })
  it('keeps the streak alive while today is not done yet', () => {
    expect(currentStreak(['2026-10-01', '2026-10-02'], today)).toBe(2)
  })
  it('breaks after a missed day', () => {
    expect(currentStreak(['2026-09-30', '2026-10-01'], today)).toBe(0)
  })
  it('finds the best run across month boundaries', () => {
    expect(bestStreak(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03', '2026-10-01'])).toBe(3)
    expect(bestStreak([])).toBe(0)
  })
})
