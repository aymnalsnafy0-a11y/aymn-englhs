/**
 * توليد تمارين من درس (ملاحظات المدرس و/أو صور الدرس) عبر Gemini.
 * الصور تُستخدم للتوليد فقط ولا تُخزَّن.
 */
import type { Exercise, ExerciseType } from '../src/lib/exercises.js'
import { isLevel, type Level } from '../src/lib/types.js'
import { AiError, cleanText, generateJson, respond, str, type Env, type Fetch, type InlineImage } from './gemini.js'

export const MAX_IMAGES = 6
export const MAX_IMAGE_BASE64 = 1_600_000 // ~1.2MB لكل صورة بعد التصغير في المتصفح
export const MAX_NOTES = 8000
const TYPES: ExerciseType[] = ['mcq', 'tf', 'fill', 'order']

export interface ExerciseRequest {
  notes: string
  images: InlineImage[]
  level: Level
  count: number
  types: ExerciseType[]
}

export function parseExerciseRequest(body: unknown): ExerciseRequest {
  const b = (body ?? {}) as Record<string, unknown>
  const level = String(b.level ?? '')
  if (!isLevel(level)) throw new AiError(400, 'bad_request', 'invalid level')
  const notes = typeof b.notes === 'string' ? b.notes.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, MAX_NOTES) : ''
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, MAX_IMAGES).map((im) => {
    const mime = String(im?.mime ?? '')
    const data = String(im?.data ?? '')
    if (!/^image\/(jpeg|png|webp)$/.test(mime) || !/^[A-Za-z0-9+/=]+$/.test(data) || data.length > MAX_IMAGE_BASE64) {
      throw new AiError(400, 'bad_request', 'invalid image')
    }
    return { mime, data }
  })
  if (!notes && images.length === 0) throw new AiError(400, 'bad_request', 'empty lesson')
  const types = (Array.isArray(b.types) ? b.types : TYPES).filter((t): t is ExerciseType => TYPES.includes(t as ExerciseType))
  return {
    notes,
    images,
    level,
    count: Math.max(3, Math.min(20, Number(b.count) || 10)),
    types: types.length ? types : TYPES,
  }
}

export function buildExercisePrompt(r: ExerciseRequest): string {
  const kinds: Record<ExerciseType, string> = {
    mcq: '"mcq": a question with 3–4 short options and "answer" = index of the correct option',
    tf: '"tf": a statement about the lesson, "answer" true or false',
    fill: `"fill": an English sentence with exactly one blank written as "____", "answers" = all acceptable answers (1–3, single words or short phrases), optional Arabic "hint"`,
    order: '"order": "words" = a correct English sentence from the lesson split into 3–10 words in the right order, "q" = its Arabic meaning',
  }
  return [
    'You are an experienced English teacher writing homework for Arabic-speaking students after a live lesson.',
    `Students' level: CEFR ${r.level}.`,
    r.images.length ? `The attached ${r.images.length} image(s) show the lesson material (board, slides or book pages). Read them carefully.` : '',
    r.notes ? `Teacher's notes about the lesson:\n"""\n${r.notes}\n"""` : '',
    '',
    `Write exactly ${r.count} exercises that practise what was taught in THIS lesson (its vocabulary, grammar and sentences) — not general knowledge.`,
    `Mix these types fairly evenly: ${r.types.map((t) => kinds[t]).join('; ')}.`,
    'Rules:',
    '- Each exercise has "ask": a short Arabic instruction telling the student what to do (e.g. "اختر الصيغة الصحيحة للفعل", "هل الجملة صحيحة؟", "املأ الفراغ بالفعل المناسب"). Do NOT repeat the instruction inside "q": "q" holds only the English sentence or question itself.',
    '- Exercise content (questions, options, sentences) in English, at the students\' level; instructions/hints in Arabic where noted.',
    '- Each exercise has "explain": one short Arabic sentence explaining the correct answer (the rule or meaning).',
    '- Exactly one correct answer per question; no trick questions; vary the position of the correct option.',
    '- Also return "title" (a short Arabic homework title) and "summary" (1–2 Arabic sentences: what the lesson covered).',
    '- If the material is unreadable or not an English lesson, return an empty "exercises" list and explain why in "summary".',
  ]
    .filter((l) => l !== '')
    .join('\n')
}

export const EXERCISE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: TYPES },
          ask: { type: 'STRING' },
          q: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answer: { type: 'STRING', description: 'mcq: index as a number string; tf: "true" or "false"' },
          answers: { type: 'ARRAY', items: { type: 'STRING' } },
          words: { type: 'ARRAY', items: { type: 'STRING' } },
          hint: { type: 'STRING' },
          explain: { type: 'STRING' },
        },
        required: ['type', 'ask', 'explain'],
      },
    },
  },
  required: ['title', 'summary', 'exercises'],
}

const BLANK_RE = /_{2,}|\.{3,}|…/

/** يتحقق من سؤال واحد؛ غير الصالح يُعاد null (يُستبعد). */
export function validateExercise(raw: unknown): Exercise | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const explain = str(r.explain, 300) || undefined
  const ask = str(r.ask, 120) || undefined
  const list = (v: unknown, max: number, len: number) =>
    (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, max)
  switch (r.type) {
    case 'mcq': {
      const q = str(r.q, 300)
      const options = list(r.options, 4, 120)
      const answer = Number(r.answer)
      if (!q || options.length < 2 || new Set(options).size !== options.length) return null
      if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null
      return { type: 'mcq', ask, q, options, answer, explain }
    }
    case 'tf': {
      const q = str(r.q, 300)
      const answer = r.answer === true || r.answer === 'true' ? true : r.answer === false || r.answer === 'false' ? false : null
      return q && answer !== null ? { type: 'tf', ask, q, answer, explain } : null
    }
    case 'fill': {
      const q = str(r.q, 300).replace(BLANK_RE, '____')
      const answers = list(r.answers, 3, 40)
      if (!q.includes('____') || q.split('____').length !== 2 || answers.length === 0) return null
      return { type: 'fill', ask, q, answers, hint: str(r.hint, 120) || undefined, explain }
    }
    case 'order': {
      const words = list(r.words, 12, 25)
      if (words.length < 3 || words.length > 12) return null
      return { type: 'order', ask, q: str(r.q, 200) || undefined, words, explain }
    }
    default:
      return null
  }
}

export interface GeneratedExercises {
  title: string
  summary: string
  exercises: Exercise[]
}

export async function generateExercises(r: ExerciseRequest, env: Env, fetchImpl?: Fetch) {
  const { value, model } = await generateJson<GeneratedExercises>({
    prompt: buildExercisePrompt(r),
    images: r.images,
    schema: EXERCISE_SCHEMA,
    env,
    fetchImpl,
    temperature: 0.5,
    timeoutMs: 45_000,
    validate: (raw) => {
      const d = (raw ?? {}) as Record<string, unknown>
      const exercises = (Array.isArray(d.exercises) ? d.exercises : []).map(validateExercise).filter((e): e is Exercise => !!e)
      return {
        title: cleanText(d.title, 80) || 'واجب الدرس',
        summary: cleanText(d.summary, 400),
        exercises: exercises.slice(0, r.count),
      }
    },
  })
  return { ...value, model }
}

export function handleExercises(body: unknown, env: Env, fetchImpl?: Fetch) {
  return respond('exercises', () => generateExercises(parseExerciseRequest(body), env, fetchImpl))
}
