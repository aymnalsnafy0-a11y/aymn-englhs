import { describe, expect, it } from 'vitest'
import { matchTarget, missingTargets, segmentSentence, storyKindFor, tokenAt, tokenize } from './storyText'

describe('segmentSentence', () => {
  it('keeps a pure English sentence as one segment', () => {
    const s = segmentSentence('Omar opened the door.')
    expect(s).toHaveLength(1)
    expect(s[0].lang).toBe('en')
    expect(s[0].tokens.map((t) => t.text)).toEqual(['Omar', 'opened', 'the', 'door'])
  })

  it('splits mixed Arabic and English into runs', () => {
    const s = segmentSentence('فتح عمر الـ door ثم أكل apple pie بسرعة.')
    expect(s.map((x) => [x.lang, x.text.trim()])).toEqual([
      ['ar', 'فتح عمر الـ'],
      ['en', 'door'],
      ['ar', 'ثم أكل'],
      ['en', 'apple pie'],
      ['ar', 'بسرعة.'],
    ])
    expect(s.map((x) => x.text).join('')).toBe('فتح عمر الـ door ثم أكل apple pie بسرعة.')
  })
})

describe('tokens & boundaries', () => {
  const tokens = tokenize("I don't like it.")
  it('tokenizes words with apostrophes', () => {
    expect(tokens.map((t) => t.text)).toEqual(['I', "don't", 'like', 'it'])
  })
  it('maps a boundary char index to its word', () => {
    expect(tokenAt(tokens, 0)).toBe(0)
    expect(tokenAt(tokens, 2)).toBe(1)
    expect(tokenAt(tokens, 7)).toBe(2) // the space before "like" → next word
    expect(tokenAt(tokens, 99)).toBe(3)
  })
})

describe('targets', () => {
  const targets = [{ word: 'arrive' }, { word: 'happy' }, { word: 'per cent' }]
  it('matches inflected forms only for English tokens', () => {
    expect(matchTarget('arrived', targets)?.word).toBe('arrive')
    expect(matchTarget('Happily', targets)?.word).toBe('happy')
    expect(matchTarget('arrow', targets)).toBeUndefined()
    expect(matchTarget('سعيد', targets)).toBeUndefined()
  })
  it('reports target words the story forgot', () => {
    const sentences = [{ text: 'They arrived at ten.', translation: '' }, { text: 'Only 5 per cent came.', translation: '' }]
    expect(missingTargets(sentences, ['arrive', 'happy', 'per cent'])).toEqual(['happy'])
  })
  it('picks the story kind from the level', () => {
    expect(storyKindFor('A2')).toBe('beginner')
    expect(storyKindFor('B1')).toBe('advanced')
  })
})
