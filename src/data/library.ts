/**
 * مكتبة شرح الكلمات المشتركة (Firestore: wordContent/{wordId}).
 * أي شرح يولّده من يملك مفتاحًا يُحفظ للجميع، فيحصل الطلاب على شرح كل الكلمات بلا مفتاح.
 * كل الدوال هنا «أفضل محاولة»: الفشل (لا إنترنت، لا صلاحية) لا يوقف التعلّم.
 */
import { wasSignedIn } from './cloud'
import type { WordContent } from './sampleContent'

export interface SharedContent {
  content: WordContent
  topic?: string
}

// معرّف المستند لا يقبل «/».
const docId = (wordId: string) => encodeURIComponent(wordId)

async function sdk() {
  if (!wasSignedIn()) return null
  const { cloudSdk } = await import('./cloud')
  return cloudSdk().catch(() => null)
}

export async function fetchShared(ids: string[]): Promise<Map<string, SharedContent>> {
  const found = new Map<string, SharedContent>()
  const s = await sdk()
  if (!s || ids.length === 0) return found
  const { db, fs } = s
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30)
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'wordContent'), fs.where(fs.documentId(), 'in', chunk.map(docId))))
      for (const d of snap.docs) {
        const data = d.data() as SharedContent
        if (data.content) found.set(decodeURIComponent(d.id), { content: data.content, topic: data.topic })
      }
    } catch (e) {
      console.warn('[library]', e)
    }
  }
  return found
}

export async function uploadShared(rows: { wordId: string; content: WordContent; topic?: string; model: string }[]): Promise<void> {
  const s = await sdk()
  if (!s || rows.length === 0) return
  const { db, fs } = s
  const batch = fs.writeBatch(db)
  for (const r of rows) {
    batch.set(
      fs.doc(db, 'wordContent', docId(r.wordId)),
      JSON.parse(JSON.stringify({ content: r.content, ...(r.topic ? { topic: r.topic } : {}), model: r.model, createdAt: Date.now() })),
    )
  }
  // الطالب بلا إذن مفتاح لا يكتب في المكتبة — طبيعي، نتجاهل الرفض.
  await batch.commit().catch((e) => console.warn('[library]', e?.code ?? e))
}

/** عدد الكلمات الجاهزة في المكتبة (للمالك). */
export async function sharedCount(): Promise<number | null> {
  const s = await sdk()
  if (!s) return null
  const snap = await s.fs.getCountFromServer(s.fs.collection(s.db, 'wordContent'))
  return snap.data().count
}
