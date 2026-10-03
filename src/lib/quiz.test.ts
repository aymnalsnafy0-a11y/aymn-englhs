import { describe, expect, it } from 'vitest'
import { buildQuiz, grade, passed, score, seededRng, type QuizWord } from './quiz'

const words: QuizWord[] = [
  { id: 'arrive|verb', word: 'arrive', meaningAr: 'يصل', sentences: [{ en: 'We arrived at night.', ar: 'وصلنا ليلًا.' }] },
  { id: 'cloud|noun', word: 'cloud', meaningAr: 'سحابة', sentences: [{ en: 'A cloud in the sky.', ar: 'سحابة في السماء.' }] },
  { id: 'storm|noun', word: 'storm', meaningAr: 'عاصفة', sentences: [{ en: 'The storm came.', ar: 'جاءت العاصفة.' }] },
  { id: 'island|noun', word: 'island', meaningAr: 'جزيرة', sentences: [{ en: 'An island.', ar: 'جزيرة.' }] },
  { id: 'earn|verb', word: 'earn', meaningAr: 'يكسب', sentences: [{ en: 'I earn money.', ar: 'أكسب المال.' }] },
  { id: 'forest|noun', word: 'forest', meaningAr: 'غابة', sentences: [] },
  { id: 'bare|adj', word: 'bare', sentences: [] },
  { id: 'meeting|noun', word: 'meeting', meaningAr: 'اجتماع', sentences: [{ en: 'A long meeting.', ar: 'اجتماع طويل.' }] },
]

describe('buildQuiz', () => {
  const quiz = buildQuiz(words, { rng: seededRng(7) })

  it('asks exactly one question per word', () => {
    expect(quiz.map((q) => q.wordId).sort()).toEqual(words.map((w) => w.id).sort())
  })

  it('mixes question types evenly', () => {
    const types = new Map<string, number>()
    for (const q of quiz) types.set(q.type, (types.get(q.type) ?? 0) + 1)
    expect(types.size).toBe(4)
    expect(Math.max(...types.values()) - Math.min(...types.values())).toBeLessThanOrEqual(1)
  })

  it('falls back to dictation for words without content', () => {
    expect(quiz.find((q) => q.wordId === 'bare|adj')?.type).toBe('dictation')
  })

  it('builds sentence blanks with the inflected form as the answer', () => {
    const q = buildQuiz([words[0]], { rng: seededRng(1), types: ['complete'] })[0]
    expect(q).toMatchObject({ type: 'complete', before: 'We ', after: ' at night.', answer: 'arrived' })
  })

  it('builds 4 distinct options including the right meaning', () => {
    const q = buildQuiz(words.slice(0, 5), { rng: seededRng(3), types: ['mcq'] })[0]
    if (q.type !== 'mcq') throw new Error('expected mcq')
    expect(q.options).toHaveLength(4)
    expect(new Set(q.options).size).toBe(4)
    expect(q.options).toContain(q.answer)
  })

  it('skips dictation without speech and mcq without enough meanings', () => {
    const q = buildQuiz([words[0]], { rng: seededRng(2), speech: false, types: ['dictation', 'mcq', 'arToEn'] })
    expect(q[0].type).toBe('arToEn')
  })

  it('uses a distractor pool when the quiz itself is small', () => {
    const q = buildQuiz([words[0]], { rng: seededRng(2), types: ['mcq'], distractorPool: ['أ', 'ب', 'ج'] })
    expect(q[0].type).toBe('mcq')
  })

  it('is deterministic for a given seed', () => {
    expect(buildQuiz(words, { rng: seededRng(7) })).toEqual(quiz)
  })
})

describe('grade & score', () => {
  it('grades typed answers case-insensitively and reports the first wrong letter', () => {
    const q = { type: 'arToEn' as const, wordId: 'x', word: 'cloud', prompt: 'سحابة', answer: 'cloud' }
    expect(grade(q, ' Cloud ')).toEqual({ correct: true, mismatchAt: -1 })
    expect(grade(q, 'clowd')).toEqual({ correct: false, mismatchAt: 3 })
  })

  it('scores and decides level pass at 80%', () => {
    const qs = buildQuiz(words.slice(0, 5), { rng: seededRng(1) })
    const s = score(qs, [true, true, true, true, false])
    expect(s).toMatchObject({ total: 5, correct: 4 })
    expect(s.wrongIds).toEqual([qs[4].wordId])
    expect(passed(s)).toBe(true)
    expect(passed(score(qs, [true, true, true, false, false]))).toBe(false)
  })
})
