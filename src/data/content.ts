import type { QuizWord } from '../lib/quiz'
import type { Word } from '../lib/types'
import { SAMPLE_CONTENT, contentFor } from './sampleContent'

/**
 * نقطة الوصول الوحيدة لمحتوى الكلمات في الواجهة.
 * في المرحلة 4 ستقرأ من المحتوى المولَّد والمخزّن، وفي المرحلة 3 تُضاف جمل القصة أولًا.
 */
export { contentFor }

export function quizWordFor(word: Word): QuizWord {
  const content = contentFor(word.id)
  return {
    id: word.id,
    word: word.word,
    meaningAr: content?.meaningAr,
    sentences: content?.examples ?? [],
  }
}

/** معانٍ عربية متاحة لاستخدامها كمشتّتات في أسئلة الاختيار من متعدد. */
export const DISTRACTOR_MEANINGS: string[] = Object.values(SAMPLE_CONTENT).map((c) => c.meaningAr)
