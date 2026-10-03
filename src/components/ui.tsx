import type { ComponentProps, ReactNode } from 'react'
import { RATE_NORMAL, RATE_SLOW, speak, speechSupported } from '../lib/speech'
import type { Level } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700 disabled:opacity-50',
  ghost: 'text-teal-800 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-slate-800 disabled:opacity-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

/** نص إنجليزي داخل واجهة عربية. */
export function En({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" lang="en" className={`font-en ${className}`}>
      {children}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${className}`}>
      {children}
    </div>
  )
}

const levelColors: Record<Level, string> = {
  A1: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  A2: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
  B1: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  B2: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200',
  C1: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
}

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span dir="ltr" className={`rounded-lg px-2 py-0.5 text-sm font-semibold ${levelColors[level]}`}>
      {level}
    </span>
  )
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div className="h-full rounded-full bg-teal-600 transition-all dark:bg-teal-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
    </svg>
  )
}

/** زرّا النطق: عادي وبطيء. */
export function SpeakButtons({ text, compact = false }: { text: string; compact?: boolean }) {
  if (!speechSupported()) {
    return <p className="text-sm text-slate-500">النطق غير مدعوم في هذا المتصفح.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => speak(text, RATE_NORMAL)} aria-label={`استمع: ${text}`}>
        <SpeakerIcon />
        {!compact && 'استمع'}
      </Button>
      <Button variant="secondary" onClick={() => speak(text, RATE_SLOW)} aria-label={`استمع ببطء: ${text}`}>
        <span aria-hidden="true">🐢</span>
        {!compact && 'ببطء'}
      </Button>
    </div>
  )
}

export function Screen({ title, onBack, children }: { title?: string; onBack?: () => void; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4 sm:pt-8">
      {(title || onBack) && (
        <header className="mb-5 flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" onClick={onBack} aria-label="رجوع" className="px-2">
              <span aria-hidden="true" className="text-xl">→</span>
            </Button>
          )}
          {title && <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>}
        </header>
      )}
      {children}
    </main>
  )
}
