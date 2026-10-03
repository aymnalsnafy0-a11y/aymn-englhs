import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseCsv, parseWordList } from './csv'
import { buildWordList } from './words'
import { firstMismatch, isExactMatch, letterStatuses } from './typing'
import { pickNewWords, summarize, type ProgressStatus } from './plan'
import { addDays, diffDays } from './dates'
import { LEVELS } from './types'

describe('csv', () => {
  it('handles quotes, CRLF and BOM', () => {
    expect(parseCsv('﻿a,"b,c"\r\n"say ""hi""",x\n\n')).toEqual([
      ['a', 'b,c'],
      ['say "hi"', 'x'],
    ])
  })

  it('parses word rows, skipping the header and reporting bad lines', () => {
    const { words, errors } = parseWordList('word,level,pos\nfamily,A1,noun\nbad,Z9,noun\nlight,b1,"adjective"\n')
    expect(words).toEqual([
      { word: 'family', level: 'A1', pos: 'noun' },
      { word: 'light', level: 'B1', pos: 'adjective' },
    ])
    expect(errors).toHaveLength(1)
  })

  it('loads the bundled sample file (40 A1 + 20 A2)', () => {
    const text = readFileSync(new URL('../../data/sample.csv', import.meta.url), 'utf8')
    const { words, errors } = parseWordList(text)
    expect(errors).toEqual([])
    expect(words.filter((w) => w.level === 'A1')).toHaveLength(40)
    expect(words.filter((w) => w.level === 'A2')).toHaveLength(20)
  })
})

