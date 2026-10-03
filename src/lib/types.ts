export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type Level = (typeof LEVELS)[number]

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value)
}

export function levelIndex(level: Level): number {
  return LEVELS.indexOf(level)
}

/** سطر خام من ملف CSV بعد التحقق منه. */
export interface RawWord {
  word: string
  level: Level
  pos: string
  /** عمود رابع اختياري لتحديد مجموعة الموضوع يدويًا. */
  topic?: string
}

/** كلمة جاهزة للتعلّم بترتيبها النهائي داخل القائمة. */
export interface Word {
  id: string
  word: string
  level: Level
  pos: string
  topic: string
  /** الترتيب العام: المستوى أولًا ثم مجموعة الموضوع ثم ترتيب الملف. */
  order: number
}

export function wordId(word: string, pos: string): string {
  return `${word.toLowerCase()}|${pos.toLowerCase()}`
}
