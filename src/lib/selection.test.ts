import { describe, expect, it } from 'vitest'
import { levelCandidates, pickLevelTest, weeklyCandidates, weeklyDue } from './selection'
import { seededRng } from './quiz'
import { buildWordList } from './words'
import type { ProgressStatus } from './plan'

const today = '2026-10-10'

describe('weekly test', () => {
  const rows = [
    { wordId: 'a', status: 'learning' as const, learnedAt: '2026-10-10' },
    { wordId: 'b', status: 'mastered' as const, learnedAt: '2026-10-04' },
    { wordId: 'c', status: 'learning' as const, learnedAt: '2026-10-03' },
    { wordId: 'd', status: 'known' as const },
    { wordId: 'e', status: 'learning' as const, learnedAt: '2026-10-09' },
    { wordId: 'f', status: 'learning' as const, learnedAt: '2026-10-08' },
    { wordId: 'g', status: 'learning' as const, learnedAt: '2026-10-07' },
  ]

  it('keeps only words learned in the last 7 days', () => {
    expect(weeklyCandidates(rows, today)).toEqual(['a', 'b', 'e', 'f', 'g'])
  })

  it('is due a week after learning started (or after the last weekly) with enough words', () => {
    expect(weeklyDue(rows, undefined, today)).toBe(true)
    const freshStart = rows.filter((r) => r.learnedAt && r.learnedAt >= '2026-10-07')
    expect(weeklyDue([...freshStart, { wordId: 'h', status: 'learning', learnedAt: '2026-10-10' }], undefined, today)).toBe(false)
    expect(weeklyDue(rows, '2026-10-05', today)).toBe(false)
    expect(weeklyDue(rows, '2026-10-03', today)).toBe(true)
    expect(weeklyDue(rows.slice(0, 3), undefined, today)).toBe(false)
  })
})

describe('level test', () => {
  const words = buildWordList(
    ['A1', 'A2'].flatMap((level) =>
      [1, 2, 3, 4].map((n) => ({ word: `${level}w${n}`, level: level as 'A1' | 'A2', pos: 'noun' })),
    ),
  )

  it('uses words the learner has met: implicit known, learning, known or mastered', () => {
    const progress = new Map<string, ProgressStatus>([
      ['a2w1|noun', 'learning'],
      ['a2w2|noun', 'known'],
    ])
    expect(levelCandidates(words, progress, 'A2', 'A1')).toHaveLength(4)
    expect(levelCandidates(words, progress, 'A2', 'A2').map((w) => w.word)).toEqual(['A2w1', 'A2w2'])
    expect(pickLevelTest(words, progress, 'A2', 'A1', seededRng(1))).toHaveLength(4)
  })
})
