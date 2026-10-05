/**
 * يعمل في كل المواقع (عدا تطبيق سنافي AE):
 * - المواقع الإنجليزية: يظلل كلمات المتعلم (قيد التعلّم بلون، المحفوظة بخط) مع المعنى عند التمرير،
 *   ويحسب نسبة فهم الصفحة.
 * - المواقع العربية: يستبدل معاني كلمات المتعلم بكلماتها الإنجليزية (الأصل يظهر عند التمرير).
 */
import {
  analyzeTokens,
  arabicEntries,
  buildLexicon,
  findArabicMatches,
  lookup,
  type ArabicEntry,
  type Lexicon,
  type PageStats,
  type Snapshot,
  type TokenInfo,
} from '../../src/lib/browse'
import { getOptions, getSnapshot, type Options } from './storage'

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE', 'SVG', 'MATH', 'IFRAME', 'CANVAS'])
const MARK = 'data-siyaq'
const MAX_NODES = 4000
const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g

type Lang = 'en' | 'ar' | 'other'

let lex: Lexicon | null = null
let entries: ArabicEntry[] = []
let options: Options
let lang: Lang = 'other'
let stats: PageStats & { highlighted: number; replaced: number } = emptyStats()

function emptyStats() {
  return { total: 0, known: 0, learning: 0, unknown: 0, coverage: 0, highlighted: 0, replaced: 0 }
}

function detectLang(): Lang {
  const declared = document.documentElement.lang.toLowerCase()
  if (declared.startsWith('ar')) return 'ar'
  const sample = (document.body?.innerText ?? '').slice(0, 5000)
  const arabic = (sample.match(/[؀-ۿ]/g) ?? []).length
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length
  if (arabic > latin * 0.5 && arabic > 50) return 'ar'
  if (declared.startsWith('en') || latin > 200) return 'en'
  return 'other'
}

function acceptNode(node: Node): number {
  const parent = node.parentElement
  if (!parent || SKIP.has(parent.tagName) || parent.closest(`[${MARK}], [contenteditable=""], [contenteditable="true"], [aria-hidden="true"]`)) {
    return NodeFilter.FILTER_REJECT
  }
  return node.nodeValue && node.nodeValue.trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
}

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode })
  const out: Text[] = []
  while (out.length < MAX_NODES && walker.nextNode()) out.push(walker.currentNode as Text)
  return out
}

function processEnglish(node: Text, tokens: TokenInfo[]) {
  const text = node.nodeValue!
  const parts: (string | HTMLElement)[] = []
  let last = 0
  let changed = false
  for (const m of text.matchAll(WORD_RE)) {
    const before = text.slice(0, m.index).trimEnd()
    tokens.push({ text: m[0], sentenceStart: before === '' || /[.!?]["”')\]]*$/.test(before) })
    if (!options.highlight) continue
    const hit = lookup(lex!, m[0])
    if (!hit || (hit.s !== 'l' && hit.s !== 'm')) continue
    if (m.index! > last) parts.push(text.slice(last, m.index))
    const span = document.createElement('span')
    span.setAttribute(MARK, hit.s === 'l' ? 'learning' : 'mastered')
    span.className = hit.s === 'l' ? 'siyaq-learning' : 'siyaq-mastered'
    span.textContent = m[0]
    span.title = `${hit.w}${hit.ar ? ` — ${hit.ar}` : ''} · سنافي AE`
    parts.push(span)
    last = m.index! + m[0].length
    changed = true
    stats.highlighted++
  }
  if (!changed) return
  if (last < text.length) parts.push(text.slice(last))
  node.replaceWith(...parts)
}

function processArabic(node: Text) {
  const text = node.nodeValue!
  const matches = findArabicMatches(text, entries, 20)
  if (matches.length === 0) return
  const parts: (string | HTMLElement)[] = []
  let last = 0
  for (const m of matches) {
    if (m.start > last) parts.push(text.slice(last, m.start))
    const span = document.createElement('span')
    span.setAttribute(MARK, 'replaced')
    span.className = 'siyaq-replaced'
    span.dir = 'ltr'
    span.lang = 'en'
    span.textContent = m.en
    span.title = `${text.slice(m.start, m.end)} · سنافي AE`
    span.dataset.original = text.slice(m.start, m.end)
    parts.push(span)
    last = m.end
    stats.replaced++
  }
  if (last < text.length) parts.push(text.slice(last))
  node.replaceWith(...parts)
}

function processRoot(root: Node) {
  if (!lex) return
  const nodes = textNodes(root)
  if (lang === 'en') {
    const tokens: TokenInfo[] = []
    for (const n of nodes) processEnglish(n, tokens)
    const s = analyzeTokens(tokens, lex)
    // نجمع مع ما سبق (المحتوى الذي يُضاف لاحقًا للصفحة).
    stats.known += s.known
    stats.learning += s.learning
    stats.unknown += s.unknown
    stats.total = stats.known + stats.learning + stats.unknown
    stats.coverage = stats.total ? Math.round(((stats.known + stats.learning) / stats.total) * 100) : 0
  } else if (lang === 'ar' && options.replaceArabic) {
    for (const n of nodes) processArabic(n)
  }
}

/** يزيل كل تعديلات الإضافة ويعيد النص الأصلي. */
function restore() {
  for (const el of document.querySelectorAll<HTMLElement>(`[${MARK}]`)) {
    el.replaceWith(document.createTextNode(el.dataset.original ?? el.textContent ?? ''))
  }
  document.body?.normalize()
  stats = emptyStats()
}

let observer: MutationObserver | null = null
let pending: Node[] = []
let flushTimer: number | undefined

function observe() {
  observer?.disconnect()
  observer = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (!(n instanceof HTMLElement && n.hasAttribute(MARK))) pending.push(n)
    window.clearTimeout(flushTimer)
    flushTimer = window.setTimeout(() => {
      const batch = pending
      pending = []
      observer?.disconnect()
      for (const n of batch) if (n.isConnected) processRoot(n)
      observer?.observe(document.body, { childList: true, subtree: true })
    }, 500)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

async function start() {
  const snapshot: Snapshot | null = await getSnapshot()
  options = await getOptions()
  if (!snapshot || !document.body) return
  lex = buildLexicon(snapshot)
  entries = arabicEntries(snapshot)
  lang = detectLang()
  if (lang === 'other') return
  processRoot(document.body)
  observe()
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'siyaq-stats') reply({ lang, ...stats, ready: !!lex })
})

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.options && !changes.snapshot) return
  observer?.disconnect()
  restore()
  void start()
})

void start()
