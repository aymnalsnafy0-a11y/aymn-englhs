import { useEffect, useState } from 'react'
import { Screen } from './components/ui'
import { useSettings } from './db/hooks'
import { loadWords } from './db/loader'
import { DailyCount } from './screens/DailyCount'
import { Home } from './screens/Home'
import { Learn } from './screens/Learn'
import { LevelPicker } from './screens/LevelPicker'
import { Review } from './screens/Review'
import { SettingsScreen } from './screens/Settings'
import type { Theme } from './db/db'

type Route = 'home' | 'learn' | 'review' | 'settings' | 'levels' | 'daily'

function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  const settings = useSettings()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>('home')
  useTheme(settings?.theme)

  useEffect(() => {
    loadWords()
      .then(() => setLoaded(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  if (error) {
    return (
      <Screen title="تعذّر تحميل الكلمات">
        <p className="text-rose-700 dark:text-rose-400">{error}</p>
      </Screen>
    )
  }
  if (!loaded || !settings) {
    return <p className="p-8 text-center text-slate-500">جارٍ التحميل…</p>
  }

  // الإعداد الأولي: المستوى ثم عدد الكلمات اليومي.
  if (!settings.startLevel) return <LevelPicker onDone={() => setRoute('home')} />
  if (!settings.onboarded) return <DailyCount onDone={() => setRoute('home')} />

  const home = () => setRoute('home')
  switch (route) {
    case 'learn':
      return <Learn onExit={home} />
    case 'review':
      return <Review onExit={home} />
    case 'settings':
      return <SettingsScreen go={setRoute} onBack={home} />
    case 'levels':
      return <LevelPicker onDone={() => setRoute('settings')} onBack={() => setRoute('settings')} />
    case 'daily':
      return <DailyCount onDone={() => setRoute('settings')} onBack={() => setRoute('settings')} />
    default:
      return <Home go={setRoute} />
  }
}
