/**
 * الفصول والواجبات — منطق نقي (بلا Firebase).
 * الرمز = معرّف الفصل في Firestore، والواجب يحمل كلماته مع شرحها جاهزًا
 * (فلا يحتاج الطالب مفتاح Gemini ولا قائمة أكسفورد).
 */
import { diffDays, type DayKey } from './dates.js'
import type { Exercise } from './exercises.js'
import type { Level } from './types.js'

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // بلا 0/O و1/I لتجنّب الالتباس
export const CODE_LENGTH = 6
export const MAX_ASSIGNMENT_WORDS = 30

/** رموز المعلمين أطول من رموز الفصول (تُعطى لشخص واحد وتُستخدم مرة واحدة). */
export const TEACHER_CODE_LENGTH = 8

export function generateCode(rng: () => number = Math.random, length = CODE_LENGTH): string {
  return Array.from({ length }, () => CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]).join('')
}

/** يقبل «abc-234» و«ABC 234»… ويعيد الرمز بصيغته، أو null إن لم يكن صالحًا. */
export function normalizeCode(input: string, length = CODE_LENGTH): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  return code.length === length && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null
}

export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2)
  return `${code.slice(0, half)}-${code.slice(half)}`
}

export interface AssignmentWord {
  word: string
  pos: string
  level: Level
  content: {
    meaningAr: string
    syllables: string
    examples: { en: string; ar: string }[]
    memory: { kind: 'link' | 'story' | 'family'; text: string }
    family?: { en: string; pos: string; ar: string }[]
  }
}

export interface Assignment {
  id: string
  title: string
  note?: string
  /** كلمات للحفظ (بطاقات + اختبار). قد تكون فارغة. */
  words: AssignmentWord[]
  /** تمارين الدرس (مولَّدة من ملاحظات أو صور الدرس، وراجعها المدرس). */
  exercises?: Exercise[]
  /** ملخص الدرس بالعربية (من التوليد). */
  summary?: string
  createdAt: number
  dueAt?: DayKey
}

export interface Member {
  uid: string
  name: string
  joinedAt?: number
  lastSeen?: number
  known?: number
  learning?: number
  streak?: number
}

export interface Result {
  uid: string
  name: string
  score: number
  total: number
  /** كلمات أخطأ فيها. */
  wrong: string[]
  /** أرقام تمارين الدرس التي أخطأ فيها. */
  wrongQ?: number[]
  completedAt: number
  attempts: number
  best: number
}

export type AssignmentState = 'todo' | 'overdue' | 'done' | 'late'

export function assignmentState(a: Pick<Assignment, 'dueAt'>, result: Pick<Result, 'completedAt'> | undefined, today: DayKey, dayOf: (ts: number) => DayKey): AssignmentState {
  if (result) return a.dueAt && diffDays(a.dueAt, dayOf(result.completedAt)) > 0 ? 'late' : 'done'
  return a.dueAt && diffDays(a.dueAt, today) > 0 ? 'overdue' : 'todo'
}

export interface StudentRow {
  uid: string
  name: string
  state: AssignmentState
  score?: number
  total?: number
  completedAt?: number
}

export interface AssignmentReport {
  done: number
  members: number
  /** متوسط النسبة لمن حلّ (0–100)، أو null. */
  average: number | null
  rows: StudentRow[]
  /** الكلمات الأكثر خطأ بين الطلاب. */
  missed: { word: string; count: number }[]
  /** تمارين الدرس الأكثر خطأ (رقم التمرين وعدد من أخطأ). */
  missedQuestions: { index: number; count: number }[]
}

export function assignmentReport(
  a: Assignment,
  members: Member[],
  results: Result[],
  today: DayKey,
  dayOf: (ts: number) => DayKey,
): AssignmentReport {
  const byUid = new Map(results.map((r) => [r.uid, r]))
  const rows: StudentRow[] = members.map((m) => {
    const r = byUid.get(m.uid)
    return {
      uid: m.uid,
      name: r?.name || m.name,
      state: assignmentState(a, r, today, dayOf),
      ...(r ? { score: r.score, total: r.total, completedAt: r.completedAt } : {}),
    }
  })
  // من حلّ ثم خرج من الفصل يبقى في التقرير.
  for (const r of results) {
    if (!members.some((m) => m.uid === r.uid)) {
      rows.push({ uid: r.uid, name: r.name, state: assignmentState(a, r, today, dayOf), score: r.score, total: r.total, completedAt: r.completedAt })
    }
  }
  const order: Record<AssignmentState, number> = { overdue: 0, todo: 1, late: 2, done: 3 }
  rows.sort((x, y) => order[x.state] - order[y.state] || x.name.localeCompare(y.name, 'ar'))
  const finished = rows.filter((r) => r.state === 'done' || r.state === 'late')
  const average = finished.length
    ? Math.round(finished.reduce((s, r) => s + (r.total ? (r.score! / r.total!) * 100 : 0), 0) / finished.length)
    : null
  const counts = new Map<string, number>()
  for (const r of results) for (const w of r.wrong) counts.set(w, (counts.get(w) ?? 0) + 1)
  const missed = [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((x, y) => y.count - x.count || x.word.localeCompare(y.word))
  const qCounts = new Map<number, number>()
  for (const r of results) for (const i of r.wrongQ ?? []) qCounts.set(i, (qCounts.get(i) ?? 0) + 1)
  const missedQuestions = [...qCounts.entries()]
    .map(([index, count]) => ({ index, count }))
    .sort((x, y) => y.count - x.count || x.index - y.index)
  return { done: finished.length, members: rows.length, average, rows, missed, missedQuestions }
}

/** نتيجة محاولة جديدة: نحفظ الأخيرة ونحتفظ بأفضل درجة وعدد المحاولات. */
export function nextResult(prev: Result | undefined, attempt: Omit<Result, 'attempts' | 'best'>): Result {
  return {
    ...attempt,
    attempts: (prev?.attempts ?? 0) + 1,
    best: Math.max(prev?.best ?? 0, attempt.score),
  }
}

export interface StudentHomework {
  done: number
  total: number
  average: number | null
  items: { id: string; title: string; state: AssignmentState; score?: number; total?: number }[]
}

// ملخص واجبات طالب واحد عبر كل واجبات الفصل (لتبويب «الطلاب»).
export function studentHomework(
  uid: string,
  assignments: Assignment[],
  results: Record<string, Result[]>,
  today: DayKey,
  dayOf: (ts: number) => DayKey,
): StudentHomework {
  const items = assignments.map((a) => {
    const r = results[a.id]?.find((x) => x.uid === uid)
    return { id: a.id, title: a.title, state: assignmentState(a, r, today, dayOf), ...(r ? { score: r.score, total: r.total } : {}) }
  })
  const finished = items.filter((i) => i.total !== undefined)
  const average = finished.length
    ? Math.round(finished.reduce((s, i) => s + (i.total ? (i.score! / i.total) * 100 : 0), 0) / finished.length)
    : null
  return { done: finished.length, total: items.length, average, items }
}
