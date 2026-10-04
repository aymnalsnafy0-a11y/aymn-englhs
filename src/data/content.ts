/**
 * نقطة الوصول الوحيدة لمحتوى الكلمات في الواجهة:
 * 1) المحتوى المولَّد بالذكاء الاصطناعي (مخزّن في IndexedDB، لا يُعاد توليده)
 * 2) المحتوى الثابت لكلمات ملف التجربة.
 * التوليد يتم عند الحاجة فقط (كلمات اليوم، المراجعات، الاختبارات) في دفعات من 10.
 */
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { postAi } from './ai'
import type { QuizWord } from '../lib/quiz'
import type { Word } from '../lib/types'
import { SAMPLE_CONTENT, contentFor as sampleContentFor, type WordContent } from './sampleContent'

export type { WordContent }
export type ContentStatus = 'ready' | 'loading' | 'failed' | 'missing'

const BATCH = 10
const generated = new Map<string, WordContent>()
const loading = new Set<string>()
const failed = new Set<string>()
let version = 0
const listeners = new Set<() => void>()

function notify() {
  version++
  for (const l of listeners) l()
}

/** ينسى الإخفاقات السابقة (مثلًا بعد حفظ مفتاح Gemini) لتُعاد المحاولة. */
export function clearContentFailures(): void {
  failed.clear()
  notify()
}

/** يحمّل المحتوى المخزّن مرة عند بدء التطبيق. */
export async function loadStoredContent(): Promise<void> {
  const rows = await db.content.toArray()
  for (const r of rows) generated.set(r.wordId, r.content)
  notify()
}

export function contentFor(id: string): WordContent | undefined {
  return generated.get(id) ?? sampleContentFor(id)
}

export function contentStatus(id: string): ContentStatus {
  if (contentFor(id)) return 'ready'
  if (loading.has(id)) return 'loading'
  if (failed.has(id)) return 'failed'
  return 'missing'
}

/** يعيد رسم المكوّنات عند وصول محتوى جديد. */
export function useContentVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
}

async function fetchBatch(words: Word[]): Promise<void> {
  const res = await postAi('content', { words: words.map((w) => ({ word: w.word, pos: w.pos, level: w.level })) })
  const data = res.json
  if (!res.ok || !Array.isArray(data?.items)) throw new Error(data?.error ?? `HTTP ${res.status}`)
  const rows: { wordId: string; content: WordContent; model: string; createdAt: number }[] = []
  const topics: { wordId: string; topic: string }[] = []
  words.forEach((w, i) => {
    const item = data.items[i] as (WordContent & { topic?: string }) | null
    if (!item) {
      failed.add(w.id)
      return
    }
    const { topic, ...content } = item
    rows.push({ wordId: w.id, content, model: data.model, createdAt: Date.now() })
    if (topic) topics.push({ wordId: w.id, topic })
  })
  await db.transaction('rw', db.content, db.topics, async () => {
    await db.content.bulkPut(rows)
    // تصنيف الموضوع من بطاقة الكلمة لا يطغى على تصنيف سابق.
    const existing = new Set((await db.topics.bulkGet(topics.map((t) => t.wordId))).filter(Boolean).map((t) => t!.wordId))
    await db.topics.bulkPut(topics.filter((t) => !existing.has(t.wordId)))
  })
  for (const r of rows) generated.set(r.wordId, r.content)
}

/**
 * يولّد المحتوى الناقص لهذه الكلمات (مرة واحدة). retry=true يعيد محاولة ما فشل سابقًا.
 * لا يرمي أخطاء: الكلمة الفاشلة تظهر بحالة failed مع زر إعادة المحاولة.
 */
export async function ensureContent(words: Word[], retry = false): Promise<void> {
  const need = words.filter((w) => !contentFor(w.id) && !loading.has(w.id) && (retry || !failed.has(w.id)))
  if (need.length === 0) return
  for (const w of need) {
    loading.add(w.id)
    failed.delete(w.id)
  }
  notify()
  for (let i = 0; i < need.length; i += BATCH) {
    const batch = need.slice(i, i + BATCH)
    try {
      await fetchBatch(batch)
    } catch {
      for (const w of batch) failed.add(w.id)
    } finally {
      for (const w of batch) loading.delete(w.id)
      notify()
    }
  }
}

/**
 * storySentences: جمل قصة اليوم الإنجليزية (القصص المتقدمة) تُستخدم أولًا في «أكمل الجملة».
 * جمل قصص المبتدئ لا تُستخدم لأن ترجمتها الإنجليزية تكشف الإجابة.
 */
export function quizWordFor(word: Word, storySentences: { en: string; ar: string }[] = []): QuizWord {
  const content = contentFor(word.id)
  return {
    id: word.id,
    word: word.word,
    meaningAr: content?.meaningAr,
    sentences: [...storySentences, ...(content?.examples ?? [])],
  }
}

/** معانٍ عربية متاحة كمشتّتات في أسئلة الاختيار من متعدد. */
export function distractorMeanings(): string[] {
  return [...new Set([...Object.values(SAMPLE_CONTENT), ...generated.values()].map((c) => c.meaningAr))]
}
