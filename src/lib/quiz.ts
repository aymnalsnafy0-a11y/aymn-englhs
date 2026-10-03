/**
 * مولّد الاختبارات — وحدة نقية. سؤال واحد لكل كلمة، بأنواع منوّعة:
 * إملاء (يسمع ويكتب)، من العربي للإنجليزي (يكتب)، أكمل الجملة، اختيار من متعدد للمعنى.
 */
import { splitHighlight } from './highlight'
import { firstMismatch, isExactMatch } from './typing'

export type QuestionType = 'dictation' | 'arToEn' | 'complete' | 'mcq'
export const QUESTION_TYPES: QuestionType[] = ['dictation', 'arToEn', 'complete', 'mcq']

export interface QuizSentence {
  en: string
  ar: string
}

export interface QuizWord {
  id: string
  word: string
  meaningAr?: string
  /** جمل تحتوي الكلمة (من القصة أولًا ثم الأمثلة). */
  sentences: QuizSentence[]
}

interface BaseQuestion {
  wordId: string
  word: string
}

export type Question =
  | (BaseQuestion & { type: 'dictation'; answer: string })
  | (BaseQuestion & { type: 'arToEn'; prompt: string; answer: string })
  | (BaseQuestion & { type: 'complete'; before: string; after: string; translation: string; answer: string })
  | (BaseQuestion & { type: 'mcq'; options: string[]; answer: string })

export type Rng = () => number

/** مولّد عشوائي بذرة (mulberry32) لاختبارات قابلة للتكرار. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function blankSentence(word: string, sentences: QuizSentence[]) {
  for (const s of sentences) {
    const segments = splitHighlight(s.en, word)
    const index = segments.findIndex((seg) => seg.match)
    if (index === -1) continue
    return {
      before: segments.slice(0, index).map((seg) => seg.text).join(''),
      after: segments.slice(index + 1).map((seg) => seg.text).join(''),
      translation: s.ar,
      answer: segments[index].text,
    }
  }
  return null
}

export interface QuizOptions {
  rng?: Rng
  /** هل النطق متاح؟ بدونه لا أسئلة إملاء. */
  speech?: boolean
  types?: QuestionType[]
  /** معانٍ إضافية لاختيار المشتّتات منها في أسئلة الاختيار من متعدد. */
  distractorPool?: string[]
}

export function eligibleTypes(w: QuizWord, opts: QuizOptions, meaningsAvailable: number): QuestionType[] {
  const allowed = opts.types ?? QUESTION_TYPES
  return allowed.filter((t) => {
    if (t === 'dictation') return opts.speech ?? true
    if (t === 'arToEn') return !!w.meaningAr
    if (t === 'complete') return blankSentence(w.word, w.sentences) !== null
    return !!w.meaningAr && meaningsAvailable >= 4
  })
}

export function buildQuiz(words: QuizWord[], opts: QuizOptions = {}): Question[] {
  const rng = opts.rng ?? Math.random
  const meanings = [
    ...new Set([...words.map((w) => w.meaningAr).filter((m): m is string => !!m), ...(opts.distractorPool ?? [])]),
  ]
  const counts = new Map<QuestionType, number>(QUESTION_TYPES.map((t) => [t, 0]))
  const questions: Question[] = []

  for (const w of shuffle(words, rng)) {
    let types = eligibleTypes(w, opts, meanings.length)
    // احتياط: الإملاء متاح دائمًا كحل أخير حتى لو لم يُطلب (كلمة بلا محتوى).
    if (types.length === 0) types = ['dictation']
    const least = Math.min(...types.map((t) => counts.get(t)!))
    const candidates = types.filter((t) => counts.get(t) === least)
    const type = candidates[Math.floor(rng() * candidates.length)]
    counts.set(type, counts.get(type)! + 1)

    const base = { wordId: w.id, word: w.word }
    if (type === 'dictation') questions.push({ ...base, type, answer: w.word })
    else if (type === 'arToEn') questions.push({ ...base, type, prompt: w.meaningAr!, answer: w.word })
    else if (type === 'complete') questions.push({ ...base, type, ...blankSentence(w.word, w.sentences)! })
    else {
      const wrong = shuffle(
        meanings.filter((m) => m !== w.meaningAr),
        rng,
      ).slice(0, 3)
      questions.push({ ...base, type, answer: w.meaningAr!, options: shuffle([w.meaningAr!, ...wrong], rng) })
    }
  }
  return questions
}

export interface Grade {
  correct: boolean
  /** لأسئلة الكتابة: موضع أول حرف خطأ. */
  mismatchAt: number
}

export function grade(q: Question, response: string): Grade {
  if (q.type === 'mcq') return { correct: response === q.answer, mismatchAt: -1 }
  const correct = isExactMatch(q.answer, response)
  return { correct, mismatchAt: correct ? -1 : firstMismatch(q.answer, response) }
}

export interface QuizScore {
  total: number
  correct: number
  wrongIds: string[]
}

export function score(questions: Question[], correctness: boolean[]): QuizScore {
  const wrongIds = questions.filter((_, i) => !correctness[i]).map((q) => q.wordId)
  return { total: questions.length, correct: questions.length - wrongIds.length, wrongIds }
}

/** نسبة النجاح في اختبار نهاية المستوى لاقتراح الانتقال. */
export const LEVEL_PASS_RATIO = 0.8

export function passed(s: QuizScore, ratio = LEVEL_PASS_RATIO): boolean {
  return s.total > 0 && s.correct / s.total >= ratio
}
