import { getOptions, getSaved, getSnapshot, saveWord, type Options } from './storage'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function el(tag: string, attrs: Record<string, string> = {}, text = ''): HTMLElement {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  e.textContent = text
  return e
}

interface Stats {
  lang: 'en' | 'ar' | 'other'
  ready: boolean
  total: number
  known: number
  learning: number
  coverage: number
  highlighted: number
  replaced: number
}

async function renderPage() {
  const box = $('page')
  box.replaceChildren()
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let stats: Stats | null = null
  try {
    stats = tab?.id ? await chrome.tabs.sendMessage(tab.id, { type: 'siyaq-stats' }) : null
  } catch {
    stats = null
  }
  if (!stats || !stats.ready || stats.lang === 'other') {
    box.append(el('p', { class: 'muted' }, 'لا يمكن تحليل هذه الصفحة (صفحة غير إنجليزية أو عربية، أو صفحة محمية). جرّب إعادة تحميلها.'))
    return
  }
  if (stats.lang === 'en') {
    box.append(el('p', { class: 'muted' }, 'تفهم من كلمات هذه الصفحة حوالي'))
    const big = el('div', { class: 'big' })
    big.append(el('span', { dir: 'ltr' }, `${stats.coverage}%`))
    box.append(big)
    const bar = el('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(stats.coverage), 'aria-valuemin': '0', 'aria-valuemax': '100' })
    const fill = el('span')
    fill.style.width = `${stats.coverage}%`
    bar.append(fill)
    box.append(bar)
    box.append(
      el(
        'p',
        { class: 'muted' },
        `${stats.known} معروفة · ${stats.learning} قيد التعلّم · ${stats.total - stats.known - stats.learning} جديدة — من ${stats.total} كلمة. ظللنا ${stats.highlighted}.`,
      ),
    )
  } else {
    box.append(el('strong', {}, `استبدلنا ${stats.replaced} كلمة بالإنجليزية`))
    box.append(el('p', { class: 'muted' }, 'مرّر المؤشر على الكلمة لترى الأصل العربي.'))
  }
}

async function renderSaved() {
  const saved = await getSaved()
  const list = $('saved')
  list.replaceChildren(
    ...saved.map((s) => {
      const li = el('li')
      li.append(el('span', { class: 'en' }, s.word))
      const remove = el('button', { class: 'link', type: 'button', 'aria-label': `احذف ${s.word}` }, '✕')
      remove.addEventListener('click', async () => {
        await chrome.storage.local.set({ saved: (await getSaved()).filter((x) => x.word !== s.word) })
        void renderSaved()
      })
      li.append(remove)
      return li
    }),
  )
  $('saved-note').hidden = saved.length === 0
  const { lastUnknown } = await chrome.storage.local.get('lastUnknown')
  const unknown = $('unknown')
  unknown.hidden = !Array.isArray(lastUnknown) || lastUnknown.length === 0
  if (!unknown.hidden) unknown.textContent = `ليست في قائمة أكسفورد ولم تُضف: ${(lastUnknown as string[]).join('، ')}`
}

async function init() {
  const snapshot = await getSnapshot()
  $('nosnap').hidden = !!snapshot
  if (snapshot) {
    const learning = snapshot.words.filter((w) => w.s === 'l').length
    $('sync').textContent = `${snapshot.level} · ${learning} قيد التعلّم`
  }
  const options = await getOptions()
  const bind = (id: string, key: keyof Options) => {
    const box = $<HTMLInputElement>(id)
    box.checked = options[key]
    box.addEventListener('change', async () => {
      const next = { ...(await getOptions()), [key]: box.checked }
      await chrome.storage.local.set({ options: next })
      setTimeout(renderPage, 300)
    })
  }
  bind('opt-highlight', 'highlight')
  bind('opt-replace', 'replaceArabic')

  $('save-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = $<HTMLInputElement>('save-input')
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const word = await saveWord(input.value, tab?.url)
    $('save-error').hidden = !!word
    if (word) input.value = ''
    void renderSaved()
  })

  await Promise.all([renderPage(), renderSaved()])
}

void init()
