import { parseWordList } from '../lib/csv'
import { buildWordList } from '../lib/words'
import { db } from './db'

/**
 * يحمّل قائمة الكلمات من data/oxford5000.csv إن وُجد، وإلا من data/sample.csv.
 * الملف الكامل لا يُرفع إلى git؛ يضعه المستخدم محليًا.
 */
const files = import.meta.glob<string>('../../data/*.csv', { query: '?raw', import: 'default' })

const FULL = '../../data/oxford5000.csv'
const SAMPLE = '../../data/sample.csv'

export interface LoadInfo {
  source: 'oxford5000' | 'sample'
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
  const text = await loader()
  const source = key === FULL ? 'oxford5000' : 'sample'
  const { words: raw, errors } = parseWordList(text)
  const words = buildWordList(raw)
  const signature = `${source}:${words.length}:${hash(text)}`

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
