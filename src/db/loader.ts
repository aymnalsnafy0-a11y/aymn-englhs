import { parseWordList } from '../lib/csv'
import { buildWordList } from '../lib/words'
import { wordId } from '../lib/types'
import { db } from './db'

/**
 * يحمّل قائمة الكلمات من data/oxford5000.csv إن وُجد، وإلا من data/sample.csv.
 * الملف الكامل لا يُرفع إلى git؛ يضعه المستخدم محليًا.
 */
const files = import.meta.glob<string>('../../data/*.csv', { query: '?raw', import: 'default' })

const FULL = '../../data/oxford5000.csv'
const SAMPLE = '../../data/sample.csv'

export interface LoadInfo {
  source: 'oxford5000' | 'sample' | 'custom'
  count: number
  errors: string[]
}

function hash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export async function loadWords(): Promise<LoadInfo> {
  const key = files[FULL] ? FULL : SAMPLE
  const loader = files[key]
  if (!loader) throw new Error('لم يُعثر على ملف الكلمات في مجلد data/')
  // قائمة استوردها المستخدم من جهازه (تبقى في متصفحه فقط) لها الأولوية.
  const custom = (await db.meta.get(CUSTOM))?.value as CustomList | undefined
  const text = custom?.text ?? (await loader())
  const source: LoadInfo['source'] = custom ? 'custom' : key === FULL ? 'oxford5000' : 'sample'
  const { words: raw, errors } = parseWordList(text)
  // تصنيفات المواضيع المحفوظة (من الذكاء الاصطناعي) تحدد ترتيب المجموعات داخل المستوى.
  const topics = new Map((await db.topics.toArray()).map((t) => [t.wordId, t.topic]))
  const words = buildWordList(raw.map((r) => ({ ...r, topic: r.topic ?? topics.get(wordId(r.word, r.pos)) })))
  const signature = `${source}:${words.length}:${hash(text)}:${topics.size}`

  const stored = await db.meta.get('wordsSignature')
  if (stored?.value !== signature) {
    // نستبدل جدول الكلمات فقط؛ تقدّم المتعلم في جدول مستقل ولا يتأثر.
    await db.transaction('rw', db.words, db.meta, async () => {
      await db.words.clear()
      await db.words.bulkAdd(words)
      await db.meta.put({ key: 'wordsSignature', value: signature })
    })
  }

  const info: LoadInfo = { source, count: words.length, errors }
  await db.meta.put({ key: 'loadInfo', value: info })
  return info
}

// ——— استيراد قائمة الكلمات من جهاز المستخدم ———

const CUSTOM = 'customWordList'
export const MIN_IMPORT_WORDS = 50

interface CustomList {
  text: string
  name: string
  importedAt: number
}

export interface ImportResult {
  ok: boolean
  count: number
  errors: string[]
}

/** يستورد ملف CSV (word,level,pos) ويحفظه في المتصفح فقط، ثم يعيد بناء الكلمات. التقدّم لا يتأثر. */
export async function importWordList(text: string, name: string): Promise<ImportResult> {
  const { words, errors } = parseWordList(text)
  if (words.length < MIN_IMPORT_WORDS) return { ok: false, count: words.length, errors }
  await db.meta.put({ key: CUSTOM, value: { text, name, importedAt: Date.now() } satisfies CustomList })
  await loadWords()
  return { ok: true, count: words.length, errors }
}

export async function removeImportedWordList(): Promise<void> {
  await db.meta.delete(CUSTOM)
  await loadWords()
}
