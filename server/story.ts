/**
 * توليد قصة اليوم عبر Gemini — منطق الخادم فقط (المفتاح لا يصل للواجهة أبدًا).
 * يُستدعى من api/story.ts (Vercel) ومن خادم التطوير في vite.config.ts.
 */
import { missingTargets, type StoryKind, type StorySentence } from '../src/lib/storyText.js'
import { isLevel, type Level } from '../src/lib/types.js'

export interface StoryWord {
  word: string
  pos?: string
  meaningAr?: string
}

export interface StoryRequest {
  kind: StoryKind
  level: Level
  mode: 'serial' | 'standalone'
  episode: number
  words: StoryWord[]
  reviewWords: StoryWord[]
  /** ملخصات الحلقات السابقة (للقصص المتسلسلة). */
  previous: string[]
}

export interface StoryQuestion {
  question: string
  options: string[]
  answer: number
}

export interface GeneratedStory {
  title: string
  titleAr: string
  sentences: StorySentence[]
  questions: StoryQuestion[]
  /** ملخص إنجليزي قصير للحلقة، يُمرَّر للحلقة التالية. */
  summary: string
}

export interface StoryResponse {
  story: GeneratedStory
  missing: string[]
  model: string
}

export class StoryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

// ——— التحقق من المدخلات: القيم تُحقن في التعليمات، فنضيّقها بشدة ———

// كلمات أكسفورد: حتى 3 أجزاء (per cent, a lot) و25 حرفًا.
const WORD_RE = /^[A-Za-z][A-Za-z'’.-]*(?: [A-Za-z][A-Za-z'’.-]*){0,2}$/
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>{}]/g, '').trim().slice(0, max) : '')

function parseWords(value: unknown, max: number, field: string): StoryWord[] {
  if (!Array.isArray(value)) throw new StoryError(400, 'bad_request', `${field} must be an array`)
  return value.slice(0, max).map((w) => {
    const word = typeof w?.word === 'string' ? w.word.trim() : ''
    if (word.length > 25 || !WORD_RE.test(word)) throw new StoryError(400, 'bad_request', `invalid word in ${field}`)
    return { word, pos: clean(w?.pos, 40) || undefined, meaningAr: clean(w?.meaningAr, 80) || undefined }
  })
}

export function parseRequest(body: unknown): StoryRequest {
  const b = (body ?? {}) as Record<string, unknown>
  const level = String(b.level ?? '')
  if (!isLevel(level)) throw new StoryError(400, 'bad_request', 'invalid level')
  const kind = b.kind === 'beginner' || b.kind === 'advanced' ? b.kind : null
  if (!kind) throw new StoryError(400, 'bad_request', 'invalid kind')
  const words = parseWords(b.words, 30, 'words')
  if (words.length === 0) throw new StoryError(400, 'bad_request', 'no words')
  return {
    kind,
    level,
    mode: b.mode === 'standalone' ? 'standalone' : 'serial',
    episode: Math.max(1, Math.min(9999, Number(b.episode) || 1)),
    words,
    reviewWords: parseWords(b.reviewWords ?? [], 8, 'reviewWords'),
    previous: (Array.isArray(b.previous) ? b.previous : []).slice(-3).map((p) => clean(p, 400)).filter(Boolean),
  }
}

// ——— التعليمات ———

const HERO =
  'Omar, a friendly 24-year-old from Jordan who has just moved to Manchester, England, to study and work part-time. ' +
  'Recurring people: his neighbour Mrs Clark (70, kind, loves her garden), his classmate Lina (from Lebanon, funny), ' +
  'and his little cat Biscuit.'

export function buildPrompt(r: StoryRequest): string {
  const list = (ws: StoryWord[]) =>
    ws.map((w) => `- ${w.word}${w.pos ? ` (${w.pos})` : ''}${w.meaningAr ? ` = ${w.meaningAr}` : ''}`).join('\n')
  const lines = [
    'You write very short graded-reader stories for Arabic-speaking learners of English.',
    `Learner level: CEFR ${r.level}.`,
    '',
    "TODAY'S WORDS (each must appear at least once, used naturally with its meaning shown):",
    list(r.words),
  ]
  if (r.reviewWords.length) lines.push('', 'REVIEW WORDS (use some of them if natural):', list(r.reviewWords))
  lines.push('')
  if (r.kind === 'beginner') {
    lines.push(
      'FORMAT — beginner story:',
      '- Each sentence "text" is simple Modern Standard Arabic, but every one of today\'s words is written IN ENGLISH inside the Arabic sentence (e.g. "فتح عمر الـ door ببطء.").',
      '- Write ONLY today\'s words and review words in English; everything else in Arabic.',
      '- "translation" is the same sentence fully in simple English.',
      '- 8 to 12 short sentences.',
    )
  } else {
    lines.push(
      'FORMAT — English story:',
      `- Each sentence "text" is in English. Use only vocabulary at CEFR ${r.level} or below, apart from today's words and review words. Inflected forms (arrived, cities) are fine.`,
      '- "translation" is a natural Arabic translation of that sentence.',
      '- 10 to 16 sentences, 120 to 220 words in total (1–2 minutes of reading).',
    )
  }
  if (r.mode === 'serial') {
    lines.push('', `SERIES — this is episode ${r.episode} of an ongoing series about ${HERO}`)
    if (r.previous.length) lines.push('Previously:', ...r.previous.map((p) => `- ${p}`), 'Continue the story naturally from there.')
    else lines.push('This is the first episode: introduce Omar briefly.')
  } else {
    lines.push('', 'A complete standalone story with new characters.')
  }
  lines.push(
    '',
    'ALSO RETURN:',
    '- "title" (English) and "title_ar" (Arabic).',
    '- "questions": exactly 3 comprehension questions written in Arabic, each with 3 short Arabic options and "answer" = index (0-2) of the correct option. Vary the position of the correct answer.',
    '- "summary": 1–2 English sentences summarising this episode (used to continue the series tomorrow).',
    'Keep it warm, everyday and suitable for all ages.',
  )
  return lines.join('\n')
}

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    title_ar: { type: 'STRING' },
    sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { text: { type: 'STRING' }, translation: { type: 'STRING' } },
        required: ['text', 'translation'],
      },
    },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answer: { type: 'INTEGER' },
        },
        required: ['question', 'options', 'answer'],
      },
    },
    summary: { type: 'STRING' },
  },
  required: ['title', 'title_ar', 'sentences', 'questions', 'summary'],
}