describe('buildWordList', () => {
  const list = buildWordList([
    { word: 'apple', level: 'A2', pos: 'noun' },
    { word: 'brother', level: 'A1', pos: 'noun' },
    { word: 'bread', level: 'A1', pos: 'noun' },
    { word: 'apple', level: 'A1', pos: 'noun' },
    { word: 'mother', level: 'A1', pos: 'noun' },
    { word: 'run', level: 'A1', pos: 'verb' },
    { word: 'zebra', level: 'A1', pos: 'noun', topic: 'nature' },
  ])

  it('keeps strict level order and groups by topic instead of alphabet', () => {
    expect(list.map((w) => `${w.level}:${w.word}`)).toEqual([
      'A1:mother', // core family words first within their topic
      'A1:brother',
      'A1:apple', // duplicate word|pos: the lower level wins
      'A1:bread',
      'A1:zebra',
      'A1:run',
    ])
  })

  it('groups later senses of a basic word by part of speech, not by its basic topic', () => {
    const later = buildWordList([
      { word: 'water', level: 'A1', pos: 'noun' },
      { word: 'pour', level: 'B1', pos: 'verb' },
      { word: 'water', level: 'B1', pos: 'verb' },
      { word: 'kitchen', level: 'B1', pos: 'noun' },
    ])
    expect(later.map((w) => `${w.level}:${w.word}:${w.topic}`)).toEqual([
      'A1:water:food',
      'B1:kitchen:home',
      'B1:pour:actions',
      'B1:water:actions',
    ])
  })

  it('assigns sequential order', () => {
    expect(list.map((w) => w.order)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('typing', () => {
  it('colours letters as correct, wrong or pending', () => {
    expect(letterStatuses('cat', 'Cx')).toEqual(['correct', 'wrong', 'pending'])
  })

  it('finds the first mismatch, including missing letters', () => {
    expect(firstMismatch('patience', 'patiance')).toBe(4)
    expect(firstMismatch('patience', 'pati')).toBe(4)
    expect(firstMismatch('patience', 'Patience ')).toBe(-1)
    expect(isExactMatch("don't", 'don’t')).toBe(true)
  })
})

describe('plan', () => {
  const words = buildWordList(
    LEVELS.flatMap((level) => [1, 2, 3].map((n) => ({ word: `${level}-${n}`, level, pos: 'noun' }))),
  )

  it('picks new words from the start level onward, skipping words with progress', () => {
    const progress = new Map<string, ProgressStatus>([['b1-1|noun', 'known']])
    expect(pickNewWords(words, progress, 'B1', 3).map((w) => w.word)).toEqual(['B1-2', 'B1-3', 'B2-1'])
  })

  it('counts lower levels as known unless the learner has progress on them', () => {
    const progress = new Map<string, ProgressStatus>([
      ['a1-1|noun', 'learning'],
      ['b1-1|noun', 'known'],
      ['b1-2|noun', 'mastered'],
      ['b1-3|noun', 'learning'],
    ])
    const s = summarize(words, progress, 'B1')
    expect(s.known).toBe(2 + 3 + 2)
    expect(s.levels[0]).toMatchObject({ known: 2, learning: 1 })
    expect(s.levels[2]).toMatchObject({ known: 2, learning: 1 })
  })
})

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(diffDays('2026-10-03', '2026-11-02')).toBe(30)
  })
})

describe('sample content', async () => {
  const { SAMPLE_CONTENT } = await import('../data/sampleContent')
  const text = readFileSync(new URL('../../data/sample.csv', import.meta.url), 'utf8')
  const list = buildWordList(parseWordList(text).words)

  it('has static content for every sample word', () => {
    expect(list.filter((w) => !SAMPLE_CONTENT[w.id]).map((w) => w.id)).toEqual([])
  })

  it('every example sentence contains its word (or a form of it)', () => {
    for (const w of list) {
      for (const ex of SAMPLE_CONTENT[w.id].examples) {
        expect(ex.en.toLowerCase(), `${w.word}: ${ex.en}`).toContain(w.word.toLowerCase().slice(0, 4))
      }
    }
  })
})

describe('splitHighlight', async () => {
  const { splitHighlight } = await import('./highlight')
  it('highlights the word and simple inflections', () => {
    expect(splitHighlight('We arrived in Dubai.', 'arrive').filter((s) => s.match).map((s) => s.text)).toEqual(['arrived'])
    expect(splitHighlight('Happy birthday! I am happy.', 'happy').filter((s) => s.match)).toHaveLength(2)
    expect(splitHighlight('I eat. Great!', 'eat').filter((s) => s.match).map((s) => s.text)).toEqual(['eat'])
    expect(splitHighlight('abc', 'zzz')).toEqual([{ text: 'abc', match: false }])
  })
})

describe('reconcilePlan', async () => {
  const { reconcilePlan } = await import('./plan')
  const words = buildWordList(
    ['a', 'b', 'c', 'd', 'e', 'f'].map((word) => ({ word, level: 'A1' as const, pos: 'noun' })),
  )
  const today = '2026-10-03'

  it('creates a fresh plan for a new day', () => {
    const plan = reconcilePlan(undefined, words, new Map(), 'A1', 3, today)
    expect(plan.wordIds).toEqual(['a|noun', 'b|noun', 'c|noun'])
    expect(plan.doneIds).toEqual([])
  })

  it('keeps done words, replaces a word marked known and adapts to a new target', () => {
    const plan = reconcilePlan(undefined, words, new Map(), 'A1', 3, today)
    const progress = new Map<string, ProgressStatus>([
      ['a|noun', 'learning'],
      ['b|noun', 'known'],
    ])
    const next = reconcilePlan({ ...plan, doneIds: ['a|noun'] }, words, progress, 'A1', 3, today)
    expect(next.wordIds).toEqual(['a|noun', 'c|noun', 'd|noun'])
    const smaller = reconcilePlan(next, words, progress, 'A1', 2, today)
    expect(smaller.wordIds).toEqual(['a|noun', 'c|noun'])
    const smallest = reconcilePlan(next, words, progress, 'A1', 0, today)
    expect(smallest.wordIds).toEqual(['a|noun'])
  })

  it('starts over on a new day', () => {
    const plan = reconcilePlan(undefined, words, new Map(), 'A1', 2, '2026-10-02')
    const progress = new Map<string, ProgressStatus>([['a|noun', 'learning']])
    expect(reconcilePlan({ ...plan, doneIds: ['a|noun'] }, words, progress, 'A1', 2, today).wordIds).toEqual([
      'b|noun',
      'c|noun',
    ])
  })
})

describe('format', async () => {
  const { formatDuration, formatMinutes, posLabel } = await import('./format')
  it('formats durations in Arabic', () => {
    expect(formatDuration(1)).toBe('يوم واحد')
    expect(formatDuration(6)).toBe('6 أيام')
    expect(formatDuration(14)).toBe('حوالي أسبوعين')
    expect(formatDuration(90)).toBe('حوالي 3 أشهر')
    expect(formatDuration(600)).toBe('حوالي 20 شهرًا')
    expect(formatMinutes(23)).toBe('23 دقيقة')
    expect(posLabel('noun, verb')).toBe('اسم، فعل')
  })
})

describe('contentFor', async () => {
  const { contentFor } = await import('../data/sampleContent')
  it('falls back to the headword when the full list combines parts of speech', () => {
    expect(contentFor('family|noun, adjective')?.meaningAr).toBe('عائلة')
    expect(contentFor('zzz|noun')).toBeUndefined()
  })
})
