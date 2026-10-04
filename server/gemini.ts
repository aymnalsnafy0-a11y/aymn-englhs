/**
 * استدعاء Gemini المشترك (القصص، محتوى الكلمات، المواضيع): مخرجات JSON بمخطط محدد،
 * نماذج بديلة عند الازدحام، ومهلة إجمالية. المفتاح يُقرأ من البيئة في الخادم فقط.
 */
export interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODELS?: string
}

export class AiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export type Fetch = typeof fetch

export const DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest']
const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504])

type CallResult = { ok: true; json: unknown } | { ok: false; status: number; message: string }

/** صورة مرفقة بالطلب (base64 بدون بادئة data:). */
export interface InlineImage {
  mime: string
  data: string
}

async function callGemini(
  model: string,
  prompt: string,
  images: InlineImage[],
  schema: object,
  temperature: number,
  apiKey: string,
  fetchImpl: Fetch,
  timeoutMs: number,
): Promise<CallResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${API}/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [...images.map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: prompt }] },
        ],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }
    if (!res.ok) return { ok: false, status: res.status, message: data.error?.message ?? res.statusText }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    try {
      return { ok: true, json: JSON.parse(text) as unknown }
    } catch {
      return { ok: false, status: 502, message: 'invalid JSON from model' }
    }
  } catch (e) {
    return { ok: false, status: 504, message: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timer)
  }
}

export interface GenerateOptions<T> {
  prompt: string
  /** صور تُرسل مع التعليمات (مثل صور الدرس). */
  images?: InlineImage[]
  schema: object
  env: Env
  /** يحوّل المخرجات الخام إلى قيمة صالحة أو يرمي خطأً (فيُجرَّب النموذج التالي). */
  validate: (raw: unknown) => T
  fetchImpl?: Fetch
  temperature?: number
  timeoutMs?: number
  /** لحظة انتهاء المهلة الإجمالية (Date.now() + …). */
  deadlineAt?: number
}

export async function generateJson<T>(o: GenerateOptions<T>): Promise<{ value: T; model: string }> {
  const apiKey = o.env.GEMINI_API_KEY
  if (!apiKey) throw new AiError(503, 'not_configured', 'GEMINI_API_KEY is not set')
  const models = o.env.GEMINI_MODELS?.split(',').map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS
  const deadlineAt = o.deadlineAt ?? Date.now() + 55_000
  let lastError = 'no model available'

  for (const model of models) {
    const remaining = deadlineAt - Date.now()
    if (remaining < 5_000) break
    const result = await callGemini(
      model,
      o.prompt,
      o.images ?? [],
      o.schema,
      o.temperature ?? 0.7,
      apiKey,
      o.fetchImpl ?? fetch,
      Math.min(o.timeoutMs ?? 25_000, remaining),
    )
    if (result.ok === false) {
      lastError = `${model}: ${result.status} ${result.message}`
      if (result.status === 400 || result.status === 401 || result.status === 403) {
        throw new AiError(502, 'provider_rejected', lastError)
      }
      if (RETRYABLE.has(result.status)) continue
      throw new AiError(502, 'provider_error', lastError)
    }
    try {
      return { value: o.validate(result.json), model }
    } catch (e) {
      lastError = `${model}: ${e instanceof Error ? e.message : e}`
    }
  }
  throw new AiError(503, 'unavailable', lastError)
}

/** يحوّل الاستثناءات إلى حالة HTTP ورمز خطأ دون تسريب تفاصيل المزوّد للواجهة. */
export async function respond(tag: string, run: () => Promise<unknown>): Promise<{ status: number; json: unknown }> {
  try {
    return { status: 200, json: await run() }
  } catch (e) {
    if (e instanceof AiError) {
      if (e.status >= 500) console.error(`[${tag}]`, e.code, e.message)
      return { status: e.status, json: { error: e.code } }
    }
    console.error(`[${tag}] unexpected`, e)
    return { status: 500, json: { error: 'internal' } }
  }
}

// ——— أدوات تحقق مشتركة ———

/** كلمات أكسفورد: حتى 3 أجزاء (per cent, a lot) و25 حرفًا. القيم تُحقن في التعليمات، فنضيّقها بشدة. */
const WORD_RE = /^[A-Za-z][A-Za-z'’.-]*(?: [A-Za-z][A-Za-z'’.-]*){0,2}$/

export function cleanText(s: unknown, max: number): string {
  return typeof s === 'string' ? s.replace(/[\u0000-\u001f<>{}]/g, '').trim().slice(0, max) : ''
}

export function parseWord(value: unknown, field: string): string {
  const word = typeof value === 'string' ? value.trim() : ''
  if (word.length > 25 || !WORD_RE.test(word)) throw new AiError(400, 'bad_request', `invalid word in ${field}`)
  return word
}

/** نوع الكلمة كما في القائمة: حروف وفواصل ومسافات فقط. */
export function parsePos(value: unknown): string | undefined {
  const pos = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z ,]{1,40}$/.test(pos) ? pos : undefined
}

export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
