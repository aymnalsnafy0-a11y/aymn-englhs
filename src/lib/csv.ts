import { isLevel, type RawWord } from './types'

/** محلّل CSV صغير يدعم الحقول بين علامات تنصيص و CRLF و BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

export interface ParseResult {
  words: RawWord[]
  errors: string[]
}

/**
 * يقرأ ملف الكلمات بالأعمدة: word,level,pos (وعمود topic اختياري).
 * السطر الأول عنوان إن كان أول حقل فيه "word".
 */
export function parseWordList(text: string): ParseResult {
  const rows = parseCsv(text)
  const words: RawWord[] = []
  const errors: string[] = []

  rows.forEach((cells, index) => {
    const [rawWord = '', rawLevel = '', rawPos = '', rawTopic = ''] = cells.map((c) => c.trim())
    if (index === 0 && rawWord.toLowerCase() === 'word') return
    const level = rawLevel.toUpperCase()
    if (!rawWord) {
      errors.push(`السطر ${index + 1}: الكلمة فارغة`)
      return
    }
    if (!isLevel(level)) {
      errors.push(`السطر ${index + 1}: مستوى غير معروف "${rawLevel}"`)
      return
    }
    words.push({
      word: rawWord,
      level,
      pos: rawPos.toLowerCase(),
      ...(rawTopic ? { topic: rawTopic.toLowerCase() } : {}),
    })
  })

  return { words, errors }
}
