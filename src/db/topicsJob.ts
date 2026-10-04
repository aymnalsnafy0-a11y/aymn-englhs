import { levelIndex } from '../lib/types'
import { db } from './db'
import { loadWords, type LoadInfo } from './loader'
import { postAi } from '../data/ai'

const BATCH = 200
let running = false

/**
 * يصنّف كلمات مستوى البداية والمستوى الذي يليه في مجموعات مواضيع (في الخلفية).
 * عدد الطلبات محدود في كل جلسة احترامًا للحد المجاني؛ الباقي يُستكمل في الجلسات التالية.
 * بعد كل دفعة يُعاد بناء ترتيب الكلمات. الأخطاء تُتجاهل بصمت (التطبيق يعمل بالترتيب الحالي).
 */
export async function classifyTopicsInBackground(maxRequests = 3): Promise<void> {
  if (running) return
  running = true
  try {
    const info = (await db.meta.get('loadInfo'))?.value as LoadInfo | undefined
    const settings = await db.settings.get('main')
    // ملف التجربة مصنّف يدويًا؛ التصنيف للقائمة الكاملة فقط.
    if (!info || info.source === 'sample' || !settings?.startLevel) return
    const start = levelIndex(settings.startLevel)
    const have = new Set(await db.topics.toCollection().primaryKeys())
    const progress = new Set(await db.progress.toCollection().primaryKeys())
    const todo = (await db.words.orderBy('order').toArray()).filter((w) => {
      const li = levelIndex(w.level)
      return (li === start || li === start + 1) && !have.has(w.id) && !progress.has(w.id)
    })

    let changed = false
    for (let i = 0; i < todo.length && i / BATCH < maxRequests; i += BATCH) {
      const batch = todo.slice(i, i + BATCH)
      const res = await postAi('topics', { words: batch.map((w) => ({ word: w.word, pos: w.pos })) })
      const data = res.json
      if (!res.ok || !Array.isArray(data?.topics)) break
      // ما لم يُصنَّف يُحفظ بمجموعته الحالية حتى لا يُطلب مرة أخرى.
      await db.topics.bulkPut(batch.map((w, j) => ({ wordId: w.id, topic: (data.topics[j] as string | null) ?? w.topic })))
      changed = true
    }
    if (changed) await loadWords()
  } catch {
    /* بلا اتصال أو بلا خادم: نبقي الترتيب الحالي */
  } finally {
    running = false
  }
}
