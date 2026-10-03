import { describe, expect, it } from 'vitest'
import {
  analyzeTokens,
  arabicEntries,
  buildLexicon,
  buildSnapshot,
  deinflect,
  findArabicMatches,
  isSnapshot,
  lookup,
  normalizeArabic,
  type Snapshot,
} from './browse'
import { buildWordList } from './words'
import type { ProgressStatus } from './plan'

const words = buildWordList([
  { word: 'study', level: 'A1', pos: 'verb' },
  { word: 'run', level: 'A1', pos: 'verb' },
  { word: 'big', level: 'A1', pos: 'adjective' },
  { word: 'happy', level: 'A1', pos: 'adjective' },
  { word: 'house', level: 'A1', pos: 'noun' },
  { word: 'journey', level: 'A2', pos: 'noun' },
  { word: 'storm', level: 'A2', pos: 'noun' },
  { word: 'abolish', level: 'C1', pos: 'verb' },
])
const progress = new Map<string, ProgressStatus>([
  ['journey|noun', 'learning'],
  ['storm|noun', 'mastered'],
])
const meanings: Record<string, string> = { 'journey|noun': 'رحلة', 'storm|noun': 'عاصِفة', 'house|noun': 'بيت، منزل' }
const snap = buildSnapshot(words, progress, 'A2', (id) => meanings[id], 1)

describe('snapshot', () => {
  it('encodes statuses: lower levels known, learning, mastered, new', () => {
    const s = Object.fromEntries(snap.words.map((w) => [w.w, w.s]))
    expect(s).toMatchObject({ study: 'k', journey: 'l', storm: 'm', abolish: 'n' })
    expect(snap.words.find((w) => w.w === 'abolish')?.ar).toBeUndefined()
    expect(isSnapshot(snap)).toBe(true)
    expect(isSnapshot({ v: 2 })).toBe(false)
  })
})

describe('english matching', () => {
  const lex = buildLexicon(snap)
  it('deinflects common forms', () => {
    expect(deinflect('studies')).toContain('study')
    expect(deinflect('running')).toContain('run')
    expect(deinflect('bigger')).toContain('big')
    expect(deinflect('happily')).toContain('happy')
    expect(deinflect('houses')).toContain('house')
  })
  it('looks words up through their inflections', () => {
    expect(lookup(lex, 'Journeys')?.s).toBe('l')
    expect(lookup(lex, 'studied')?.w).toBe('study')
    expect(lookup(lex, 'xylophone')).toBeUndefined()
  })
  it('computes page coverage, ignoring numbers and mid-sentence proper nouns', () => {
    const toks = ['The', 'storm', 'ruined', 'our', 'journey', 'to', 'Paris', 'in', '2024', 'abolished']
      .map((text, i) => ({ text, sentenceStart: i === 0 }))
    // known: storm(m) → known; journey → learning; abolished → new (unknown);
    // The/ruined/our/to/in → not in list → unknown; Paris skipped; 2024 skipped.
    const s = analyzeTokens(toks, lex)
    expect(s).toMatchObject({ total: 8, known: 1, learning: 1, unknown: 6, coverage: 25 })
  })
})

describe('arabic matching', () => {
  const entries = arabicEntries(snap)
  it('builds normalized entries only for learning and mastered words', () => {
    expect(entries.map((e) => e.key).sort()).toEqual(['رحله', 'عاصفه'])
    expect(normalizeArabic('إِلى المدرسةِ')).toBe('الي المدرسه')
  })
  it('finds words with prefixes and maps back to the original text', () => {
    const text = 'كانت الرحلة طويلة، وبعدها جاءت العاصفةُ القوية وللعاصفة صوت. رحلات أخرى.'
    const m = findArabicMatches(text, entries)
    expect(m.map((x) => [text.slice(x.start, x.end), x.en])).toEqual([
      ['الرحلة', 'journey'],
      ['العاصفةُ', 'storm'],
      ['لعاصفة', 'storm'], // «لل» ← نُبقي اللام: ل storm
    ])
  })
  it('handles short family words only with ال or a pronoun, and pronoun suffixes', () => {
    const e = arabicEntries({
      v: 1,
      updatedAt: 0,
      level: 'A1',
      words: [
        { w: 'mother', s: 'l', lv: 'A1', ar: 'أم' },
        { w: 'brother', s: 'l', lv: 'A1', ar: 'أخ' },
        { w: 'sister', s: 'l', lv: 'A1', ar: 'أخت' },
        { w: 'journey', s: 'l', lv: 'A2', ar: 'رحلة' },
      ],
    } as Snapshot)
    const text = 'ذهبت الأمُّ مع أخي وأختي في رحلتنا، أم بقيتم؟'
    expect(findArabicMatches(text, e).map((m) => [text.slice(m.start, m.end), m.en])).toEqual([
      ['الأمُّ', 'mother'],
      ['أخي', 'brother'],
      ['أختي', 'sister'],
      ['رحلتنا', 'journey'],
    ])
  })

  it('does not match inside a longer word', () => {
    const e = arabicEntries({ v: 1, updatedAt: 0, level: 'A1', words: [{ w: 'trip', s: 'l', lv: 'A1', ar: 'رحلة' }] } as Snapshot)
    expect(findArabicMatches('مرحلة', e)).toEqual([])
  })
})
