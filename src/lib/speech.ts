/** نطق عبر Web Speech API: إنجليزي للكلمات والجمل، وعربي لأجزاء قصص المبتدئ. */
export const RATE_NORMAL = 1.0
export const RATE_SLOW = 0.7
export const RATE_FAST = 1.25

export type SpeechLang = 'en' | 'ar'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const cachedVoices = new Map<SpeechLang, SpeechSynthesisVoice | null>()

const PREFERRED: Record<SpeechLang, string[]> = {
  en: ['en-US', 'en-GB'],
  ar: ['ar-SA', 'ar-EG', 'ar'],
}

export function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  if (cachedVoices.has(lang)) return cachedVoices.get(lang)!
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const match = (code: string) => voices.filter((v) => v.lang.replace('_', '-').startsWith(code))
  let voice: SpeechSynthesisVoice | null = null
  for (const code of PREFERRED[lang]) {
    const found = match(code)
    voice = found.find((v) => v.localService) ?? found[0] ?? null
    if (voice) break
  }
  cachedVoices.set(lang, voice)
  return voice
}

/** هل على الجهاز صوت لهذه اللغة؟ (بعض المتصفحات لا تحمل صوتًا عربيًا) */
export function hasVoice(lang: SpeechLang): boolean {
  return speechSupported() && pickVoice(lang) !== null
}

if (speechSupported()) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => cachedVoices.clear())
}

export function makeUtterance(text: string, lang: SpeechLang, rate: number): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'en' ? 'en-US' : 'ar-SA'
  utterance.rate = rate
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice
  return utterance
}

export function speak(text: string, rate: number = RATE_NORMAL): SpeechSynthesisUtterance | null {
  if (!speechSupported()) return null
  window.speechSynthesis.cancel()
  const utterance = makeUtterance(text, 'en', rate)
  window.speechSynthesis.speak(utterance)
  return utterance
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
