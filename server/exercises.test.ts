import { describe, expect, it, vi } from 'vitest'
import { buildExercisePrompt, generateExercises, parseExerciseRequest, validateExercise } from './exercises'

const reply = (json: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 })

describe('parseExerciseRequest', () => {
  it('needs notes or images, clamps the count and validates images', () => {
    expect(() => parseExerciseRequest({ level: 'A2' })).toThrow()
    const r = parseExerciseRequest({ level: 'A2', notes: 'Past simple: went, saw', count: 99 })
    expect(r.count).toBe(20)
    expect(r.types).toEqual(['mcq', 'tf', 'fill', 'order'])
    expect(() => parseExerciseRequest({ level: 'A2', images: [{ mime: 'image/gif', data: 'AAAA' }] })).toThrow()
    expect(() => parseExerciseRequest({ level: 'A2', images: [{ mime: 'image/png', data: 'not base64!' }] })).toThrow()
    expect(parseExerciseRequest({ level: 'B1', images: [{ mime: 'image/png', data: 'iVBORw0K' }], types: ['mcq', 'bogus'] }).types).toEqual(['mcq'])
  })

  it('builds a prompt that mentions images, notes, level and count', () => {
    const p = buildExercisePrompt(parseExerciseRequest({ level: 'A2', notes: 'There is / There are', images: [{ mime: 'image/jpeg', data: 'AAAA' }], count: 8 }))
    expect(p).toContain('CEFR A2')
    expect(p).toContain('attached 1 image')
    expect(p).toContain('There is / There are')
    expect(p).toContain('exactly 8 exercises')
  })
})

describe('validateExercise', () => {
  it('keeps well-formed exercises of every type', () => {
    expect(validateExercise({ type: 'mcq', q: 'She ___ tall.', options: ['is', 'are'], answer: '0', explain: 'مفرد' })).toMatchObject({ answer: 0 })
    expect(validateExercise({ type: 'tf', q: 'x', answer: 'false' })).toMatchObject({ answer: false })
    expect(validateExercise({ type: 'fill', q: 'I ___ home.', answers: ['went'] })).toMatchObject({ q: 'I ____ home.' })
    expect(validateExercise({ type: 'order', words: ['I', 'am', 'here'], q: 'أنا هنا' })).toBeTruthy()
  })

  it('drops broken ones', () => {
    expect(validateExercise({ type: 'mcq', q: 'x', options: ['a', 'a'], answer: 0 })).toBeNull()
    expect(validateExercise({ type: 'mcq', q: 'x', options: ['a', 'b'], answer: 5 })).toBeNull()
    expect(validateExercise({ type: 'tf', q: 'x', answer: 'maybe' })).toBeNull()
    expect(validateExercise({ type: 'fill', q: 'no blank here', answers: ['x'] })).toBeNull()
    expect(validateExercise({ type: 'fill', q: 'two ____ blanks ____', answers: ['x'] })).toBeNull()
    expect(validateExercise({ type: 'order', words: ['two', 'words'] })).toBeNull()
    expect(validateExercise({ type: 'essay', q: 'x' })).toBeNull()
  })
})

describe('generateExercises', () => {
  it('sends images inline and keeps only valid exercises', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      reply({
        title: 'الماضي البسيط',
        summary: 'الدرس عن الماضي البسيط.',
        exercises: [
          { type: 'mcq', q: 'Yesterday I ___ to school.', options: ['go', 'went', 'goes'], answer: '1', explain: 'went ماضي go' },
          { type: 'fill', q: 'broken' },
        ],
      }),
    )
    const r = await generateExercises(
      parseExerciseRequest({ level: 'A2', images: [{ mime: 'image/png', data: 'iVBORw0K' }] }),
      { GEMINI_API_KEY: 'k' },
      fetchImpl as typeof fetch,
    )
    expect(r.exercises).toHaveLength(1)
    expect(r.title).toBe('الماضي البسيط')
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(body.contents[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/png', data: 'iVBORw0K' } })
  })
})
