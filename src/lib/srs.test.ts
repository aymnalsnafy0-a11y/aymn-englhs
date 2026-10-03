import { describe, expect, it } from 'vitest'
import {
  INTERVALS,
  LAST_STAGE,
  dueQueue,
  isDue,
  review,
  startLearning,
  suggestedNewCount,
  type SrsState,
} from './srs'
import { addDays } from './dates'

const today = '2026-10-03'

function at(stage: number, overrides: Partial<SrsState> = {}): SrsState {
  return { ...startLearning(today), stage, due: today, ...overrides }
}

describe('startLearning', () => {
  it('schedules the first review one day later', () => {
    const s = startLearning(today)
    expect(s).toMatchObject({ stage: 0, due: '2026-10-04', mastered: false, relearning: false })
    expect(isDue(s, today)).toBe(false)
    expect(isDue(s, '2026-10-04')).toBe(true)
  })
})

describe('review: easy', () => {
  it('walks the ladder 1 → 3 → 7 → 14 → 30 days', () => {
    let s = startLearning(today)
    let day = s.due!
    const gaps: number[] = []
    for (let i = 0; i < LAST_STAGE; i++) {
      s = review(s, 'easy', day).state
      gaps.push(INTERVALS[s.stage])
      expect(s.due).toBe(addDays(day, INTERVALS[s.stage]))
      day = s.due!
    }
    expect(gaps).toEqual([3, 7, 14, 30])
    expect(s.stage).toBe(LAST_STAGE)
    expect(s.mastered).toBe(false)
  })

  it('marks the word mastered after passing the 30-day review', () => {
    const r = review(at(LAST_STAGE), 'easy', today)
    expect(r.state.mastered).toBe(true)
    expect(r.state.due).toBeNull()
    expect(isDue(r.state, addDays(today, 365))).toBe(false)
  })

  it('leaves a mastered word untouched', () => {
    const mastered = review(at(LAST_STAGE), 'easy', today).state
    expect(review(mastered, 'forgot', today).state).toBe(mastered)
  })
})

describe('review: hard', () => {
  it('keeps the stage and reschedules with the same interval', () => {
    const r = review(at(2), 'hard', today)
    expect(r.state.stage).toBe(2)
    expect(r.state.due).toBe(addDays(today, 7))
    expect(r.repeatInSession).toBe(false)
  })

  it('does not master a word at the last stage', () => {
    const r = review(at(LAST_STAGE), 'hard', today)
    expect(r.state.mastered).toBe(false)
    expect(r.state.due).toBe(addDays(today, 30))
  })
})

describe('review: forgot', () => {
  it('resets to the start, stays due today and repeats in the session', () => {
    const r = review(at(3, { lapses: 1 }), 'forgot', today)
    expect(r.repeatInSession).toBe(true)
    expect(r.state).toMatchObject({ stage: 0, due: today, relearning: true, lapses: 2 })
    expect(isDue(r.state, today)).toBe(true)
  })

  it('after relearning, any non-forgot answer schedules 1 day later from stage 0', () => {
    const forgotten = review(at(3), 'forgot', today).state
    for (const rating of ['hard', 'easy'] as const) {
      const r = review(forgotten, rating, today)
      expect(r.state).toMatchObject({ stage: 0, due: addDays(today, 1), relearning: false })
    }
  })

  it('forgetting again during relearning keeps repeating', () => {
    const once = review(at(1), 'forgot', today).state
    const twice = review(once, 'forgot', today)
    expect(twice.repeatInSession).toBe(true)
    expect(twice.state.lapses).toBe(2)
  })

  it('counts reviews and remembers the last review day', () => {
    const r = review(at(0, { reviews: 4 }), 'hard', today)
    expect(r.state.reviews).toBe(5)
    expect(r.state.lastReviewed).toBe(today)
  })
})

describe('dueQueue', () => {
  it('returns only due words: relearning first, then most overdue, then lowest stage', () => {
    const items = [
      { id: 'future', srs: at(1, { due: addDays(today, 2) }) },
      { id: 'today-high', srs: at(3, { due: today }) },
      { id: 'today-low', srs: at(0, { due: today }) },
      { id: 'overdue', srs: at(2, { due: addDays(today, -5) }) },
      { id: 'relearn', srs: at(0, { due: today, relearning: true }) },
      { id: 'mastered', srs: at(LAST_STAGE, { due: null, mastered: true }) },
    ]
    expect(dueQueue(items, today).map((i) => i.id)).toEqual(['relearn', 'overdue', 'today-low', 'today-high'])
  })
})

describe('suggestedNewCount', () => {
  it('suggests fewer new words only when reviews pile up', () => {
    expect(suggestedNewCount(100, 20)).toBeNull()
    expect(suggestedNewCount(101, 20)).toBe(5)
    expect(suggestedNewCount(150, 5)).toBeNull()
  })
})

describe('dueQueue priority (mistakes notebook)', () => {
  it('puts mistake words before other due words, after relearning ones', () => {
    const items = [
      { wordId: 'old', srs: at(1, { due: addDays(today, -3) }) },
      { wordId: 'mistake', srs: at(0, { due: today }) },
      { wordId: 'relearn', srs: at(0, { due: today, relearning: true }) },
    ]
    expect(dueQueue(items, today, new Set(['mistake'])).map((i) => i.wordId)).toEqual(['relearn', 'mistake', 'old'])
  })
})

describe('relapse', async () => {
  const { relapse } = await import('./srs')
  it('sends a word back to stage 0, due tomorrow, and un-masters it', () => {
    const mastered = { ...at(LAST_STAGE), mastered: true, due: null, lapses: 1 }
    expect(relapse(mastered, today)).toMatchObject({ stage: 0, due: addDays(today, 1), mastered: false, lapses: 2 })
  })
  it('starts learning a word that had no state (known implicitly)', () => {
    expect(relapse(undefined, today)).toMatchObject({ stage: 0, due: addDays(today, 1), lapses: 0 })
  })
})
