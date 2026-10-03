/**
 * توليد محتوى الكلمات (المرحلة 4): المعنى العربي، المقاطع، جملتا مثال، طريقة تذكّر،
 * عائلة الكلمة، ومجموعة الموضوع. يُولَّد مرة واحدة لكل كلمة ويُخزَّن في المتصفح.
 */
import { isFormOf } from '../src/lib/highlight.js'
import { tokenize } from '../src/lib/storyText.js'
import { TOPICS } from '../src/lib/topics.js'
import { isLevel, type Level } from '../src/lib/types.js'
import { AiError, generateJson, parsePos, parseWord, respond, str, type Env, type Fetch } from './gemini.js'

export const CONTENT_BATCH = 10
export const TOPIC_BATCH = 200
const TOPIC_IDS = TOPICS.map((t) => t.id)

export interface ContentWord {
  word: string
  pos?: string
  level: Level
}

export interface GeneratedContent {
  meaningAr: string
  syllables: string
  examples: { en: string; ar: string }[]
  memory: { kind: 'link' | 'story' | 'family'; text: string }
  family: { en: string; pos: string; ar: string }[]
  topic?: string
}

export function parseContentRequest(body: unknown): ContentWord[] {
  const words = (body as { words?: unknown })?.words
  if (!Array.isArray(words) || words.length === 0) throw new AiError(400, 'bad_request', 'no words')
  return words.slice(0, CONTENT_BATCH).map((w) => {
    const level = String(w?.level ?? '')
    if (!isLevel(level)) throw new AiError(400, 'bad_request', 'invalid level')
    return { word: parseWord(w?.word, 'words'), pos: parsePos(w?.pos), level }
  })
}

export function buildContentPrompt(words: ContentWord[]): string {
  return [
    'You are an expert English teacher writing vocabulary cards for Arabic-speaking learners (Oxford 5000 list).',
    'For EACH word below (keep the same order, one item per word, copy "word" exactly):',
    '- "meaning_ar": the most common Arabic meaning for this part of speech at this CEFR level, 1–3 words (two close synonyms may be separated by "، ").',
    '- "syllables": the word split into syllables with a middle dot "·" (e.g. "pa·tience"); a one-syllable word stays as is.',
    '- "examples": exactly 2 short, natural sentences (max 12 words) at the word\'s CEFR level that contain the word (inflected forms are fine), each with a natural Arabic translation "ar".',
    '- "memory": the single most helpful memory aid, written in Arabic: kind "link" (a sound-alike or familiar Arabic/brand/loanword connection), "story" (a tiny vivid scene), or "family" (word parts / related forms). Must be accurate — never invent false etymology.',
    '- "family": 0–4 real related English words (different forms of the word), each with "pos" (noun, verb, adjective, adverb) and Arabic "ar".',
    `- "topic": one of ${TOPIC_IDS.join(', ')} (people=family & people, describing=adjectives that fit no other topic, actions=verbs that fit no other topic, general=other nouns, function=grammar words).`,
    '',
    'WORDS:',
    ...words.map((w, i) => `${i + 1}. ${w.word}${w.pos ? ` (${w.pos})` : ''} — CEFR ${w.level}`),
  ].join('\n')
}

export const CONTENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          meaning_ar: { type: 'STRING' },
          syllables: { type: 'STRING' },
          examples: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ar: { type: 'STRING' } }, required: ['en', 'ar'] },
          },
          memory: {
            type: 'OBJECT',
            properties: { kind: { type: 'STRING', enum: ['link', 'story', 'family'] }, text: { type: 'STRING' } },
            required: ['kind', 'text'],
          },
          family: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { en: { type: 'STRING' }, pos: { type: 'STRING' }, ar: { type: 'STRING' } },
              required: ['en', 'pos', 'ar'],
            },
          },
          topic: { type: 'STRING', enum: TOPIC_IDS },
        },
        required: ['word', 'meaning_ar', 'syllables', 'examples', 'memory', 'family', 'topic'],
      },
    },
  },
  required: ['items'],
}

const ARABIC = /[؀-ۿ]/

