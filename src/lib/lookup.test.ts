import { describe, expect, it } from 'vitest'
import { buildWordIndex, findWord, wordAround } from './lookup'
import { buildWordList } from './words'

const words = buildWordList([
  { word: 'old', level: 'A1', pos: 'adjective' },
  { word: 'brother', level: 'A1', pos: 'noun' },
  { word: 'run', level: 'A1', pos: 'verb' },
  { word: 'study', level: 'A1', pos: 'verb' },
  { word: 'than', level: 'A1', pos: 'preposition' },
  { word: 'light', level: 'A2', pos: 'verb' },
  { word: 'light', level: 'A1', pos: 'noun' },
])
const index = buildWordIndex(words)

describe('findWord', () => {
  it('finds base forms of inflected words', () => {
    expect(findWord('older', index)?.word).toBe('old')
    expect(findWord('Brothers', index)?.word).toBe('brother')
    expect(findWord('running', index)?.word).toBe('run')
    expect(findWord('studies', index)?.word).toBe('study')
    expect(findWord('xylophone', index)).toBeUndefined()
  })
  it('prefers the lowest level entry', () => {
    expect(findWord('light', index)?.level).toBe('A1')
  })
})

describe('wordAround', () => {
  const s = "My brother's older than me."
  it('extracts the word under the cursor, trimming possessives and punctuation', () => {
    expect(wordAround(s, 4)?.word).toBe("brother's")
    expect(wordAround(s, 15)?.word).toBe('older')
    expect(wordAround(s, 18)).toMatchObject({ word: 'older' }) // the space just after the word
    expect(wordAround(s, 26)?.word).toBe('me') // on the full stop after "me"
    expect(wordAround('أخي أكبر', 2)).toBeNull()
  })
})
