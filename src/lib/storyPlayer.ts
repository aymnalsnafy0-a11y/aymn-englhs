/**
 * مشغّل القصة: ينطق الجمل مقطعًا مقطعًا، ويبلّغ عن الجملة والمقطع والكلمة الحالية
 * عبر أحداث boundary. الإيقاف المؤقت = إلغاء ثم الاستئناف من بداية الجملة الحالية
 * (pause/resume في Chrome على أندرويد غير موثوق).
 */
import { hasVoice, makeUtterance, speechSupported } from './speech'
import { tokenAt, type Segment } from './storyText'

export interface Position {
  sentence: number
  segment: number
  /** فهرس الكلمة داخل المقطع، أو -1 قبل أول حدث boundary. */
  token: number
}

export interface PlayerCallbacks {
  onPosition: (p: Position | null) => void
  onPlayingChange: (playing: boolean) => void
}

export class StoryPlayer {
  private generation = 0
  private sentence = 0
  playing = false
  rate = 1

  constructor(
    private readonly sentences: Segment[][],
    private readonly cb: PlayerCallbacks,
    /** للمبتدئ دون صوت عربي: نتخطى المقاطع العربية وننطق الإنجليزية فقط. */
    private readonly skipArabic = !hasVoice('ar'),
  ) {}

  get current(): number {
    return this.sentence
  }

  play(from = this.sentence): void {
    if (!speechSupported() || this.sentences.length === 0) return
    this.stopAudio()
    this.sentence = Math.max(0, Math.min(from, this.sentences.length - 1))
    this.setPlaying(true)
    this.speakFrom(this.generation, this.sentence, 0)
  }

  pause(): void {
    this.stopAudio()
    this.setPlaying(false)
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  /** إعادة الجملة الحالية من أولها. */
  repeat(): void {
    this.play(this.sentence)
  }

  setRate(rate: number): void {
    this.rate = rate
    if (this.playing) this.play(this.sentence)
  }

  destroy(): void {
    this.stopAudio()
    this.playing = false
  }

  private setPlaying(playing: boolean) {
    this.playing = playing
    this.cb.onPlayingChange(playing)
  }

  private stopAudio() {
    this.generation++
    if (speechSupported()) window.speechSynthesis.cancel()
  }

  private speakFrom(gen: number, sentence: number, segment: number): void {
    if (gen !== this.generation) return
    if (sentence >= this.sentences.length) {
      this.sentence = 0
      this.cb.onPosition(null)
      this.setPlaying(false)
      return
    }
    const segments = this.sentences[sentence]
    if (segment >= segments.length) {
      this.speakFrom(gen, sentence + 1, 0)
      return
    }
    const seg = segments[segment]
    this.sentence = sentence
    this.cb.onPosition({ sentence, segment, token: -1 })
    if (seg.lang === 'ar' && this.skipArabic) {
      this.speakFrom(gen, sentence, segment + 1)
      return
    }
    const u = makeUtterance(seg.text, seg.lang, this.rate)
    u.onboundary = (e) => {
      if (gen !== this.generation || e.name !== 'word') return
      this.cb.onPosition({ sentence, segment, token: tokenAt(seg.tokens, e.charIndex) })
    }
    u.onend = () => this.speakFrom(gen, sentence, segment + 1)
    u.onerror = (e) => {
      // "interrupted"/"canceled" تأتي من إيقافنا نحن.
      if (e.error === 'interrupted' || e.error === 'canceled') return
      this.speakFrom(gen, sentence, segment + 1)
    }
    window.speechSynthesis.speak(u)
  }
}
