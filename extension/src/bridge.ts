/**
 * يعمل داخل صفحة تطبيق سياق فقط: يستقبل لقطة المتعلم من التطبيق ويخزّنها،
 * ويرسل للتطبيق الكلمات المحفوظة من المواقع ثم يحذفها بعد تأكيد الاستلام.
 */
import { isSnapshot } from '../../src/lib/browse'
import { getSaved } from './storage'

const APP = 'siyaq-app'
const EXT = 'siyaq-ext'

async function sendSaved() {
  const saved = await getSaved()
  if (saved.length) window.postMessage({ source: EXT, type: 'saved-words', words: saved.map((s) => s.word) }, location.origin)
}

window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.source !== APP) return
  if (e.data.type === 'snapshot' && isSnapshot(e.data.snapshot)) {
    await chrome.storage.local.set({ snapshot: e.data.snapshot, syncedFrom: location.origin })
  } else if (e.data.type === 'ready') {
    await sendSaved()
  } else if (e.data.type === 'saved-ack' && Array.isArray(e.data.words)) {
    const acked = new Set(e.data.words as string[])
    const saved = (await getSaved()).filter((s) => !acked.has(s.word))
    await chrome.storage.local.set({ saved, lastUnknown: e.data.unknown ?? [] })
  }
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.saved?.newValue && (changes.saved.newValue as unknown[]).length) void sendSaved()
})

void sendSaved()
