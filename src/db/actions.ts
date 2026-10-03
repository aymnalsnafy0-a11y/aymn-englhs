import { toDayKey } from '../lib/dates'
import { reconcilePlan, type ProgressStatus } from '../lib/plan'
import { review, startLearning, type Rating } from '../lib/srs'
import type { Level } from '../lib/types'
import { db, DEFAULT_SETTINGS, type Settings } from './db'

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch })
  // تغيير المستوى أو العدد اليومي ينعكس على خطة اليوم دون فقدان ما أُنجز.
  if (patch.startLevel !== undefined || patch.dailyCount !== undefined) {
    const plan = await db.plans.get(toDayKey())
    if (plan) await syncTodayPlan(patch.dailyCount ?? plan.targetCount)
  }
}

async function progressMap(): Promise<Map<string, ProgressStatus>> {
  const rows = await db.progress.toArray()
  return new Map(rows.map((r) => [r.wordId, r.status]))
}

/** ينشئ خطة اليوم أو يحدّثها. targetCount يتجاوز العدد اليومي في الإعدادات لهذا اليوم فقط. */
export async function syncTodayPlan(targetCount?: number) {
  const settings = await getSettings()
  if (!settings.startLevel) return undefined
  const today = toDayKey()
  return db.transaction('rw', db.plans, db.words, db.progress, async () => {
    const existing = await db.plans.get(today)
    const target = targetCount ?? existing?.targetCount ?? settings.dailyCount
    const words = await db.words.orderBy('order').toArray()
    const plan = reconcilePlan(existing, words, await progressMap(), settings.startLevel!, target, today)
    await db.plans.put(plan)
    return plan
  })
}

/** أنهى المتعلم بطاقة الكلمة: تدخل جدول المراجعة. */
export async function completeWord(wordId: string): Promise<void> {
  const today = toDayKey()
  await db.transaction('rw', db.progress, db.plans, async () => {
    const existing = await db.progress.get(wordId)
    if (!existing) {
      await db.progress.put({
        wordId,
        status: 'learning',
        srs: startLearning(today),
        learnedAt: today,
        updatedAt: Date.now(),
      })
    }
    const plan = await db.plans.get(today)
    if (plan && !plan.doneIds.includes(wordId)) {
      await db.plans.put({ ...plan, doneIds: [...plan.doneIds, wordId] })
    }
  })
}

/** «أعرفها»: تُحتسب معروفة وتخرج من الخطة، وتحل محلها الكلمة التالية. */
export async function markKnown(wordId: string): Promise<void> {
  await db.progress.put({ wordId, status: 'known', updatedAt: Date.now() })
  await syncTodayPlan()
}

/** يسجّل نتيجة مراجعة ويعيد true إذا يجب إعادتها في نفس الجلسة. */
export async function recordReview(wordId: string, rating: Rating): Promise<boolean> {
  const row = await db.progress.get(wordId)
  if (!row?.srs) return false
  const { state, repeatInSession } = review(row.srs, rating, toDayKey())
  await db.progress.put({
    ...row,
    srs: state,
    status: state.mastered ? 'mastered' : 'learning',
    updatedAt: Date.now(),
  })
  return repeatInSession
}

export async function chooseStartLevel(level: Level): Promise<void> {
  await updateSettings({ startLevel: level })
}
