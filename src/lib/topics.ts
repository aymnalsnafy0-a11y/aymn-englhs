/**
 * مجموعات المواضيع داخل كل مستوى. الترتيب هنا هو ترتيب العرض.
 * القائمة الرسمية لا تحتوي مواضيع، لذلك نستخدم:
 * 1) عمود topic في الملف إن وُجد، 2) القاموس أدناه، 3) مجموعة احتياطية حسب نوع الكلمة.
 */
export interface Topic {
  id: string
  label: string
}

export const TOPICS: Topic[] = [
  { id: 'people', label: 'العائلة والناس' },
  { id: 'food', label: 'الطعام والشراب' },
  { id: 'home', label: 'البيت' },
  { id: 'travel', label: 'السفر والأماكن' },
  { id: 'time', label: 'الوقت واليوم' },
  { id: 'feelings', label: 'المشاعر' },
  { id: 'body', label: 'الجسم والصحة' },
  { id: 'work', label: 'العمل والدراسة' },
  { id: 'nature', label: 'الطبيعة والطقس' },
  { id: 'shopping', label: 'التسوّق والمال' },
  { id: 'media', label: 'الإعلام والتقنية' },
  { id: 'describing', label: 'الوصف والصفات' },
  { id: 'actions', label: 'أفعال شائعة' },
  { id: 'general', label: 'أسماء عامة' },
  { id: 'function', label: 'كلمات الربط والوظيفة' },
]

const TOPIC_WORDS: Record<string, string> = {
  people:
    'family mother father brother sister child children baby friend parent son daughter husband wife man woman boy girl people person grandmother grandfather uncle aunt cousin neighbour neighbor teenager adult guest partner',
  food:
    'apple bread water milk coffee tea egg eat drink food breakfast lunch dinner meal rice meat fish chicken fruit vegetable cheese sugar salt juice cake soup sandwich restaurant cook hungry thirsty potato tomato banana orange butter chocolate',
  home:
    'house room door bed table kitchen chair window home bathroom bedroom wall floor garden flat apartment sofa shower key lamp',
  travel:
    'car bus city street school travel hotel train plane airport station road map ticket bike bicycle taxi trip holiday country town village bridge abroad journey passport luggage arrive tourist visit',
  time:
    'day morning night week today time year month hour minute afternoon evening tomorrow yesterday weekend birthday early late',
  feelings:
    'happy sad afraid angry alone surprised worried tired bored excited love hate feel feeling hope fear nervous proud',
  body:
    'medicine accident head hand eye face body arm leg foot hair mouth nose doctor nurse hospital ill sick healthy pain health',
  work:
    'company manager meeting earn job work office student teacher class lesson exam homework study business boss worker salary university',
  nature:
    'cloud forest storm island weather rain snow sun sky sea river mountain tree flower animal dog cat bird hot cold wind beach lake',
  shopping: 'shop money buy sell price cheap expensive pay market bank cost',
  media: 'phone computer internet email website film music video photo television radio newspaper game',
}

const WORD_TO_TOPIC = new Map<string, string>()
/** موضع الكلمة في قائمة موضوعها: الكلمات الأساسية (family قبل baby) تأتي أولًا. */
const WORD_RANK = new Map<string, number>()
for (const [topic, list] of Object.entries(TOPIC_WORDS)) {
  list.split(/\s+/).forEach((w, i) => {
    if (WORD_TO_TOPIC.has(w)) return
    WORD_TO_TOPIC.set(w, topic)
    WORD_RANK.set(w, i)
  })
}

/** ترتيب داخل الموضوع؛ الكلمات خارج القاموس تأتي بعدها بترتيب الملف. */
export function topicRank(word: string, topic: string): number {
  const lower = word.toLowerCase()
  return WORD_TO_TOPIC.get(lower) === topic ? (WORD_RANK.get(lower) ?? Infinity) : Infinity
}

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id))

function topicFromPos(pos: string): string {
  if (pos.includes('verb') && !pos.includes('adverb')) return 'actions'
  if (pos.includes('adjective')) return 'describing'
  if (pos.includes('noun')) return 'general'
  return 'function'
}

export function resolveTopic(word: string, pos: string, explicit?: string): string {
  if (explicit && TOPIC_IDS.has(explicit)) return explicit
  return WORD_TO_TOPIC.get(word.toLowerCase()) ?? topicFromPos(pos)
}

export function topicOrder(topicId: string): number {
  const index = TOPICS.findIndex((t) => t.id === topicId)
  return index === -1 ? TOPICS.length : index
}

export function topicLabel(topicId: string): string {
  return TOPICS.find((t) => t.id === topicId)?.label ?? topicId
}
