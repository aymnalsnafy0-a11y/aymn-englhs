import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, ProgressBar, Screen } from '../components/ui'
import { WordPeek } from '../components/WordPeek'
import { requestTodayStory, saveStoryAnswers, StoryRequestError } from '../db/actions'
import type { StoryRow } from '../db/db'
import { useStory, useTodayStory, useWords } from '../db/hooks'
import { hasVoice, RATE_FAST, RATE_NORMAL, RATE_SLOW, speechSupported } from '../lib/speech'
import { StoryPlayer, type Position } from '../lib/storyPlayer'
import { matchTarget, segmentSentence } from '../lib/storyText'
import type { Word } from '../lib/types'

const ERRORS: Record<string, string> = {
  not_configured: 'لتفعيل القصص أضف مفتاح Gemini المجاني من الإعدادات.',
  unavailable: 'خدمة توليد القصص مزدحمة الآن. جرّب بعد دقيقة.',
  provider_rejected: 'رفض Gemini الطلب. تأكد من المفتاح في الإعدادات.',
  network: 'تعذّر الاتصال. تأكد من الإنترنت، أو أضف مفتاح Gemini من الإعدادات.',
  no_words: 'أنهِ بطاقة كلمة واحدة على الأقل اليوم حتى نكتب قصتك.',
}

const SPEEDS = [
  { rate: RATE_SLOW, label: 'بطيء' },
  { rate: RATE_NORMAL, label: 'عادي' },
  { rate: RATE_FAST, label: 'سريع' },
]

