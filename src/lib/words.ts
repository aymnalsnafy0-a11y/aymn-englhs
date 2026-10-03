import { resolveTopic, topicOrder, topicRank } from './topics'
import { levelIndex, wordId, type RawWord, type Word } from './types'

/**
 * يرتّب الكلمات: المستوى أولًا (صارم)، ثم مجموعة الموضوع، ثم أهميتها داخل الموضوع، ثم ترتيب الملف.
 * لا ترتيب أبجدي داخل المستوى. عند التكرار (نفس الكلمة ونفس النوع) يبقى المستوى الأدنى.
 */
function compareRank(a: number, b: number): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

export function buildWordList(raw: RawWord[]): Word[] {
  // أدنى مستوى لكل كلمة: القاموس الموضوعي يخص معناها الأساسي فقط. المعاني اللاحقة
  // (water فعلًا في B1، house فعلًا في B2) تُجمَّع حسب نوع الكلمة ولا تتقدم كأنها أساسية.
  const firstLevel = new Map<string, number>()
  for (const r of raw) {
    const key = r.word.toLowerCase()
    firstLevel.set(key, Math.min(firstLevel.get(key) ?? Infinity, levelIndex(r.level)))
  }
  const isFirstSense = (w: { word: string; level: RawWord['level'] }) =>
    firstLevel.get(w.word.toLowerCase()) === levelIndex(w.level)

  const byId = new Map<string, Omit<Word, 'order'> & { fileIndex: number }>()
  raw.forEach((r, fileIndex) => {
    const id = wordId(r.word, r.pos)
    const existing = byId.get(id)
    if (existing && levelIndex(existing.level) <= levelIndex(r.level)) return
    const topic = isFirstSense(r) ? resolveTopic(r.word, r.pos, r.topic) : resolveTopic('', r.pos, r.topic)
    byId.set(id, { id, word: r.word, level: r.level, pos: r.pos, topic, fileIndex })
  })
  const items = [...byId.values()]

  const rank = (w: (typeof items)[number]) => (isFirstSense(w) ? topicRank(w.word, w.topic) : Infinity)
  items.sort(
    (a, b) =>
      levelIndex(a.level) - levelIndex(b.level) ||
      topicOrder(a.topic) - topicOrder(b.topic) ||
      compareRank(rank(a), rank(b)) ||
      a.fileIndex - b.fileIndex,
  )

  return items.map(({ fileIndex: _fileIndex, ...w }, order) => ({ ...w, order }))
}