/** يتحقق من كل عنصر؛ العنصر غير الصالح يُعاد null (تُطلب الكلمة لاحقًا من جديد). */
export function validateContentItem(raw: unknown, word: string): GeneratedContent | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const meaningAr = str(r.meaning_ar, 80)
  if (!meaningAr || !ARABIC.test(meaningAr)) return null
  const examples = (Array.isArray(r.examples) ? r.examples : [])
    .map((e) => ({ en: str(e?.en, 200), ar: str(e?.ar, 200) }))
    .filter((e) => e.en && e.ar && hasForm(e.en, word))
    .slice(0, 2)
  if (examples.length === 0) return null
  const syl = str(r.syllables, 60)
  const syllables = syl.replace(/[·•.\- ]/g, '').toLowerCase() === word.replace(/[ .-]/g, '').toLowerCase() ? syl.replace(/[•]/g, '·') : word
  const m = (r.memory ?? {}) as Record<string, unknown>
  const kind = m.kind === 'link' || m.kind === 'story' || m.kind === 'family' ? m.kind : 'story'
  const family = (Array.isArray(r.family) ? r.family : [])
    .map((f) => ({ en: str(f?.en, 40), pos: str(f?.pos, 20).toLowerCase(), ar: str(f?.ar, 60) }))
    .filter((f) => /^[A-Za-z][A-Za-z' -]*$/.test(f.en) && f.ar && f.en.toLowerCase() !== word.toLowerCase())
    .slice(0, 4)
  const topic = typeof r.topic === 'string' && TOPIC_IDS.includes(r.topic) ? r.topic : undefined
  return { meaningAr, syllables, examples, memory: { kind, text: str(m.text, 400) || meaningAr }, family, topic }
}

function hasForm(sentence: string, word: string): boolean {
  if (word.includes(' ')) return sentence.toLowerCase().includes(word.toLowerCase())
  return tokenize(sentence).some((t) => isFormOf(t.text, word))
}

export async function generateContent(words: ContentWord[], env: Env, fetchImpl?: Fetch) {
  const { value, model } = await generateJson({
    prompt: buildContentPrompt(words),
    schema: CONTENT_SCHEMA,
    env,
    fetchImpl,
    temperature: 0.4,
    validate: (raw) => {
      const items = (raw as { items?: unknown[] })?.items
      if (!Array.isArray(items)) throw new Error('no items')
      // نطابق بالكلمة، ثم بالموضع احتياطًا.
      const out = words.map((w, i) => {
        const match = items.find((it) => str((it as { word?: unknown })?.word, 40).toLowerCase() === w.word.toLowerCase()) ?? items[i]
        return validateContentItem(match, w.word)
      })
      if (out.every((c) => c === null)) throw new Error('no valid items')
      return out
    },
  })
  return { items: value, model }
}

export function handleContent(body: unknown, env: Env, fetchImpl?: Fetch) {
  return respond('content', () => generateContent(parseContentRequest(body), env, fetchImpl))
}

// ——— تصنيف المواضيع لترتيب الكلمات داخل المستوى ———

export function parseTopicRequest(body: unknown): { word: string; pos?: string }[] {
  const words = (body as { words?: unknown })?.words
  if (!Array.isArray(words) || words.length === 0) throw new AiError(400, 'bad_request', 'no words')
  return words.slice(0, TOPIC_BATCH).map((w) => ({ word: parseWord(w?.word, 'words'), pos: parsePos(w?.pos) }))
}

export const TOPIC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { i: { type: 'INTEGER' }, topic: { type: 'STRING', enum: TOPIC_IDS } },
        required: ['i', 'topic'],
      },
    },
  },
  required: ['items'],
}

export async function classifyTopics(words: { word: string; pos?: string }[], env: Env, fetchImpl?: Fetch) {
  const prompt = [
    'Classify each English word (with its part of speech) into exactly one topic group for a vocabulary course.',
    `Topics: ${TOPICS.map((t) => `${t.id} (${t.label})`).join('; ')}.`,
    'Prefer a concrete topic; use describing / actions / general / function only when no concrete topic fits.',
    'Return one item per word with its number "i".',
    '',
    ...words.map((w, i) => `${i}. ${w.word}${w.pos ? ` (${w.pos})` : ''}`),
  ].join('\n')
  const { value, model } = await generateJson({
    prompt,
    schema: TOPIC_SCHEMA,
    env,
    fetchImpl,
    temperature: 0,
    validate: (raw) => {
      const items = (raw as { items?: unknown[] })?.items
      if (!Array.isArray(items)) throw new Error('no items')
      const topics: (string | null)[] = words.map(() => null)
      for (const it of items as { i?: unknown; topic?: unknown }[]) {
        const i = Number(it?.i)
        if (Number.isInteger(i) && i >= 0 && i < words.length && typeof it.topic === 'string' && TOPIC_IDS.includes(it.topic)) {
          topics[i] = it.topic
        }
      }
      if (topics.every((t) => t === null)) throw new Error('no valid topics')
      return topics
    },
  })
  return { topics: value, model }
}

export function handleTopics(body: unknown, env: Env, fetchImpl?: Fetch) {
  return respond('topics', () => classifyTopics(parseTopicRequest(body), env, fetchImpl))
}
