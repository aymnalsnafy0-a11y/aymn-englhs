/**
 * تمارين الدرس (تُولَّد من ملاحظات المدرس أو صور الدرس) — أنواع وتصحيح آلي.
 * المحتوى بالإنجليزية والتعليمات والشرح بالعربية.
 */
import { shuffle, type Rng } from './quiz.js'

export type Exercise =
  | { type: 'mcq'; q: string; options: string[]; answer: number; explain?: string }
  | { type: 'tf'; q: string; answer: boolean; explain?: string }
  /** q فيه فراغ «____»؛ answers: كل الإجابات المقبولة. */
  | { type: 'fill'; q: string; answers: string[]; hint?: string; explain?: string }
  /** words بالترتيب الصحيح؛ q: معنى الجملة أو تعليمة. */
  | { type: 'order'; q?: string; words: string[]; explain?: string }

export type ExerciseType = Exercise['type']
export const EXERCISE_TYPES: ExerciseType[] = ['mcq', 'tf', 'fill', 'order']

export const TYPE_LABEL: Record<ExerciseType, string> = {
  mcq: 'اختيار من متعدد',
  tf: 'صح أو خطأ',
  fill: 'املأ الفراغ',
  order: 'رتّب الكلمات',
}

export const BLANK = '____'

/** توحيد الإجابة المكتوبة: أحرف صغيرة، مسافات مفردة، بلا علامات ترقيم في الأطراف. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s.,!?;:"'()]+|[\s.,!?;:"'()]+$/g, '')
}

export type ExerciseResponse = number | boolean | string | string[]

export function gradeExercise(ex: Exercise, response: ExerciseResponse): boolean {
  switch (ex.type) {
    case 'mcq':
      return response === ex.answer
    case 'tf':
      return response === ex.answer
    case 'fill':
      return typeof response === 'string' && ex.answers.some((a) => normalizeAnswer(a) === normalizeAnswer(response))
    case 'order':
      return Array.isArray(response) && normalizeAnswer(response.join(' ')) === normalizeAnswer(ex.words.join(' '))
  }
}

/** الإجابة الصحيحة كنص لعرضها بعد الخطأ. */
export function correctAnswerText(ex: Exercise): string {
  switch (ex.type) {
    case 'mcq':
      return ex.options[ex.answer]
    case 'tf':
      return ex.answer ? 'صح' : 'خطأ'
    case 'fill':
      return ex.answers[0]
    case 'order':
      return ex.words.join(' ')
  }
}

/** يخلط كلمات «رتّب» بحيث لا تظهر بترتيبها الصحيح. */
export function scramble(words: string[], rng: Rng = Math.random): string[] {
  if (words.length < 2) return [...words]
  for (let i = 0; i < 10; i++) {
    const s = shuffle(words, rng)
    if (s.join(' ') !== words.join(' ')) return s
  }
  return [...words.slice(1), words[0]]
}

/** نص قصير يمثّل السؤال في تقرير المدرس («الأسئلة الأكثر خطأ»). */
export function exerciseLabel(ex: Exercise): string {
  const text = ex.type === 'order' ? ex.words.join(' ') : ex.q
  return text.length > 70 ? `${text.slice(0, 67)}…` : text
}
