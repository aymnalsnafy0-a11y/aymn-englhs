import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { toDayKey } from '../lib/dates'
import { summarize, type ProgressStatus } from '../lib/plan'
import { dueQueue } from '../lib/srs'
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

export function useStats() {
  const words = useWords()
  const progress = useProgress()
  const settings = useSettings()
  const map = useProgressMap(progress)
  return useMemo(() => {
    if (!words || !progress || !settings?.startLevel) return undefined
    const today = toDayKey()
    const due = dueQueue(
      progress.filter((p): p is ProgressRow & { srs: NonNullable<ProgressRow['srs']> } => !!p.srs),
      today,
    )
    return { ...summarize(words, map, settings.startLevel), due, words, settings }
  }, [words, progress, settings, map])
}
