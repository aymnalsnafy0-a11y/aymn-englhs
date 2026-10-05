import { useRef, useState } from 'react'
import { isStaticHost, setGeminiKey, testGeminiKey } from '../data/ai'
import { importWordList, MIN_IMPORT_WORDS, removeImportedWordList } from '../db/loader'
import { useGeminiKey, useLoadInfo } from '../db/hooks'
import { useProfile } from '../data/roles'
import { Button, Card } from './ui'

/** استيراد قائمة الكلمات الكاملة من ملف على الجهاز (تبقى في المتصفح فقط). */
export function WordListImport({ compact = false }: { compact?: boolean }) {
  const info = useLoadInfo()
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null)

  async function onFile(file: File) {
    setStatus({ kind: 'busy', text: 'نقرأ الملف…' })
    const result = await importWordList(await file.text(), file.name)
    setStatus(
      result.ok
        ? { kind: 'ok', text: `تم! ${result.count} كلمة جاهزة.` }
        : { kind: 'error', text: `الملف لا يبدو قائمة كلمات (وجدنا ${result.count} كلمة فقط، والمطلوب ${MIN_IMPORT_WORDS} على الأقل بأعمدة word,level,pos).` },
    )
  }

  return (
    <div>
      {!compact && (
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          {info?.source === 'custom'
            ? `تستخدم قائمتك (${info.count} كلمة). محفوظة في هذا الجهاز فقط.`
            : info?.source === 'oxford5000'
              ? `قائمة أكسفورد الكاملة (${info.count} كلمة).`
              : `تستخدم ملف التجربة (${info?.count ?? 0} كلمة). حمّل ملف oxford5000.csv لتحصل على كل الكلمات.`}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        aria-label="ملف قائمة الكلمات"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant={compact ? 'primary' : 'secondary'} onClick={() => input.current?.click()} disabled={status?.kind === 'busy'}>
          حمّل ملف الكلمات (CSV)
        </Button>
        {info?.source === 'custom' && !compact && (
          <Button variant="ghost" onClick={() => void removeImportedWordList().then(() => setStatus(null))}>
            ارجع لملف التجربة
          </Button>
        )}
      </div>
      {status && (
        <p
          aria-live="polite"
          className={`mt-2 text-sm ${status.kind === 'error' ? 'text-rose-700 dark:text-rose-400' : status.kind === 'ok' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}`}
        >
          {status.text}
        </p>
      )}
    </div>
  )
}

/** مفتاح Gemini الشخصي: يُحفظ في هذا الجهاز فقط ويُستخدم للقصص وشرح الكلمات. */
export function GeminiKeyForm() {
  const saved = useGeminiKey()
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'busy'; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const key = value.trim()
    if (!key) return
    setStatus({ kind: 'busy', text: 'نتحقق من المفتاح…' })
    const result = await testGeminiKey(key)
    if (result === 'invalid') return setStatus({ kind: 'error', text: 'المفتاح غير صحيح. انسخه مرة أخرى من AI Studio.' })
    if (result === 'network') return setStatus({ kind: 'error', text: 'تعذّر الاتصال بـ Gemini. تأكد من الإنترنت وحاول مجددًا.' })
    await setGeminiKey(key)
    setValue('')
    setStatus({ kind: 'ok', text: 'تم حفظ المفتاح. القصص وشرح الكلمات صارت تعمل.' })
  }

  if (saved) {
    return (
      <div>
        <p className="text-sm text-teal-700 dark:text-teal-400">
          ✓ المفتاح محفوظ في هذا الجهاز (…{saved.slice(-4)}).
        </p>
        {status?.kind === 'ok' && <p className="mt-1 text-sm text-slate-500">{status.text}</p>}
        <Button variant="ghost" className="mt-2" onClick={() => void setGeminiKey(null).then(() => setStatus(null))}>
          احذف المفتاح من هذا الجهاز
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={save}>
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
        للقصص وشرح الكلمات. خذ مفتاحًا مجانيًا من{' '}
        <a className="text-teal-700 underline dark:text-teal-400" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          aistudio.google.com/apikey
        </a>{' '}
        والصقه هنا. يُحفظ في هذا الجهاز فقط.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="password"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          aria-label="مفتاح Gemini"
          placeholder="مفتاح Gemini"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300 focus:ring-2 focus:ring-teal-600 focus:outline-none dark:bg-slate-950 dark:ring-slate-700"
        />
        <Button type="submit" disabled={!value.trim() || status?.kind === 'busy'}>
          احفظ
        </Button>
      </div>
      {status && (
        <p
          aria-live="polite"
          className={`mt-2 text-sm ${status.kind === 'error' ? 'text-rose-700 dark:text-rose-400' : status.kind === 'ok' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}`}
        >
          {status.text}
        </p>
      )}
    </form>
  )
}

/** بطاقة تظهر في الرئيسية على الموقع الثابت حتى يُفعَّل الذكاء الاصطناعي ويُحمَّل الملف. */
export function SetupCard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const key = useGeminiKey()
  const info = useLoadInfo()
  const { profile } = useProfile()
  // الطلاب والمعلمون يحصلون على القائمة والشرح مما يشاركه المالك.
  if (key === undefined || !info || !profile?.owner) return null
  // على Vercel المفتاح في الخادم؛ على الموقع الثابت يحتاج المستخدم مفتاحه.
  const needKey = !key && isStaticHost()
  const needList = info.source === 'sample'
  if (!needKey && !needList) return null
  return (
    <Card className="mb-4 ring-amber-300 dark:ring-amber-800">
      <h2 className="font-bold">جهّز الموقع للمذاكرة</h2>
      <ol className="mt-2 grid list-decimal gap-1 ps-5 text-sm text-slate-600 dark:text-slate-400">
        {needList && <li>حمّل ملف قائمة الكلمات الكاملة (oxford5000.csv).</li>}
        {needKey && <li>أضف مفتاح Gemini المجاني لتعمل القصص وشرح الكلمات.</li>}
      </ol>
      <Button className="mt-3" onClick={onOpenSettings}>
        افتح الإعدادات
      </Button>
    </Card>
  )
}
