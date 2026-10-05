/**
 * للمالك: تجهيز شرح كل الكلمات مسبقًا في المكتبة المشتركة، مستوى بعد مستوى.
 * يكمل من حيث توقف (الجاهز في المكتبة لا يُعاد توليده)، ويتوقف بهدوء عند حد الاستخدام اليومي.
 */
import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { contentFor, fetchBatch } from './content'
import { fetchShared, uploadShared } from './library'

export interface PrepareState {
  running: boolean
  done: number
  total: number
  message?: string
}

let state: PrepareState = { running: false, done: 0, total: 0 }
let stop = false
const listeners = new Set<() => void>()
function set(patch: Partial<PrepareState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function usePrepare(): PrepareState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function stopPrepare() {
  stop = true
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function prepareAllWords(): Promise<void> {
  if (state.running) return
  stop = false
  const words = await db.words.orderBy('order').toArray()
  set({ running: true, done: 0, total: words.length, message: 'نفحص الجاهز في المكتبة…' })
  try {
    // 1) ما في المكتبة يُحسب جاهزًا. ما عندنا محليًا ولم يُرفع بعد نرفعه.
    const missing: typeof words = []
    let done = 0
    for (let i = 0; i < words.length; i += 300) {
      const chunk = words.slice(i, i + 300)
      const found = await fetchShared(chunk.map((w) => w.id))
      const upload: Parameters<typeof uploadShared>[0] = []
      for (const w of chunk) {
        if (found.has(w.id)) done++
        else {
          const c = contentFor(w.id)
          if (c && (await db.content.get(w.id))) {
            upload.push({ wordId: w.id, content: c, model: 'local' })
            done++
          } else missing.push(w)
        }
      }
      for (let k = 0; k < upload.length; k += 400) await uploadShared(upload.slice(k, k + 400))
      set({ done })
      if (stop) return set({ message: 'أُوقف التجهيز. اضغط «أكمل» للمتابعة.' })
    }

    // 2) توليد الناقص على دفعات (كل دفعة تُرفع للمكتبة تلقائيًا).
    let failures = 0
    for (let i = 0; i < missing.length; ) {
      if (stop) return set({ message: 'أُوقف التجهيز. اضغط «أكمل» للمتابعة.' })
      const batch = missing.slice(i, i + 10)
      set({ message: `نجهّز كلمات ${batch[0].level}…` })
      try {
        await fetchBatch(batch)
        failures = 0
        i += batch.length
        done += batch.filter((w) => contentFor(w.id)).length
        set({ done })
      } catch {
        failures++
        if (failures >= 3) {
          return set({ message: 'توقف التجهيز — غالبًا وصل المفتاح المجاني لحد الاستخدام اليومي. أكمل غدًا، وسيكمل من حيث توقف.' })
        }
        set({ message: 'المفتاح مشغول، ننتظر قليلًا ثم نحاول…' })
        await wait(30_000)
      }
    }
    set({ message: '✓ كل الكلمات جاهزة لكل الطلاب.' })
  } catch {
    set({ message: 'تعذّر التجهيز الآن. تأكد من الإنترنت وحاول مرة أخرى.' })
  } finally {
    set({ running: false })
  }
}
