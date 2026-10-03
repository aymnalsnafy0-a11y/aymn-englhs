/** نطق إنجليزي عبر Web Speech API. */
export const RATE_NORMAL = 1.0
export const RATE_SLOW = 0.7

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let cachedVoice: SpeechSynthesisVoice | null | undefined

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  cachedVoice =
    voices.find((v) => v.lang === 'en-US' && v.localService) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  return cachedVoice
}

if (speechSupported()) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = undefined
  })
}

export function speak(text: string, rate: number = RATE_NORMAL): SpeechSynthesisUtterance | null {
  if (!speechSupported()) return null
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = rate
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  synth.speak(utterance)
  return utterance
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}
