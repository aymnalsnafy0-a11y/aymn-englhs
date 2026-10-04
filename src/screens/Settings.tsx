import { GeminiKeyForm, WordListImport } from '../components/AiSettings'
import { Button, Card, LevelBadge, Screen } from '../components/ui'
import { updateSettings } from '../db/actions'
import type { StoryMode, Theme } from '../db/db'
import { useLoadInfo, useSettings } from '../db/hooks'
import { formatWords } from '../lib/format'

function Choice<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{name}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`cursor-pointer rounded-xl px-3 py-2 ring-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-amber-500 ${
            value === o.value
              ? 'bg-teal-700 text-white ring-teal-700 dark:bg-teal-600'
              : 'ring-slate-300 hover:bg-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800'
          }`}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

export function SettingsScreen({ go, onBack }: { go: (s: 'levels' | 'daily') => void; onBack: () => void }) {
  const settings = useSettings()
  const info = useLoadInfo()
  if (!settings) return null

  return (
    <Screen title="الإعدادات" onBack={onBack}>
      <div className="grid gap-3">
        <Card>
          <h2 className="mb-1 font-bold">قائمة الكلمات</h2>
          <WordListImport />
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">مفتاح Gemini (القصص وشرح الكلمات)</h2>
          <GeminiKeyForm />
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">مستوى البداية</h2>
            <p className="text-sm text-slate-500">تغييره لا يمسح تقدّمك.</p>
          </div>
          <div className="flex items-center gap-2">
            {settings.startLevel && <LevelBadge level={settings.startLevel} />}
            <Button variant="secondary" onClick={() => go('levels')}>
              تغيير
            </Button>
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">الكلمات الجديدة يوميًا</h2>
            <p className="text-sm text-slate-500">{formatWords(settings.dailyCount)}</p>
          </div>
          <Button variant="secondary" onClick={() => go('daily')}>
            تغيير
          </Button>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold">المظهر</h2>
          <Choice<Theme>
            name="المظهر"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'حسب الجهاز' },
              { value: 'light', label: 'فاتح' },
              { value: 'dark', label: 'داكن' },
            ]}
          />
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">نوع قصة اليوم</h2>
          <p className="mb-3 text-sm text-slate-500">تُستخدم عند تفعيل القصص قريبًا.</p>
          <Choice<StoryMode>
            name="نوع القصة"
            value={settings.storyMode}
            onChange={(storyMode) => updateSettings({ storyMode })}
            options={[
              { value: 'serial', label: 'حلقات متسلسلة بشخصية ثابتة' },
              { value: 'standalone', label: 'قصص مستقلة' },
            ]}
          />
        </Card>

        {info && (
          <Card className="text-sm text-slate-600 dark:text-slate-400">
            <h2 className="mb-1 font-bold text-slate-900 dark:text-slate-100">مصدر الكلمات</h2>
            <p>
              {info.source === 'sample' ? 'ملف التجربة' : info.source === 'custom' ? 'قائمتك المستوردة' : 'قائمة أكسفورد الكاملة'} — {info.count} كلمة
            </p>
            {info.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-700 dark:text-amber-400">
                  {info.errors.length} سطر لم يُقرأ
                </summary>
                <ul className="mt-1 list-disc ps-5">
                  {info.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        )}
      </div>
    </Screen>
  )
}
