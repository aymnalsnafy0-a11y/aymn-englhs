/** صيغ عربية بسيطة للأعداد والمدد. */
/** تمييز بسيط للعدد العربي: 1، 2، 3–10، 11+ */
function countOf(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

export function formatDuration(days: number): string {
  if (days <= 0) return '—'
  if (days < 14) return countOf(days, 'يوم واحد', 'يومان', 'أيام', 'يومًا')
  if (days < 60) return `حوالي ${countOf(Math.round(days / 7), 'أسبوع', 'أسبوعين', 'أسابيع', 'أسبوعًا')}`
  return `حوالي ${countOf(Math.round(days / 30), 'شهر', 'شهرين', 'أشهر', 'شهرًا')}`
}

export function formatMinutes(minutes: number): string {
  return countOf(minutes, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة')
}

const POS_AR: Record<string, string> = {
  noun: 'اسم',
  verb: 'فعل',
  adjective: 'صفة',
  adverb: 'ظرف',
  preposition: 'حرف جر',
  pronoun: 'ضمير',
  conjunction: 'حرف عطف',
  determiner: 'محدِّد',
  exclamation: 'تعجب',
  number: 'عدد',
  'modal verb': 'فعل مساعد',
  'auxiliary verb': 'فعل مساعد',
  article: 'أداة تعريف',
}

export function posLabel(pos: string): string {
  return pos
    .split(/\s*[,/]\s*/)
    .map((p) => POS_AR[p] ?? p)
    .join('، ')
}

export function formatWords(n: number): string {
  return countOf(n, 'كلمة واحدة', 'كلمتان', 'كلمات', 'كلمة')
}
