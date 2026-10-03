/** تخزين الإضافة المشترك (chrome.storage.local). */
import { isSnapshot, type Snapshot } from '../../src/lib/browse'

export interface Options {
  highlight: boolean
  replaceArabic: boolean
}

export interface SavedWord {
  word: string
  url?: string
  savedAt: number
}

export const DEFAULT_OPTIONS: Options = { highlight: true, replaceArabic: true }

export async function getSnapshot(): Promise<Snapshot | null> {
  const { snapshot } = await chrome.storage.local.get('snapshot')
  return isSnapshot(snapshot) ? snapshot : null
}

export async function getOptions(): Promise<Options> {
  const { options } = await chrome.storage.local.get('options')
  return { ...DEFAULT_OPTIONS, ...(options as Partial<Options> | undefined) }
}

export async function getSaved(): Promise<SavedWord[]> {
  const { saved } = await chrome.storage.local.get('saved')
  return Array.isArray(saved) ? (saved as SavedWord[]) : []
}

/** كلمة إنجليزية صالحة للحفظ (حتى 3 أجزاء). */
export function normalizeSelection(text: string): string | null {
  const t = text.trim().replace(/[“”"().,!?;:]+/g, '').replace(/\s+/g, ' ').toLowerCase()
  return /^[a-z][a-z'’-]*(?: [a-z][a-z'’-]*){0,2}$/.test(t) && t.length <= 30 ? t : null
}

export async function saveWord(raw: string, url?: string): Promise<string | null> {
  const word = normalizeSelection(raw)
  if (!word) return null
  const saved = await getSaved()
  if (!saved.some((s) => s.word === word)) {
    saved.push({ word, url, savedAt: Date.now() })
    await chrome.storage.local.set({ saved })
  }
  await updateBadge()
  return word
}

export async function updateBadge(): Promise<void> {
  const saved = await getSaved()
  await chrome.action.setBadgeText({ text: saved.length ? String(saved.length) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#0f766e' })
}
