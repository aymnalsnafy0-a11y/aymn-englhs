import { describe, expect, it } from 'vitest'
import {
  mergeActivity,
  mergeCore,
  mergeMistakes,
  mergePlans,
  mergeProgress,
  mergeQuizzes,
  mergeStories,
  packProgress,
  unpackProgress,
  type SyncProgress,
} from './sync'
import { startLearning, review } from './srs'

describe('progress', () => {
  it('keeps the most recently updated record per word', () => {
    const a: SyncProgress[] = [
      { wordId: 'cat|noun', status: 'learning', updatedAt: 10 },
      { wordId: 'dog|noun', status: 'known', updatedAt: 50 },
    ]
    const b: SyncProgress[] = [
      { wordId: 'cat|noun', status: 'mastered', updatedAt: 20 },
      { wordId: 'dog|noun', status: 'learning', updatedAt: 40 },
      { wordId: 'sun|noun', status: 'known', updatedAt: 5 },
    ]
    const m = Object.fromEntries(mergeProgress(a, b).map((p) => [p.wordId, p.status]))
    expect(m).toEqual({ 'cat|noun': 'mastered', 'dog|noun': 'known', 'sun|noun': 'known' })
  })

  it('packs and unpacks without losing SRS state, compactly', () => {
    const srs = review(startLearning('2026-10-01'), 'forgot', '2026-10-02').state
    const rows: SyncProgress[] = [
      { wordId: 'family|noun', status: 'learning', srs, learnedAt: '2026-10-01', updatedAt: 123 },
      { wordId: 'known|adjective', status: 'known', updatedAt: 9 },
    ]
    const packed = packProgress(rows)
    expect(unpackProgress(JSON.parse(JSON.stringify(packed)))).toEqual(rows)
    const big = Array.from({ length: 5300 }, (_, i) => ({ ...rows[0], wordId: `word${i}|noun` }))
    expect(JSON.stringify(packProgress(big)).length).toBeLessThan(600_000)
  })
})

describe('plans', () => {
  it('unions finished words of the same day', () => {
    const base = { date: '2026-10-04', targetCount: 3, startLevel: 'A1' as const }
    const m = mergePlans(
      [{ ...base, wordIds: ['a', 'b', 'c'], doneIds: ['a'] }],
      [{ ...base, wordIds: ['a', 'b', 'c'], doneIds: ['b'], quiz: { total: 2, correct: 2 } }],
    )[0]
    expect(m.doneIds).toEqual(['a', 'b'])
    expect(m.wordIds).toEqual(['a', 'b', 'c'])
    expect(m.quiz).toEqual({ total: 2, correct: 2 })
  })
})

describe('others', () => {
  it('mistakes: newer update wins (resolved on another device)', () => {
    const open = { wordId: 'x', count: 1, firstAt: '2026-10-01', lastAt: '2026-10-01', source: 'daily', updatedAt: 1 }
    const fixed = { ...open, resolvedAt: '2026-10-02', updatedAt: 2 }
    expect(mergeMistakes([open], [fixed])[0].resolvedAt).toBe('2026-10-02')
  })

  it('quizzes: union without duplicates', () => {
    const q = { at: 1, kind: 'daily', date: '2026-10-01', total: 5, correct: 4, wrongIds: ['x'] }
    const q2 = { ...q, at: 2, correct: 5, wrongIds: [] }
    expect(mergeQuizzes([q], [q, q2])).toHaveLength(2)
  })

  it('activity: max per field so repeated syncs do not double-count', () => {
    const r = mergeActivity([{ date: 'd', cards: 3, reviews: 1, quizzes: 0 }], [{ date: 'd', cards: 2, reviews: 4, quizzes: 1 }])
    expect(r[0]).toMatchObject({ cards: 3, reviews: 4, quizzes: 1 })
  })

  it('stories: keep the one with comprehension answers', () => {
    const s = mergeStories([{ date: 'd', title: 'a' }], [{ date: 'd', title: 'a', answers: [1, 0, 2] }])
    expect(s[0].answers).toEqual([1, 0, 2])
  })

  it('core merge is order-independent for settings (newest wins)', () => {
    const a = { settings: { updatedAt: 1, dailyCount: 5 }, plans: [], mistakes: [], quizzes: [], activity: [], saved: [] }
    const b = { ...a, settings: { updatedAt: 2, dailyCount: 20 } }
    expect(mergeCore(a, b).settings?.dailyCount).toBe(20)
    expect(mergeCore(b, a).settings?.dailyCount).toBe(20)
  })
})
