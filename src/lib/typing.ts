/** مقارنة ما يكتبه المتعلم بالكلمة الهدف، حرفًا بحرف. */
export type LetterStatus = 'correct' | 'wrong' | 'pending'

function norm(ch: string): string {
  return ch.toLowerCase().replace(/[’‘`]/g, "'")
}

export function letterStatuses(target: string, typed: string): LetterStatus[] {
  return [...target].map((ch, i) => {
    if (i >= typed.length) return 'pending'
    return norm(typed[i]) === norm(ch) ? 'correct' : 'wrong'
  })
}

export function isExactMatch(target: string, typed: string): boolean {
  return norm(typed.trim()) === norm(target)
}

/** فهرس أول حرف خطأ، أو -1 إن تطابقت الكلمتان. نقص الحروف يُعد خطأ عند موضع النقص. */
export function firstMismatch(target: string, typed: string): number {
  const a = norm(target)
  const b = norm(typed.trim())
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i
  }
  return -1
}
