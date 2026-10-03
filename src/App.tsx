import { useEffect, useState } from 'react'
import { Screen } from './components/ui'
import { useSettings } from './db/hooks'
import { loadWords } from './db/loader'
import { loadStoredContent, useContentVersion } from './data/content'
import { useExtensionBridge } from './db/extensionBridge'
import { DailyCount } from './screens/DailyCount'
import { Home } from './screens/Home'
import { Learn } from './screens/Learn'
import { LevelPicker } from './screens/LevelPicker'
import { Review } from './screens/Review'
import { SettingsScreen } from './screens/Settings'
import { Mistakes } from './screens/Mistakes'
import { Progress } from './screens/Progress'
import { Quiz } from './screens/Quiz'
import { Placement } from './screens/Placement'
import { StoryScreen } from './screens/Story'
import { StoryLibrary } from './screens/StoryLibrary'
import type { QuizKind, Theme } from './db/db'
import type { Level } from './lib/types'

type Page = 'home' | 'learn' | 'review' | 'settings' | 'levels' | 'daily' | 'progress' | 'mistakes' | 'library' | 'placement'
type Route =
  | { page: Page }
  | { page: 'quiz'; kind: QuizKind; level?: Level; back: Page }
  | { page: 'story'; storyId?: number; back: Page }

function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      // «حسب الجهاز»: نحترم أيضًا سمة الصفحة المضيفة إن وُجدت (data-theme).
      const host = document.documentElement.getAttribute('data-theme')
      const systemDark = host ? host === 'dark' : media.matches
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && systemDark)
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
  const [route, setRoute] = useState<Route>({ page: 'home' })
  useTheme(settings?.theme)
  // إعادة الرسم عند وصول محتوى كلمات مولَّد.
  useContentVersion()
  useExtensionBridge()

  useEffect(() => {
    loadWords()
      .then(loadStoredContent)
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
  const go = (page: Page) => setRoute({ page })
  const home = () => go('home')
  const quiz = (back: Page) => (kind: QuizKind, level?: Level) => setRoute({ page: 'quiz', kind, level, back })

  if (!settings.startLevel) {
    return route.page === 'placement' ? (
      <Placement onBack={home} onChosen={home} />
    ) : (
      <LevelPicker onDone={home} onPlacement={() => go('placement')} />
    )
  }
  if (!settings.onboarded) return <DailyCount onDone={home} />

  switch (route.page) {
    case 'learn':
      return <Learn onExit={home} />
    case 'review':
      return <Review onExit={home} />
    case 'quiz':
      return <Quiz key={`${route.kind}-${route.level}`} kind={route.kind} level={route.level} onExit={() => go(route.back)} />
    case 'story':
      return (
        <StoryScreen
          key={route.storyId ?? 'today'}
          storyId={route.storyId}
          onBack={() => go(route.back)}
          openLibrary={() => go('library')}
        />
      )
    case 'library':
      return <StoryLibrary onBack={home} open={(storyId) => setRoute({ page: 'story', storyId, back: 'library' })} />
    case 'progress':
      return <Progress onBack={home} startQuiz={quiz('progress')} openMistakes={() => go('mistakes')} />
    case 'mistakes':
      return <Mistakes onBack={home} onPractice={() => quiz('mistakes')('mistakes')} />
    case 'settings':
      return <SettingsScreen go={go} onBack={home} />
    case 'levels':
      return (
        <LevelPicker onDone={() => go('settings')} onBack={() => go('settings')} onPlacement={() => go('placement')} />
      )
    case 'placement':
      return <Placement onBack={() => go('levels')} onChosen={() => go('settings')} />
    case 'daily':
      return <DailyCount onDone={() => go('settings')} onBack={() => go('settings')} />
    default:
      return <Home go={go} startQuiz={quiz('home')} openStory={() => setRoute({ page: 'story', back: 'home' })} />
  }
}
