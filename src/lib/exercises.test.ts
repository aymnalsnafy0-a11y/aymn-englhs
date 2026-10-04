import { describe, expect, it } from 'vitest'
import { correctAnswerText, gradeExercise, normalizeAnswer, scramble, splitPrompt, type Exercise } from './exercises'
import { seededRng } from './quiz'

describe('splitPrompt', () => {
  it('uses the Arabic ask when present', () => {
    expect(splitPrompt({ type: 'mcq', ask: 'اختر الفعل المناسب', q: 'We ____ breakfast.', options: ['a', 'b'], answer: 0 })).toEqual({
      ask: 'اختر الفعل المناسب',
      body: 'We ____ breakfast.',
    })
  })
  it('splits an English instruction before a colon (older exercises)', () => {
    expect(splitPrompt({ type: 'mcq', q: 'Choose the correct form: We _____ a traditional breakfast.', options: ['a', 'b'], answer: 0 })).toEqual({
      ask: 'Choose the correct form',
      body: 'We _____ a traditional breakfast.',
    })
  })
  it('keeps colons that are part of the sentence and falls back to a default ask', () => {
    const s = splitPrompt({ type: 'tf', q: 'Time: we use "at" with hours.', answer: true })
    expect(s.body).toBe('Time: we use "at" with hours.')
    expect(s.ask).toBe('هل هذه الجملة صحيحة أم خاطئة؟')
  })
})

describe('grading', () => {
  it('multiple choice and true/false', () => {
    const mcq: Exercise = { type: 'mcq', q: 'She ___ a doctor.', options: ['is', 'are', 'am'], answer: 0 }
    expect(gradeExercise(mcq, 0)).toBe(true)
    expect(gradeExercise(mcq, 1)).toBe(false)
    expect(gradeExercise({ type: 'tf', q: 'x', answer: false }, false)).toBe(true)
  })

  it('fill in the blank accepts any listed answer, case and spacing insensitive', () => {
    const fill: Exercise = { type: 'fill', q: 'I ____ to school yesterday.', answers: ['went', 'walked'] }
    expect(gradeExercise(fill, '  Went ')).toBe(true)
    expect(gradeExercise(fill, 'walked.')).toBe(true)
    expect(gradeExercise(fill, 'go')).toBe(false)
    expect(normalizeAnswer("Don’t  STOP!")).toBe("don't stop")
  })

  it('word order compares the arrangement', () => {
    const order: Exercise = { type: 'order', words: ['I', 'like', 'green', 'tea'] }
    expect(gradeExercise(order, ['I', 'like', 'green', 'tea'])).toBe(true)
    expect(gradeExercise(order, ['I', 'green', 'like', 'tea'])).toBe(false)
    expect(correctAnswerText(order)).toBe('I like green tea')
  })

  it('scramble never returns the correct order', () => {
    const words = ['she', 'is', 'my', 'sister']
    for (let seed = 1; seed < 30; seed++) expect(scramble(words, seededRng(seed)).join(' ')).not.toBe(words.join(' '))
  })
})