// ——— التحقق من مخرجات النموذج ———

export function validateStory(raw: unknown): GeneratedStory {
  const r = (raw ?? {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const sentences = (Array.isArray(r.sentences) ? r.sentences : [])
    .map((s) => ({ text: str(s?.text, 400), translation: str(s?.translation, 400) }))
    .filter((s) => s.text)
    .slice(0, 24)
  const questions = (Array.isArray(r.questions) ? r.questions : [])
    .map((q) => {
      const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 120)).filter(Boolean).slice(0, 4)
      return { question: str(q?.question, 200), options, answer: Number(q?.answer) }
    })
    .filter((q) => q.question && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)
    .slice(0, 3)
  if (sentences.length < 4) throw new StoryError(502, 'bad_output', 'story too short')
  return {
    title: str(r.title, 120) || 'Today’s story',
    titleAr: str(r.title_ar, 120) || 'قصة اليوم',
    sentences,
    questions,
    summary: str(r.summary, 400),
  }
}

// ——— الاستدعاء ———

export const DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest']
const API = 'https://generativelanguage.googleapis.com/v1beta/models'
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504])

type Fetch = typeof fetch

async function callGemini(model: string, prompt: string, apiKey: string, fetchImpl: Fetch, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${API}/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.9 },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
      error?: { message?: string }
    }
    if (!res.ok) return { ok: false as const, status: res.status, message: data.error?.message ?? res.statusText }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    try {
      return { ok: true as const, json: JSON.parse(text) as unknown }
    } catch {
      return { ok: false as const, status: 502, message: 'invalid JSON from model' }
    }
  } catch (e) {
    return { ok: false as const, status: 504, message: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timer)
  }
}

export interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODELS?: string
}

/**
 * يجرّب النماذج بالترتيب عند الازدحام (503/429) ويعيد المحاولة مرة إذا نسي النموذج كلمات اليوم.
 */
export async function generateStory(
  request: StoryRequest,
  env: Env,
  fetchImpl: Fetch = fetch,
  timeoutMs = 25_000,
  /** حد إجمالي لكل المحاولات حتى لا تتجاوز مهلة الدالة. */
  deadlineMs = 55_000,
): Promise<StoryResponse> {
  const startedAt = Date.now()
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) throw new StoryError(503, 'not_configured', 'GEMINI_API_KEY is not set')
  const models = (env.GEMINI_MODELS?.split(',').map((m) => m.trim()).filter(Boolean)) ?? DEFAULT_MODELS
  const targets = request.words.map((w) => w.word)
  let prompt = buildPrompt(request)
  let best: StoryResponse | null = null
  let lastError = 'no model available'

  for (let attempt = 0; attempt < 2; attempt++) {
    let produced = false
    for (const model of models) {
      const remaining = deadlineMs - (Date.now() - startedAt)
      if (remaining < 5_000) break
      const result = await callGemini(model, prompt, apiKey, fetchImpl, Math.min(timeoutMs, remaining))
      if (!result.ok) {
        lastError = `${model}: ${result.status} ${result.message}`
        if (result.status === 400 || result.status === 401 || result.status === 403) {
          throw new StoryError(502, 'provider_rejected', lastError)
        }
        if (RETRYABLE.has(result.status)) continue
        throw new StoryError(502, 'provider_error', lastError)
      }
      let story: GeneratedStory
      try {
        story = validateStory(result.json)
      } catch (e) {
        lastError = `${model}: ${e instanceof Error ? e.message : e}`
        continue
      }
      const missing = missingTargets(story.sentences, targets)
      if (!best || missing.length < best.missing.length) best = { story, missing, model }
      produced = true
      break
    }
    if (!produced) break
    if (best && best.missing.length === 0) return best
    prompt = `${buildPrompt(request)}\n\nIMPORTANT: your previous draft forgot these words: ${best!.missing.join(', ')}. Every one of today's words must appear.`
  }
  if (best) return best
  throw new StoryError(503, 'unavailable', lastError)
}

/** نقطة دخول مشتركة: تُرجع حالة HTTP وجسم JSON. */
export async function handleStory(body: unknown, env: Env, fetchImpl?: Fetch): Promise<{ status: number; json: unknown }> {
  try {
    return { status: 200, json: await generateStory(parseRequest(body), env, fetchImpl) }
  } catch (e) {
    if (e instanceof StoryError) {
      if (e.status >= 500) console.error('[story]', e.code, e.message)
      return { status: e.status, json: { error: e.code } }
    }
    console.error('[story] unexpected', e)
    return { status: 500, json: { error: 'internal' } }
  }
}
