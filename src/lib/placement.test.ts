import { describe, expect, it } from 'vitest'
import { buildPlacement, PER_LEVEL, PSEUDO_COUNT, scorePlacement, type PlacementItem } from './placement'
import { seededRng } from './quiz'
import { buildWordList } from './words'
import { LEVELS } from './types'

const words = buildWordList(
  LEVELS.flatMap((level) =>
    Array.from({ length: 12 }, (_, i) => ({ word: `${'pqrst'[LEVELS.indexOf(level)]}word${'abcdefghijkl'[i]}`, level, pos: 'noun' })),
  ),
)

describe('buildPlacement', () => {
  it('takes 8 words per level plus 12 pseudowords, shuffled', () => {
    const items = buildPlacement(words, seededRng(4))
    expect(items).toHaveLength(LEVELS.length * PER_LEVEL + PSEUDO_COUNT)
    expect(items.filter((i) => i.kind === 'fake')).toHaveLength(PSEUDO_COUNT)
    expect(new Set(items.map((i) => i.word)).size).toBe(items.length)
  })

  it('skips levels with too few words and later senses of basic words', () => {
    const small = buildWordList([
      ...Array.from({ length: 6 }, (_, i) => ({ word: `water${'abcdef'[i]}`, level: 'A1' as const, pos: 'noun' })),
      { word: 'watera', level: 'B1' as const, pos: 'verb' },
    ])
    const items = buildPlacement(small, seededRng(1))
    expect(items.filter((i) => i.kind === 'real').every((i) => i.kind === 'real' && i.level === 'A1')).toBe(true)
  })
})

describe('scorePlacement', () => {
  const real = (level: 'A1' | 'A2' | 'B1', n: number): PlacementItem[] =>
    Array.from({ length: n }, (_, i) => ({ kind: 'real', word: `${level}${i}`, level }))
  const fake = (n: number): PlacementItem[] => Array.from({ length: n }, (_, i) => ({ kind: 'fake', word: `f${i}` }))

  it('suggests the first level below 80% after correcting for guessing', () => {
    const items = [...real('A1', 8), ...real('A2', 8), ...real('B1', 8), ...fake(10)]
    const answers = [
      ...Array(8).fill(true), // A1: 100%
      ...[true, true, true, true, true, true, true, false], // A2: 87.5%
      ...[true, true, true, false, false, false, false, false], // B1: 37.5%
      ...Array(10).fill(false),
    ]
    const r = scorePlacement(items, answers)
    expect(r.suggested).toBe('B1')
    expect(r.falseAlarms).toBe(0)
    expect(r.unreliable).toBe(false)
  })

  it('penalises saying yes to made-up words', () => {
    const items = [...real('A1', 8), ...real('A2', 8), ...fake(10)]
    const answers = [...Array(8).fill(true), ...[true, true, true, true, true, true, true, false], ...Array(3).fill(true), ...Array(7).fill(false)]
    const r = scorePlacement(items, answers)
    // A2: (0.875 − 0.3) / 0.7 ≈ 0.82 → still known; A1 stays 1
    expect(r.levels.map((l) => Math.round(l.score * 100))).toEqual([100, 82])
    expect(r.suggested).toBe('A2')
    expect(r.unreliable).toBe(true)
  })

  it('suggests A1 when nothing is known', () => {
    const items = [...real('A1', 8), ...fake(4)]
    expect(scorePlacement(items, Array(12).fill(false)).suggested).toBe('A1')
  })
})
