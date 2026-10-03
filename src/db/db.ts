import Dexie, { type EntityTable } from 'dexie'
import type { DayKey } from '../lib/dates'
import type { DayPlan, ProgressStatus } from '../lib/plan'
import type { SrsState } from '../lib/srs'
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
}

db.version(1).stores({
  words: 'id, order, level',
  progress: 'wordId, status, srs.due',
  settings: 'id',
  plans: 'date',
  meta: 'key',
})

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  startLevel: null,
  dailyCount: 10,
  onboarded: false,
  theme: 'system',
  storyMode: 'serial',
}
