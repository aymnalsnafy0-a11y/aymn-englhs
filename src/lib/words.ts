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
  const byId = new Map<string, Omit<Word, 'order'> & { fileIndex: number }>()

  raw.forEach((r, fileIndex) => {
    const id = wordId(r.word, r.pos)
    const existing = byId.get(id)
    if (existing && levelIndex(existing.level) <= levelIndex(r.level)) return
    byId.set(id, { id, word: r.word, level: r.level, pos: r.pos, topic: resolveTopic(r.word, r.pos, r.topic), fileIndex })
  })
  const items = [...byId.values()]

  const rank = (w: (typeof items)[number]) => topicRank(w.word, w.topic)
  items.sort(
    (a, b) =>
      levelIndex(a.level) - levelIndex(b.level) ||
      topicOrder(a.topic) - topicOrder(b.topic) ||
      compareRank(rank(a), rank(b)) ||
      a.fileIndex - b.fileIndex,
  )

  return items.map(({ fileIndex: _fileIndex, ...w }, order) => ({ ...w, order }))
}
