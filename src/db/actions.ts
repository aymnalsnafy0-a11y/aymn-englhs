import { diffDays, toDayKey, type DayKey } from '../lib/dates'
import { reconcilePlan, type ProgressStatus } from '../lib/plan'
import type { QuizScore } from '../lib/quiz'
import { relapse, review, startLearning, type Rating } from '../lib/srs'
import type { Level } from '../lib/types'
import { postAi } from '../data/ai'
import { contentFor } from '../data/content'
import { shuffle } from '../lib/quiz'
import { storyKindFor } from '../lib/storyText'
import { db, DEFAULT_SETTINGS, type ActivityRow, type MistakeRow, type QuizKind, type Settings, type StoryRow } from './db'

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
  return db.transaction('rw', [db.plans, db.words, db.progress, db.saved], async () => {
    const existing = await db.plans.get(today)
    const target = targetCount ?? existing?.targetCount ?? settings.dailyCount
    const words = await db.words.orderBy('order').toArray()
    const saved = (await db.saved.orderBy('savedAt').toArray()).map((s) => s.wordId)
    const plan = reconcilePlan(existing, words, await progressMap(), settings.startLevel!, target, today, saved)
    await db.plans.put(plan)
    return plan
  })
}

async function bumpActivity(field: keyof Omit<ActivityRow, 'date'>): Promise<void> {
  const date = toDayKey()
  const row = (await db.activity.get(date)) ?? { date, cards: 0, reviews: 0, quizzes: 0 }
  await db.activity.put({ ...row, [field]: (row[field] ?? 0) + 1 })
}

async function addMistake(wordId: string, source: MistakeRow['source'], today: DayKey): Promise<void> {
  const row = await db.mistakes.get(wordId)
  const active = row && !row.resolvedAt
  await db.mistakes.put({
    wordId,
    count: (active ? row.count : 0) + 1,
    firstAt: active ? row.firstAt : today,
    lastAt: today,
    source,
  })
}

/**
 * تصحيح كلمة من الدفتر. لا تخرج في نفس يوم الخطأ (حتى تظهر أولًا في اليوم التالي)،
 * إلا عند التدرّب على الدفتر نفسه.
 */
async function resolveMistake(wordId: string, today: DayKey, force = false): Promise<void> {
  const row = await db.mistakes.get(wordId)
  if (!row || row.resolvedAt) return
  if (force || diffDays(row.lastAt, today) >= 1) await db.mistakes.put({ ...row, resolvedAt: today })
}

