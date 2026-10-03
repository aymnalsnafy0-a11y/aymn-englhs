/**
 * الجسر بين التطبيق وإضافة المتصفح (عبر window.postMessage مع سكربت الإضافة في صفحة التطبيق):
 * - التطبيق يرسل «لقطة» المتعلم (حالة كل كلمة ومعناها) لتستخدمها الإضافة في المواقع.
 * - الإضافة ترسل الكلمات التي حفظها المتعلم من المواقع، فتدخل الخطة أولًا.
 */
import { useEffect, useRef } from 'react'
import { contentFor } from '../data/content'
import { buildSnapshot } from '../lib/browse'
import { levelIndex } from '../lib/types'
import { syncTodayPlan } from './actions'
import { db } from './db'
import { useStats } from './hooks'

export const APP_SOURCE = 'siyaq-app'
export const EXT_SOURCE = 'siyaq-ext'

/** يضيف الكلمات المحفوظة إلى قائمة الانتظار ويعيد ما لم يُعثر عليه في القائمة. */
export async function saveWordsFromExtension(words: string[]): Promise<{ added: string[]; unknown: string[] }> {
  const all = await db.words.toArray()
  const added: string[] = []
  const unknown: string[] = []
  for (const raw of words) {
    const lower = raw.trim().toLowerCase()
    const match = all.filter((w) => w.word.toLowerCase() === lower).sort((a, b) => levelIndex(a.level) - levelIndex(b.level))[0]
    if (!match) {
      unknown.push(raw)
      continue
    }
    await db.saved.put({ wordId: match.id, word: match.word, savedAt: Date.now() })
    added.push(match.word)
  }
  if (added.length) await syncTodayPlan()
  return { added, unknown }
}

export function useExtensionBridge(): void {
  const stats = useStats()
  const timer = useRef<number | undefined>(undefined)

  // نرسل اللقطة بعد هدوء التغييرات (التقدّم والمحتوى يتغيران كثيرًا أثناء الجلسة).
  useEffect(() => {
    if (!stats) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const snapshot = buildSnapshot(stats.words, stats.progressMap, stats.settings.startLevel!, (id) => contentFor(id)?.meaningAr)
      window.postMessage({ source: APP_SOURCE, type: 'snapshot', snapshot }, window.location.origin)
    }, 1500)
    return () => window.clearTimeout(timer.current)
  }, [stats])

  useEffect(() => {
    async function onMessage(e: MessageEvent) {
      if (e.source !== window || e.data?.source !== EXT_SOURCE) return
      if (e.data.type === 'saved-words' && Array.isArray(e.data.words)) {
        const words = (e.data.words as unknown[]).filter((w): w is string => typeof w === 'string').slice(0, 100)
        const { added, unknown } = await saveWordsFromExtension(words)
        window.postMessage({ source: APP_SOURCE, type: 'saved-ack', words, added, unknown }, window.location.origin)
      }
    }
    window.addEventListener('message', onMessage)
    // نعلن الجاهزية حتى ترسل الإضافة ما لديها.
    window.postMessage({ source: APP_SOURCE, type: 'ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])
}
