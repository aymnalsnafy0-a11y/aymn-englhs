/**
 * منطق إضافة المتصفح (المرحلة 5) — مشترك بين التطبيق والإضافة، بلا DOM:
 * لقطة المتعلم، مطابقة الكلمات الإنجليزية مع تصريفاتها، نسبة فهم الصفحة،
 * ومطابقة الكلمات العربية لاستبدالها بالإنجليزية في المواقع العربية.
 */
import { isKnown, type ProgressStatus } from './plan.js'
import type { Level, Word } from './types.js'

/** k = معروفة، m = محفوظة، l = قيد التعلّم، n = لم تُدرس بعد. */
export type SnapStatus = 'k' | 'm' | 'l' | 'n'

export interface SnapshotWord {
  w: string
  s: SnapStatus
  lv: Level
  ar?: string
}

export interface Snapshot {
  v: 1
  updatedAt: number
  level: Level
  words: SnapshotWord[]
}

export function buildSnapshot(
  words: Word[],
  progress: Map<string, ProgressStatus>,
  startLevel: Level,
  meaningOf: (id: string) => string | undefined,
  now = Date.now(),
): Snapshot {
  const out: SnapshotWord[] = words.map((w) => {
    const status = progress.get(w.id)
    const s: SnapStatus =
      status === 'mastered' ? 'm' : status === 'learning' ? 'l' : isKnown(w, startLevel, status) ? 'k' : 'n'
    const ar = s === 'n' ? undefined : meaningOf(w.id)
    return { w: w.word, s, lv: w.level, ...(ar ? { ar } : {}) }
  })
  return { v: 1, updatedAt: now, level: startLevel, words: out }
}

export function isSnapshot(value: unknown): value is Snapshot {
  const s = value as Snapshot
  return !!s && s.v === 1 && Array.isArray(s.words) && typeof s.updatedAt === 'number'
}

// ——— الإنجليزية ———

const RANK: Record<SnapStatus, number> = { l: 3, m: 2, k: 1, n: 0 }

export interface Lexicon {
  byForm: Map<string, SnapshotWord>
}

/** عند تكرار الكلمة بأنواع مختلفة نأخذ الحالة الأهم: قيد التعلّم ثم المحفوظة ثم المعروفة. */
export function buildLexicon(snapshot: Snapshot): Lexicon {
  const byForm = new Map<string, SnapshotWord>()
  for (const w of snapshot.words) {
    const key = w.w.toLowerCase()
    const prev = byForm.get(key)
    if (!prev || RANK[w.s] > RANK[prev.s] || (RANK[w.s] === RANK[prev.s] && !prev.ar && w.ar)) byForm.set(key, w)
  }
  return { byForm }
}

const VOWEL = /[aeiou]/

