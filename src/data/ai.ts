/**
 * طريق واحد لطلبات الذكاء الاصطناعي (القصة، محتوى الكلمات، المواضيع):
 * - إن حفظ المستخدم مفتاح Gemini في الإعدادات: يُستدعى Gemini مباشرة من المتصفح بنفس منطق الخادم.
 *   المفتاح يبقى في هذا الجهاز فقط (IndexedDB) ولا يُرفع لأي مكان.
 * - وإلا: دالة الخادم /api/* (Vercel أو خادم التطوير).
 */
import { db } from '../db/db'

export type AiRoute = 'story' | 'content' | 'topics' | 'exercises'

export interface AiResult {
  ok: boolean
  status: number
  json: any
}

const KEY = 'geminiKey'

/** مفتاح المستخدم الشخصي أولًا، وإلا المفتاح الذي شاركه المالك (إن سمح له). */
export async function getGeminiKey(): Promise<string | undefined> {
  for (const k of [KEY, 'sharedGeminiKey']) {
    const row = await db.meta.get(k)
    if (typeof row?.value === 'string' && row.value) return row.value
  }
  return undefined
}

/** المفتاح الشخصي فقط (للمشاركة من حساب المالك). */
export async function getPersonalGeminiKey(): Promise<string | undefined> {
  const row = await db.meta.get(KEY)
  return typeof row?.value === 'string' && row.value ? row.value : undefined
}

export async function setGeminiKey(key: string | null): Promise<void> {
  if (key) await db.meta.put({ key: KEY, value: key.trim() })
  else await db.meta.delete(KEY)
  // ما فشل قبل المفتاح يُعاد طلبه.
  const { clearContentFailures } = await import('./content')
  clearContentFailures()
}

/** يتحقق من المفتاح بطلب خفيف (قائمة النماذج). */
export async function testGeminiKey(key: string): Promise<'ok' | 'invalid' | 'network'> {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      headers: { 'x-goog-api-key': key.trim() },
    })
    return res.ok ? 'ok' : 'invalid'
  } catch {
    return 'network'
  }
}

const LOCAL: Record<AiRoute, () => Promise<(body: unknown, env: { GEMINI_API_KEY?: string }) => Promise<{ status: number; json: unknown }>>> = {
  story: () => import('../../server/story').then((m) => m.handleStory),
  content: () => import('../../server/content').then((m) => m.handleContent),
  topics: () => import('../../server/content').then((m) => m.handleTopics),
  exercises: () => import('../../server/exercises').then((m) => m.handleExercises),
}

export async function postAi(route: AiRoute, body: unknown): Promise<AiResult> {
  const key = await getGeminiKey()
  if (key) {
    const handler = await LOCAL[route]()
    const { status, json } = await handler(body, { GEMINI_API_KEY: key })
    // نفس شكل استجابة الخادم (JSON): تختفي الحقول الفارغة undefined.
    return { ok: status === 200, status, json: JSON.parse(JSON.stringify(json)) }
  }
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    // موقع ثابت بلا خادم (GitHub Pages): لا توجد /api — نطلب المفتاح من الإعدادات.
    if (!json) return { ok: false, status: res.status, json: { error: res.status === 404 || res.status === 405 ? 'not_configured' : 'network' } }
    return { ok: res.ok, status: res.status, json }
  } catch {
    return { ok: false, status: 0, json: { error: 'network' } }
  }
}

/** موقع ثابت بلا خادم (GitHub Pages أو المعاينة): الذكاء الاصطناعي يحتاج مفتاح المستخدم. */
export function isStaticHost(): boolean {
  return import.meta.env.MODE === 'artifact' || import.meta.env.VITE_STATIC === '1'
}
