import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { toDayKey } from '../lib/dates'
import { summarize, type ProgressStatus } from '../lib/plan'
import { dueQueue } from '../lib/srs'
import { bestStreak, currentStreak } from '../lib/streak'
import type { Word } from '../lib/types'
import { db, DEFAULT_SETTINGS, type ProgressRow } from './db'
import type { LoadInfo } from './loader'

export function useSettings() {
  return useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS)
}

export function useWords(): Word[] | undefined {
  return useLiveQuery(() => db.words.orderBy('order').toArray())
}

export function useProgress(): ProgressRow[] | undefined {
  return useLiveQuery(() => db.progress.toArray())
}

export function useTodayPlan() {
  return useLiveQuery(() => db.plans.get(toDayKey()))
}

export function useLoadInfo(): LoadInfo | undefined {
  return useLiveQuery(async () => (await db.meta.get('loadInfo'))?.value as LoadInfo | undefined)
}

export function useProgressMap(progress: ProgressRow[] | undefined) {
  return useMemo(
    () => new Map<string, ProgressStatus>((progress ?? []).map((p) => [p.wordId, p.status])),
    [progress],
  )
}

/** كلمات دفتر الأخطاء التي لم تُصحَّح بعد، الأحدث أولًا. */
export function useActiveMistakes() {
  return useLiveQuery(async () =>
    (await db.mistakes.orderBy('lastAt').reverse().toArray()).filter((m) => !m.resolvedAt),
  )
}

export function useQuizzes() {
  return useLiveQuery(() => db.quizzes.orderBy('id').reverse().toArray())
}

export function useActivity() {
  return useLiveQuery(() => db.activity.toArray())
}

export function useStreak() {
  const activity = useActivity()
  return useMemo(() => {
    if (!activity) return undefined
    const days = activity.map((a) => a.date)
    return { current: currentStreak(days, toDayKey()), best: bestStreak(days), days: new Set(days) }
  }, [activity])
}

export function useStats() {
  const words = useWords()
  const progress = useProgress()
  const settings = useSettings()
  const mistakes = useActiveMistakes()
  const map = useProgressMap(progress)
  return useMemo(() => {
    if (!words || !progress || !mistakes || !settings?.startLevel) return undefined
    const today = toDayKey()
    const due = dueQueue(
      progress.filter((p): p is ProgressRow & { srs: NonNullable<ProgressRow['srs']> } => !!p.srs),
      today,
      new Set(mistakes.map((m) => m.wordId)),
    )
    return { ...summarize(words, map, settings.startLevel), due, words, settings, progress, progressMap: map, mistakes }
  }, [words, progress, settings, mistakes, map])
}

export function useSaved() {
  return useLiveQuery(() => db.saved.orderBy('savedAt').toArray())
}

export function useStories() {
  return useLiveQuery(() => db.stories.orderBy('id').reverse().toArray())
}

export function useStory(id: number | undefined) {
  return useLiveQuery(async () => (id === undefined ? null : ((await db.stories.get(id)) ?? null)), [id])
}

export function useTodayStory() {
  return useLiveQuery(async () => (await db.stories.where('date').equals(toDayKey()).first()) ?? null)
}

export function useGeminiKey() {
  return useLiveQuery(async () => {
    const row = await db.meta.get('geminiKey')
    return typeof row?.value === 'string' && row.value ? row.value : null
  })
}