/** صيغ أساسية محتملة لكلمة مصرّفة (بدون قاموس صرفي كامل). */
export function deinflect(token: string): string[] {
  const t = token.toLowerCase().replace(/[’']s$/, '').replace(/’/g, "'")
  const out = [t]
  const add = (s: string) => s.length >= 2 && !out.includes(s) && out.push(s)
  if (t.endsWith('ies') && t.length > 4) add(t.slice(0, -3) + 'y')
  if (t.endsWith('es')) add(t.slice(0, -2))
  if (t.endsWith('s') && !t.endsWith('ss')) add(t.slice(0, -1))
  if (t.endsWith('ied')) add(t.slice(0, -3) + 'y')
  if (t.endsWith('ed')) {
    const stem = t.slice(0, -2)
    add(stem)
    add(stem + 'e')
    if (/(.)\1$/.test(stem)) add(stem.slice(0, -1))
  }
  if (t.endsWith('ing') && t.length > 5) {
    const stem = t.slice(0, -3)
    add(stem)
    add(stem + 'e')
    if (/(.)\1$/.test(stem)) add(stem.slice(0, -1))
  }
  if (t.endsWith('ly') && t.length > 4) {
    add(t.slice(0, -2))
    if (t.endsWith('ily')) add(t.slice(0, -3) + 'y')
  }
  for (const suf of ['er', 'est']) {
    if (t.endsWith(suf) && t.length > suf.length + 2) {
      const stem = t.slice(0, -suf.length)
      add(stem)
      add(stem + 'e')
      if (/(.)\1$/.test(stem)) add(stem.slice(0, -1))
      if (stem.endsWith('i')) add(stem.slice(0, -1) + 'y')
    }
  }
  return out.filter((s) => VOWEL.test(s) || s.length <= 3)
}

export function lookup(lex: Lexicon, token: string): SnapshotWord | undefined {
  for (const form of deinflect(token)) {
    const hit = lex.byForm.get(form)
    if (hit) return hit
  }
  return undefined
}

export interface PageStats {
  /** كلمات إنجليزية محسوبة (بدون الأرقام وأسماء العلم غير المعروفة). */
  total: number
  known: number
  learning: number
  unknown: number
  /** نسبة الكلمات التي يفهمها المتعلم (معروفة أو محفوظة أو قيد التعلّم)، 0–100. */
  coverage: number
}

export interface TokenInfo {
  text: string
  /** هل الكلمة في بداية جملة؟ (الحرف الكبير لا يعني اسم علم هنا) */
  sentenceStart: boolean
}

export function analyzeTokens(tokens: TokenInfo[], lex: Lexicon): PageStats {
  let known = 0
  let learning = 0
  let unknown = 0
  for (const tok of tokens) {
    if (!/^[A-Za-z][A-Za-z'’-]*$/.test(tok.text)) continue
    const hit = lookup(lex, tok.text)
    if (!hit) {
      // كلمة بحرف كبير خارج القائمة في وسط الجملة = غالبًا اسم علم، لا تُحسب.
      if (/^[A-Z]/.test(tok.text) && !tok.sentenceStart) continue
      unknown++
    } else if (hit.s === 'l') learning++
    else if (hit.s === 'n') unknown++
    else known++
  }
  const total = known + learning + unknown
  return { total, known, learning, unknown, coverage: total ? Math.round(((known + learning) / total) * 100) : 0 }
}

// ——— العربية ———

const TASHKEEL = /[ً-ٰٟـ]/g

/** توحيد الحروف لمطابقة أكثر تسامحًا: بلا تشكيل، أ/إ/آ ← ا، ى ← ي، ة ← ه. */
export function normalizeArabic(s: string): string {
  return s.replace(TASHKEEL, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
}

export interface ArabicEntry {
  /** الصيغة العربية بعد التوحيد. */
  key: string
  en: string
}

/** معاني كلمات المتعلم (قيد التعلّم والمحفوظة) مقسّمة إلى بدائل: «بيت، منزل» ← بيت | منزل. */
export function arabicEntries(snapshot: Snapshot): ArabicEntry[] {
  const seen = new Set<string>()
  const out: ArabicEntry[] = []
  for (const w of snapshot.words) {
    if ((w.s !== 'l' && w.s !== 'm') || !w.ar) continue
    for (const part of w.ar.split(/[،,؛;/]/)) {
      const key = normalizeArabic(part.replace(/\(.*?\)/g, '').trim())
      // نتجنب الحروف المفردة والعبارات الطويلة (الكلمات من حرفين لها شروط خاصة عند المطابقة).
      if (key.length < 2 || key.split(/\s+/).length > 2 || seen.has(key)) continue
      seen.add(key)
      out.push({ key, en: w.w })
    }
  }
  return out.sort((a, b) => b.key.length - a.key.length)
}

export interface ArabicMatch {
  start: number
  end: number
  en: string
}

const IS_TASHKEEL = /^[\u064B-\u065F\u0670\u0640]$/
const AL_PREFIXES = ['ولل', 'فلل', 'وال', 'بال', 'فال', 'كال', 'لل', 'ال']
const PREFIXES = [...AL_PREFIXES, 'و', 'ب', 'ل', 'ف', 'ك', '']
/** ضمائر متصلة شائعة: أختي، بيته، رحلتنا… (التاء المربوطة قبلها تصبح تاءً: رحلة ← رحلتي). */
const SUFFIXES = ['', 'ي', 'ه', 'ها', 'هم', 'هما', 'نا', 'ك', 'كم']

/**
 * هل الصيغة candidate = سابقة + key + لاحقة؟ الكلمات من حرفين (أم، أب، أخ) تحتاج «ال» أو ضميرًا
 * متصلًا حتى لا نطابق «أم» العاطفة مثلًا.
 */
function splitAffixes(candidate: string, byKey: Map<string, string>): { en: string; keep: number } | undefined {
  for (const p of PREFIXES) {
    if (!candidate.startsWith(p)) continue
    const rest = candidate.slice(p.length)
    for (const suf of SUFFIXES) {
      if (!rest.endsWith(suf)) continue
      let stem = rest.slice(0, rest.length - suf.length)
      // رحلتي ← رحلت + ي ← رحله
      if (suf && stem.endsWith('ت')) stem = byKey.has(stem) ? stem : stem.slice(0, -1) + 'ه'
      const en = byKey.get(stem)
      if (!en) continue
      if (stem.length === 2 && !suf && !AL_PREFIXES.includes(p)) continue
      // نُبقي حروف العطف والجر بالعربية (و، ب، ل…) ونحذف «ال» فقط: والأب ← و father.
      const keep = p.endsWith('لل') ? p.length - 1 : p.replace(/ال$/, '').length
      return { en, keep }
    }
  }
  return undefined
}

/**
 * يبحث عن معاني كلمات المتعلم في نص عربي (مع السوابق الشائعة: ال، و، ب، ل…).
 * يعيد مواضع الكلمة كاملة (مع سابقتها) في النص الأصلي.
 */
export function findArabicMatches(text: string, entries: ArabicEntry[], limit = 50): ArabicMatch[] {
  if (entries.length === 0) return []
  // توحيد مع خريطة مواضع للنص الأصلي.
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    if (IS_TASHKEEL.test(text[i])) continue
    norm += normalizeArabic(text[i])
    map.push(i)
  }
  const byKey = new Map(entries.map((e) => [e.key, e.en]))
  const hitFor = (candidate: string) => splitAffixes(candidate, byKey)
  const words = [...norm.matchAll(/[\u0621-\u064A\u066E-\u06D3]+/g)]
  const matches: ArabicMatch[] = []

  for (let i = 0; i < words.length && matches.length < limit; i++) {
    const cur = words[i]
    const next = words[i + 1]
    // عبارة من كلمتين متجاورتين أولًا (مثل «في الخارج»)، ثم الكلمة وحدها.
    const pair = next && norm.slice(cur.index! + cur[0].length, next.index) === ' ' ? `${cur[0]} ${next[0]}` : null
    const tries: [string, number][] = pair ? [[pair, 2], [cur[0], 1]] : [[cur[0], 1]]
    for (const [candidate, span] of tries) {
      const hit = hitFor(candidate)
      if (!hit) continue
      const { en, keep } = hit
      const last = words[i + span - 1]
      const start = map[cur.index! + keep]
      let end = map[last.index! + last[0].length - 1] + 1
      while (end < text.length && IS_TASHKEEL.test(text[end])) end++
      matches.push({ start, end, en })
      i += span - 1
      break
    }
  }
  return matches
}
