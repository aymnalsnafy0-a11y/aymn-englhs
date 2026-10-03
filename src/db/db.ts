import Dexie, { type EntityTable } from 'dexie'
import type { DayKey } from '../lib/dates'
import type { DayPlan, ProgressStatus } from '../lib/plan'
import type { SrsState } from '../lib/srs'
import type { StoryKind, StorySentence } from '../lib/storyText'
import type { WordContent } from '../data/sampleContent'
import type { Level, Word } from '../lib/types'

export interface ProgressRow {
  wordId: string
  status: ProgressStatus
  /** موجودة فقط للكلمات التي تعلّمها المتعلم عبر البطاقة. */
  srs?: SrsState
  learnedAt?: DayKey
  updatedAt: number
}

export type { DayPlan }

export type Theme = 'system' | 'light' | 'dark'
export type StoryMode = 'serial' | 'standalone'

export interface Settings {
  id: 'main'
  startLevel: Level | null
  dailyCount: number
  /** هل أكّد المتعلم عدد الكلمات اليومي في الإعداد الأولي؟ */
  onboarded: boolean
  theme: Theme
  storyMode: StoryMode
}

export type QuizKind = 'daily' | 'weekly' | 'level' | 'mistakes'

/** دفتر الأخطاء: كلمة أخطأ فيها المتعلم في اختبار أو نسيها في مراجعة. */
export interface MistakeRow {
  wordId: string
  count: number
  firstAt: DayKey
  lastAt: DayKey
  source: QuizKind | 'review'
  /** يوم تصحيحها؛ غياب القيمة يعني أنها ما زالت في الدفتر. */
  resolvedAt?: DayKey
}

export interface QuizRow {
  id?: number
  kind: QuizKind
  date: DayKey
  level?: Level
  total: number
  correct: number
  wrongIds: string[]
}

/** نشاط يومي لحساب سلسلة الأيام المتتالية. */
export interface ActivityRow {
  date: DayKey
  cards: number
  reviews: number
  quizzes: number
  stories?: number
}

export interface StoryQuestion {
  question: string
  options: string[]
  answer: number
}

/** قصة يوم محفوظة — تُولَّد مرة واحدة وتبقى في المكتبة. */
export interface StoryRow {
  id?: number
  date: DayKey
  episode: number
  mode: StoryMode
  kind: StoryKind
  level: Level
  title: string
  titleAr: string
  sentences: StorySentence[]
  questions: StoryQuestion[]
  summary: string
  wordIds: string[]
  reviewWordIds: string[]
  /** كلمات لم يستخدمها النموذج رغم الطلب. */
  missing: string[]
  /** إجابات أسئلة الفهم (فهرس الخيار لكل سؤال). */
  answers?: number[]
}

/** محتوى كلمة مولَّد بالذكاء الاصطناعي — يُخزَّن مرة واحدة ولا يُعاد توليده. */
export interface ContentRow {
  wordId: string
  content: WordContent
  model: string
  createdAt: number
}

/** مجموعة الموضوع لكل كلمة (من التصنيف بالذكاء الاصطناعي) لترتيب الكلمات داخل المستوى. */
export interface TopicRow {
  wordId: string
  topic: string
}

export interface MetaRow {
  key: string
  value: unknown
}

export const db = new Dexie('siyaq') as Dexie & {
  words: EntityTable<Word, 'id'>
  progress: EntityTable<ProgressRow, 'wordId'>
  settings: EntityTable<Settings, 'id'>
  plans: EntityTable<DayPlan, 'date'>
  meta: EntityTable<MetaRow, 'key'>
  mistakes: EntityTable<MistakeRow, 'wordId'>
  quizzes: EntityTable<QuizRow, 'id'>
  activity: EntityTable<ActivityRow, 'date'>
  stories: EntityTable<StoryRow, 'id'>
  content: EntityTable<ContentRow, 'wordId'>
  topics: EntityTable<TopicRow, 'wordId'>
}

db.version(1).stores({
  words: 'id, order, level',
  progress: 'wordId, status, srs.due',
  settings: 'id',
  plans: 'date',
  meta: 'key',
})

db.version(2).stores({
  mistakes: 'wordId, lastAt',
  quizzes: '++id, kind, date',
  activity: 'date',
})

db.version(3).stores({
  stories: '++id, date, mode',
})

db.version(4).stores({
  content: 'wordId',
  topics: 'wordId',
})

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  startLevel: null,
  dailyCount: 10,
  onboarded: false,
  theme: 'system',
  storyMode: 'serial',
}