/** أنهى المتعلم بطاقة الكلمة: تدخل جدول المراجعة. */
export async function completeWord(wordId: string): Promise<void> {
  const today = toDayKey()
  await db.transaction('rw', [db.progress, db.plans, db.activity], async () => {
    await bumpActivity('cards')
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
  const today = toDayKey()
  return db.transaction('rw', [db.progress, db.mistakes, db.activity], async () => {
    const row = await db.progress.get(wordId)
    if (!row?.srs) return false
    const { state, repeatInSession } = review(row.srs, rating, today)
    await db.progress.put({
      ...row,
      srs: state,
      status: state.mastered ? 'mastered' : 'learning',
      updatedAt: Date.now(),
    })
    if (rating === 'forgot') await addMistake(wordId, 'review', today)
    else await resolveMistake(wordId, today)
    await bumpActivity('reviews')
    return repeatInSession
  })
}

/**
 * يحفظ نتيجة اختبار. الكلمات الخاطئة تدخل دفتر الأخطاء وتعود لبداية المراجعة
 * (مستحقة غدًا، فتظهر أولًا في اليوم التالي). الصحيحة تُصحَّح في الدفتر.
 */
export async function saveQuizResult(kind: QuizKind, result: QuizScore, correctIds: string[], level?: Level) {
  const today = toDayKey()
  await db.transaction('rw', [db.quizzes, db.mistakes, db.progress, db.plans, db.activity], async () => {
    await db.quizzes.add({ kind, date: today, total: result.total, correct: result.correct, wrongIds: result.wrongIds, level })
    for (const wordId of result.wrongIds) {
      await addMistake(wordId, kind, today)
      const row = await db.progress.get(wordId)
      await db.progress.put({
        wordId,
        status: 'learning',
        srs: relapse(row?.srs, today),
        learnedAt: row?.learnedAt ?? today,
        updatedAt: Date.now(),
      })
    }
    for (const wordId of correctIds) await resolveMistake(wordId, today, kind === 'mistakes')
    if (kind === 'daily') {
      const plan = await db.plans.get(today)
      if (plan) await db.plans.put({ ...plan, quiz: { total: result.total, correct: result.correct } })
    }
    await bumpActivity('quizzes')
  })
}

export async function chooseStartLevel(level: Level): Promise<void> {
  await updateSettings({ startLevel: level })
}

// ——— قصة اليوم ———

export const REVIEW_WORDS_IN_STORY = 5

/** خطأ برمز يُترجم في الواجهة (not_configured, unavailable, network, no_words…). */
export class StoryRequestError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

/**
 * يولّد قصة اليوم من الكلمات التي أنهاها المتعلم اليوم وبعض كلمات المراجعة.
 * القصة تُخزَّن ولا يُعاد توليدها؛ استدعاء ثانٍ في نفس اليوم يعيد المحفوظة.
 */
export async function requestTodayStory(): Promise<StoryRow> {
  const today = toDayKey()
  const existing = await db.stories.where('date').equals(today).first()
  if (existing) return existing

  const settings = await getSettings()
  const plan = await db.plans.get(today)
  if (!settings.startLevel || !plan || plan.doneIds.length === 0) throw new StoryRequestError('no_words')

  const words = (await db.words.bulkGet(plan.doneIds)).filter((w) => !!w)
  const learned = await db.progress.where('status').equals('learning').toArray()
  const reviewIds = shuffle(
    learned.filter((p) => p.learnedAt && p.learnedAt < today).map((p) => p.wordId),
    Math.random,
  ).slice(0, REVIEW_WORDS_IN_STORY)
  const reviewWords = (await db.words.bulkGet(reviewIds)).filter((w) => !!w)
  const serial = (await db.stories.where('mode').equals('serial').sortBy('id'))
  const mode = settings.storyMode
  const kind = storyKindFor(settings.startLevel)
  const toPayload = (w: { id: string; word: string; pos: string }) => ({
    word: w.word,
    pos: w.pos,
    meaningAr: contentFor(w.id)?.meaningAr,
  })

  const response = await postAi('story', {
    kind,
    level: settings.startLevel,
    mode,
    episode: mode === 'serial' ? serial.length + 1 : 1,
    words: words.map(toPayload),
    reviewWords: reviewWords.map(toPayload),
    previous: mode === 'serial' ? serial.slice(-3).map((s) => s.summary) : [],
  })
  const data = response.json
  if (!response.ok || !data?.story) throw new StoryRequestError(data?.error ?? 'network')

  const story: StoryRow = {
    date: today,
    episode: mode === 'serial' ? serial.length + 1 : 1,
    mode,
    kind,
    level: settings.startLevel,
    title: data.story.title,
    titleAr: data.story.titleAr,
    sentences: data.story.sentences,
    questions: data.story.questions,
    summary: data.story.summary,
    wordIds: words.map((w) => w.id),
    reviewWordIds: reviewWords.map((w) => w.id),
    missing: data.missing ?? [],
  }
  // إن ولّد تبويب آخر قصة اليوم في نفس الوقت نحتفظ بالأولى.
  return db.transaction('rw', db.stories, async () => {
    const raced = await db.stories.where('date').equals(today).first()
    if (raced) return raced
    const id = await db.stories.add(story)
    return { ...story, id }
  })
}

export async function saveStoryAnswers(id: number, answers: number[]): Promise<void> {
  await db.transaction('rw', db.stories, db.activity, async () => {
    await db.stories.update(id, { answers })
    await bumpActivity('stories')
  })
}
