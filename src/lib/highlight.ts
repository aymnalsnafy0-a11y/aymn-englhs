/** يقسم الجملة إلى أجزاء ويحدد أجزاء الكلمة المستهدفة (مع تصريفاتها البسيطة). */
export interface Segment {
  text: string
  match: boolean
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function splitHighlight(sentence: string, word: string): Segment[] {
  const lower = word.toLowerCase()
  const stem = lower.length > 3 ? lower.replace(/(e|y)$/, '') : lower
  const re = new RegExp(`\\b${escapeRegExp(stem)}[a-z]*`, 'gi')
  const segments: Segment[] = []
  let last = 0
  for (const m of sentence.matchAll(re)) {
    const start = m.index ?? 0
    if (start > last) segments.push({ text: sentence.slice(last, start), match: false })
    segments.push({ text: m[0], match: true })
    last = start + m[0].length
  }
  if (last < sentence.length) segments.push({ text: sentence.slice(last), match: false })
  return segments
}
