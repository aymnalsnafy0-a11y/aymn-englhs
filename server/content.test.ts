import { describe, expect, it, vi } from 'vitest'
import { buildContentPrompt, generateContent, handleContent, handleTopics, parseContentRequest, validateContentItem } from './content'

const reply = (json: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 })

const good = {
  word: 'patience',
  meaning_ar: 'صبر',
  syllables: 'pa·tience',
  examples: [
    { en: 'Learning needs patience.', ar: 'التعلّم يحتاج صبرًا.' },
    { en: 'She has no time.', ar: 'ليس لديها وقت.' },
  ],
  memory: { kind: 'family', text: 'patient (صبور) + ce' },
  family: [
    { en: 'patient', pos: 'adjective', ar: 'صبور' },
    { en: 'patience', pos: 'noun', ar: 'صبر' },
    { en: '<b>bad</b>', pos: 'noun', ar: 'x' },
  ],
  topic: 'feelings',
}

describe('validateContentItem', () => {
  it('keeps only examples that contain the word and real family members', () => {
    const c = validateContentItem(good, 'patience')!
    expect(c.examples).toHaveLength(1)
    expect(c.family.map((f) => f.en)).toEqual(['patient'])
    expect(c.syllables).toBe('pa·tience')
    expect(c.topic).toBe('feelings')
  })

  it('rejects items without an Arabic meaning or a usable example, and fixes wrong syllables', () => {
    expect(validateContentItem({ ...good, meaning_ar: 'patience' }, 'patience')).toBeNull()
    expect(validateContentItem({ ...good, examples: [{ en: 'No match here.', ar: 'x' }] }, 'patience')).toBeNull()
    expect(validateContentItem({ ...good, syllables: 'pay·shens' }, 'patience')!.syllables).toBe('patience')
    expect(validateContentItem({ ...good, topic: 'weird' }, 'patience')!.topic).toBeUndefined()
  })
})

describe('content request', () => {
  it('validates input and caps the batch at 10', () => {
    const words = Array.from({ length: 12 }, () => ({ word: 'patience', pos: 'noun', level: 'B1' }))
    expect(parseContentRequest({ words })).toHaveLength(10)
    expect(() => parseContentRequest({ words: [{ word: 'x y z w', level: 'A1' }] })).toThrow()
    expect(() => parseContentRequest({ words: [{ word: 'cat', level: 'D9' }] })).toThrow()
    expect(buildContentPrompt(parseContentRequest({ words: [{ word: 'cat', pos: 'noun', level: 'A1' }] }))).toContain('1. cat (noun) — CEFR A1')
  })

  it('matches items by word and returns null for invalid ones', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(reply({ items: [{ ...good, word: 'storm', meaning_ar: '' }, good] }))
    const r = await generateContent(
      [
        { word: 'patience', level: 'B1' },
        { word: 'storm', level: 'A2' },
      ],
      { GEMINI_API_KEY: 'k' },
      fetchImpl as typeof fetch,
    )
    expect(r.items[0]?.meaningAr).toBe('صبر')
    expect(r.items[1]).toBeNull()
  })

  it('returns error codes from the handler', async () => {
    expect(await handleContent({ words: [] }, { GEMINI_API_KEY: 'k' })).toEqual({ status: 400, json: { error: 'bad_request' } })
  })
})

describe('topics', () => {
  it('maps topics by index and ignores invalid ones', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      reply({ items: [{ i: 1, topic: 'food' }, { i: 0, topic: 'people' }, { i: 9, topic: 'food' }, { i: 2, topic: 'nope' }] }),
    )
    const r = await handleTopics(
      { words: [{ word: 'aunt' }, { word: 'soup', pos: 'noun' }, { word: 'xyz' }] },
      { GEMINI_API_KEY: 'k' },
      fetchImpl as typeof fetch,
    )
    expect(r).toMatchObject({ status: 200, json: { topics: ['people', 'food', null] } })
  })
})