function Generate({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const started = useRef(-1)

  useEffect(() => {
    if (started.current === attempt) return
    started.current = attempt
    setError(null)
    requestTodayStory().catch((e) => setError(e instanceof StoryRequestError ? e.code : 'network'))
  }, [attempt])

  return (
    <Screen title="قصة اليوم" onBack={onBack}>
      <Card className="py-10 text-center" aria-live="polite">
        {error ? (
          <>
            <p className="text-lg font-semibold text-rose-700 dark:text-rose-400">ما قدرنا نكتب القصة</p>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{ERRORS[error] ?? ERRORS.network}</p>
            {error !== 'no_words' && (
              <Button className="mt-5" onClick={() => setAttempt((a) => a + 1)}>
                حاول مرة أخرى
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700 motion-reduce:animate-none dark:border-slate-700 dark:border-t-teal-400" />
            <p className="text-lg font-semibold">نكتب قصتك من كلمات اليوم…</p>
            <p className="mt-1 text-sm text-slate-500">عادةً تأخذ من 10 إلى 30 ثانية.</p>
          </>
        )}
      </Card>
    </Screen>
  )
}

function Questions({ story }: { story: StoryRow }) {
  const [picked, setPicked] = useState<(number | undefined)[]>(story.answers ?? [])
  if (story.questions.length === 0) return null
  const correct = story.questions.filter((q, i) => picked[i] === q.answer).length
  const done = story.questions.every((_, i) => picked[i] !== undefined)

  function choose(qi: number, oi: number) {
    if (picked[qi] !== undefined) return
    const next = [...picked]
    next[qi] = oi
    setPicked(next)
    if (story.id !== undefined && story.questions.every((_, i) => next[i] !== undefined)) {
      void saveStoryAnswers(story.id, next as number[])
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="mb-3 text-lg font-bold">أسئلة الفهم</h2>
      <ol className="grid gap-5">
        {story.questions.map((q, qi) => (
          <li key={qi}>
            <p className="mb-2 font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-2">
              {q.options.map((option, oi) => {
                const answered = picked[qi] !== undefined
                const isAnswer = answered && oi === q.answer
                const isWrongPick = answered && picked[qi] === oi && oi !== q.answer
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={answered}
                    onClick={() => choose(qi, oi)}
                    className={`min-h-11 rounded-xl px-4 py-2 text-start ring-1 transition ${
                      isAnswer
                        ? 'bg-teal-50 ring-2 ring-teal-600 dark:bg-teal-950/50'
                        : isWrongPick
                          ? 'bg-rose-50 ring-2 ring-rose-500 dark:bg-rose-950/50'
                          : 'ring-slate-300 hover:bg-slate-100 disabled:hover:bg-transparent dark:ring-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    {option}
                    {isAnswer && <span className="sr-only"> (الإجابة الصحيحة)</span>}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
      {done && (
        <p className="mt-4 text-center font-semibold" aria-live="polite">
          فهمت {correct} من {story.questions.length} {correct === story.questions.length ? '🌟' : ''}
        </p>
      )}
    </Card>
  )
}

function Reader({ story, onBack, openLibrary }: { story: StoryRow; onBack: () => void; openLibrary: () => void }) {
  const words = useWords()
  const segments = useMemo(() => story.sentences.map((s) => segmentSentence(s.text)), [story])
  const targets = useMemo(() => {
    const ids = new Set([...story.wordIds, ...story.reviewWordIds])
    return (words ?? []).filter((w) => ids.has(w.id))
  }, [words, story])
  const [position, setPosition] = useState<Position | null>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(RATE_NORMAL)
  const [listenOnly, setListenOnly] = useState(false)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [peek, setPeek] = useState<Word | null>(null)
  const player = useRef<StoryPlayer | null>(null)
  const beginner = story.kind === 'beginner'

  useEffect(() => {
    const p = new StoryPlayer(segments, { onPosition: setPosition, onPlayingChange: setPlaying })
    player.current = p
    return () => p.destroy()
  }, [segments])

  // الجملة المنطوقة تبقى ظاهرة على الشاشة.
  useEffect(() => {
    if (position && !listenOnly) {
      document.getElementById(`s-${position.sentence}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [position?.sentence, listenOnly])

  function openWord(token: string) {
    player.current?.pause()
    const lower = token.toLowerCase()
    const found = matchTarget(token, targets) ?? words?.find((w) => w.word.toLowerCase() === lower)
    if (found) setPeek(found)
  }

  function toggleTranslation(i: number) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const current = position?.sentence ?? player.current?.current ?? 0
  const noArabicVoice = beginner && speechSupported() && !hasVoice('ar')

  return (
    <Screen title="قصة اليوم" onBack={onBack}>
      <header className="mb-4">
        <p className="text-sm text-slate-500">
          {story.mode === 'serial' ? `الحلقة ${story.episode}` : 'قصة مستقلة'} · <span dir="ltr">{story.date}</span>
        </p>
        <h2 className="text-2xl font-bold">{story.titleAr}</h2>
        <p dir="ltr" lang="en" className="font-en text-end text-lg text-slate-500">
          {story.title}
        </p>
      </header>

      {listenOnly ? (
        <Card className="py-10 text-center">
          <p className="text-5xl" aria-hidden="true">🎧</p>
          <p className="mt-3 font-semibold">وضع الاستماع فقط</p>
          <p className="mt-1 text-slate-500">
            الجملة {current + 1} من {story.sentences.length}
          </p>
          <div className="mx-auto mt-4 max-w-xs">
            <ProgressBar value={current + (playing ? 1 : 0)} max={story.sentences.length} label="تقدّم الاستماع" />
          </div>
        </Card>
      ) : (
        <Card>
          <p className="mb-3 text-sm text-slate-500">
            اضغط على أي جملة لترى ترجمتها، وعلى الكلمة المظللة لتفتح بطاقتها.
          </p>
          <div className="grid gap-1">
            {segments.map((sentence, si) => {
              const active = position?.sentence === si
              return (
                <div
                  key={si}
                  id={`s-${si}`}
                  className={`rounded-xl px-2 py-1.5 transition-colors ${active ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}
                >
                  <p
                    dir={beginner ? 'rtl' : 'ltr'}
                    lang={beginner ? 'ar' : 'en'}
                    onClick={() => toggleTranslation(si)}
                    className={`cursor-pointer leading-loose ${beginner ? 'text-xl' : 'font-en text-xl'}`}
                  >
                    {sentence.map((seg, gi) => {
                      const pieces: React.ReactNode[] = []
                      let last = 0
                      seg.tokens.forEach((tok, ti) => {
                        if (tok.start > last) pieces.push(seg.text.slice(last, tok.start))
                        const spoken = active && position?.segment === gi && position.token === ti
                        const target = seg.lang === 'en' ? matchTarget(tok.text, targets) : undefined
                        const cls = spoken ? 'rounded bg-amber-300 text-slate-900 dark:bg-amber-400' : ''
                        if (target) {
                          pieces.push(
                            <button
                              key={ti}
                              type="button"
                              dir="ltr"
                              lang="en"
                              onClick={(e) => {
                                e.stopPropagation()
                                openWord(tok.text)
                              }}
                              className={`font-en mx-0.5 rounded px-1 font-semibold text-teal-800 underline decoration-teal-500 decoration-2 underline-offset-4 dark:text-teal-300 ${cls || 'bg-teal-50 dark:bg-teal-950'}`}
                            >
                              {tok.text}
                            </button>,
                          )
                        } else {
                          pieces.push(
                            <span
                              key={ti}
                              className={cls}
                              onClick={
                                seg.lang === 'en'
                                  ? (e) => {
                                      e.stopPropagation()
                                      openWord(tok.text)
                                    }
                                  : undefined
                              }
                            >
                              {tok.text}
                            </span>,
                          )
                        }
                        last = tok.end
                      })
                      if (last < seg.text.length) pieces.push(seg.text.slice(last))
                      return (
                        <span key={gi} dir={seg.lang === 'en' ? 'ltr' : 'rtl'} className={seg.lang === 'en' && beginner ? 'font-en' : ''}>
                          {pieces}
                        </span>
                      )
                    })}
                  </p>
                  <button
                    type="button"
                    aria-expanded={open.has(si)}
                    onClick={() => toggleTranslation(si)}
                    className="sr-only focus:not-sr-only focus:text-sm"
                  >
                    ترجمة الجملة {si + 1}
                  </button>
                  {open.has(si) && (
                    <p
                      dir={beginner ? 'ltr' : 'rtl'}
                      lang={beginner ? 'en' : 'ar'}
                      className={`mt-1 text-slate-600 dark:text-slate-400 ${beginner ? 'font-en' : ''}`}
                    >
                      {story.sentences[si].translation}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {story.missing.length > 0 && (
            <p className="mt-3 text-sm text-slate-500">
              لم تظهر في القصة: <span dir="ltr">{story.missing.join('، ')}</span>
            </p>
          )}
        </Card>
      )}

      {speechSupported() && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-slate-200 bg-slate-50/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={() => player.current?.toggle()} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل القصة'} className="min-w-24">
                {playing ? '⏸ إيقاف' : '▶ استمع'}
              </Button>
              <Button variant="secondary" onClick={() => player.current?.repeat()} aria-label="أعد الجملة">
                ↻ <span className="hidden sm:inline">أعد الجملة</span>
              </Button>
            </div>
            <fieldset className="flex rounded-xl ring-1 ring-slate-300 dark:ring-slate-700">
              <legend className="sr-only">السرعة</legend>
              {SPEEDS.map((s) => (
                <label
                  key={s.rate}
                  className={`cursor-pointer px-3 py-2 text-sm first:rounded-s-xl last:rounded-e-xl has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-amber-500 ${
                    rate === s.rate ? 'bg-teal-700 text-white dark:bg-teal-600' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="speed"
                    className="sr-only"
                    checked={rate === s.rate}
                    onChange={() => {
                      setRate(s.rate)
                      player.current?.setRate(s.rate)
                    }}
                  />
                  {s.label}
                </label>
              ))}
            </fieldset>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={listenOnly}
                onChange={(e) => setListenOnly(e.target.checked)}
                className="size-4 accent-teal-700"
              />
              استماع فقط
            </label>
          </div>
          {noArabicVoice && (
            <p className="mt-2 text-xs text-slate-500">لا يوجد صوت عربي في جهازك، لذلك ننطق الكلمات الإنجليزية فقط.</p>
          )}
        </div>
      )}

      <Questions story={story} />

      <div className="mt-4 text-center">
        <Button variant="ghost" onClick={openLibrary}>
          مكتبة القصص
        </Button>
      </div>

      <WordPeek word={peek} onClose={() => setPeek(null)} />
    </Screen>
  )
}

export function StoryScreen({
  storyId,
  onBack,
  openLibrary,
}: {
  storyId?: number
  onBack: () => void
  openLibrary: () => void
}) {
  const today = useTodayStory()
  const byId = useStory(storyId)
  const story = storyId === undefined ? today : byId
  if (story === undefined) return null
  if (story === null) {
    return storyId === undefined ? <Generate onBack={onBack} /> : null
  }
  return <Reader key={story.id} story={story} onBack={onBack} openLibrary={openLibrary} />
}
