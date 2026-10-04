/** يجمع بيانات المتعلم من IndexedDB للمزامنة، ويطبّق النسخة المدموجة عليها. */
import { toDayKey, addDays } from '../lib/dates'
import type { CoreData, SyncProgress, SyncStory } from '../lib/sync'
import { db, type MistakeRow, type QuizRow, type Settings, type StoryRow } from './db'
import { loadWords } from './loader'

const PLAN_DAYS = 30

export async function collectCore(): Promise<CoreData> {
  const since = addDays(toDayKey(), -PLAN_DAYS)
  const [settings, plans, mistakes, quizzes, activity, saved] = await Promise.all([
    db.settings.get('main'),
    db.plans.where('date').aboveOrEqual(since).toArray(),
    db.mistakes.toArray(),
    db.quizzes.toArray(),
    db.activity.toArray(),
    db.saved.toArray(),
  ])
  return {
    settings: settings as CoreData['settings'],
    plans,
    mistakes,
    quizzes: quizzes.map(({ id: _id, ...q }) => q),
    activity,
    saved,
  }
}

export async function applyCore(data: CoreData): Promise<void> {
  await db.transaction('rw', [db.settings, db.plans, db.mistakes, db.quizzes, db.activity, db.saved], async () => {
    if (data.settings) await db.settings.put({ ...(data.settings as unknown as Settings), id: 'main' })
    await db.plans.bulkPut(data.plans)
    await db.mistakes.bulkPut(data.mistakes as MistakeRow[])
    // الاختبارات بلا معرّف ثابت محليًا: نستبدلها بالقائمة المدموجة.
    await db.quizzes.clear()
    await db.quizzes.bulkAdd(data.quizzes as QuizRow[])
    await db.activity.bulkPut(data.activity)
    await db.saved.bulkPut(data.saved)
  })
}

export async function collectProgress(): Promise<SyncProgress[]> {
  return db.progress.toArray()
}

export async function applyProgress(rows: SyncProgress[]): Promise<void> {
  await db.progress.bulkPut(rows)
}

export async function collectStories(): Promise<SyncStory[]> {
  return (await db.stories.toArray()).map(({ id: _id, ...s }) => s as unknown as SyncStory)
}

export async function applyStories(stories: SyncStory[]): Promise<void> {
  await db.transaction('rw', db.stories, async () => {
    const local = await db.stories.toArray()
    const byDate = new Map(local.map((s) => [s.date, s]))
    for (const s of stories as unknown as StoryRow[]) {
      const mine = byDate.get(s.date)
      if (!mine) await db.stories.add(s)
      else if (!mine.answers && s.answers) await db.stories.update(mine.id!, { answers: s.answers })
    }
  })
}

export interface WordListDoc {
  text: string
  name: string
  importedAt: number
}

export async function collectWordList(): Promise<WordListDoc | undefined> {
  return (await db.meta.get('customWordList'))?.value as WordListDoc | undefined
}

/** قائمة الحساب أحدث من المحلية (أو لا توجد محليًا): نستوردها ونعيد بناء الكلمات. */
export async function applyWordList(doc: WordListDoc): Promise<void> {
  await db.meta.put({ key: 'customWordList', value: doc })
  await loadWords()
}
