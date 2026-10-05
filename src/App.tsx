import { useEffect, useState } from 'react'
import { Screen } from './components/ui'
import { useSettings } from './db/hooks'
import { loadWords } from './db/loader'
import { loadStoredContent, useContentVersion } from './data/content'
import { useExtensionBridge } from './db/extensionBridge'
import { startCloud, useCloudStatus, wasSignedIn } from './data/cloud'
import { refreshProfile, setMode, useProfile } from './data/roles'
import { TabBar, type Tab } from './components/TabBar'
import { JoinFirstClass, ProfileError, SignIn, Splash, TeacherCode, Welcome } from './screens/auth/Entry'
import { OwnerPanel } from './screens/teach/OwnerPanel'
import { TeacherHome } from './screens/teach/TeacherHome'
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
import { Classes } from './screens/classes/Classes'
import { ClassDashboard } from './screens/classes/ClassDashboard'
import { DoAssignment } from './screens/classes/DoAssignment'
import { NewAssignment } from './screens/classes/NewAssignment'
import { StudentClass } from './screens/classes/StudentClass'
import { StoryScreen } from './screens/Story'
import { StoryLibrary } from './screens/StoryLibrary'
import type { QuizKind, Theme } from './db/db'
import type { Level } from './lib/types'

type Page = 'home' | 'learn' | 'review' | 'settings' | 'levels' | 'daily' | 'progress' | 'mistakes' | 'library' | 'placement' | 'classes' | 'owner'
type Route =
  | { page: Page }
  | { page: 'quiz'; kind: QuizKind; level?: Level; back: Page }
  | { page: 'story'; storyId?: number; back: Page }
  | { page: 'class' | 'newAssignment' | 'studentClass'; code: string }
  | { page: 'doAssignment'; code: string; id: string }

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

const LEARN_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'classes', label: 'فصلي', icon: 'class' },
  { id: 'progress', label: 'تقدّمي', icon: 'chart' },
  { id: 'settings', label: 'الإعدادات', icon: 'gear' },
]
const STAFF_LEARN_TABS: Tab[] = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'progress', label: 'تقدّمي', icon: 'chart' },
  { id: 'teach', label: 'التدريس', icon: 'board' },
  { id: 'settings', label: 'الإعدادات', icon: 'gear' },
]
const TEACH_TABS: Tab[] = [
  { id: 'home', label: 'فصولي', icon: 'class' },
  { id: 'learn', label: 'تعلّمي', icon: 'book' },
  { id: 'settings', label: 'الإعدادات', icon: 'gear' },
]
const OWNER_TABS: Tab[] = [TEACH_TABS[0], { id: 'owner', label: 'المالك', icon: 'crown' }, ...TEACH_TABS.slice(1)]

export default function App() {
  const settings = useSettings()
  const cloud = useCloudStatus()
  const roles = useProfile()
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
      .then(() => {
        setLoaded(true)
        startCloud()
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  // نوع الحساب (مالك/معلم/طالب) يُقرأ من Firestore بعد كل دخول.
  useEffect(() => {
    if (cloud.state === 'signedIn') void refreshProfile()
  }, [cloud.state, cloud.uid])

  if (error) {
    return (
      <Screen title="تعذّر تحميل الكلمات">
        <p className="text-rose-700 dark:text-rose-400">{error}</p>
      </Screen>
    )
  }
  if (!loaded || !settings) return <Splash />

  const go = (page: Page) => setRoute({ page })
  const home = () => go('home')
  const quiz = (back: Page) => (kind: QuizKind, level?: Level) => setRoute({ page: 'quiz', kind, level, back })

  // ——— الدخول: الترحيب واختيار الدور ثم تسجيل الدخول ———
  const signedIn = cloud.state === 'signedIn'
  // سبق الدخول على هذا الجهاز ولم تُستعد الجلسة بعد (أو لا يوجد إنترنت): نكمل بالنسخة المحفوظة.
  const restoring = !signedIn && cloud.state !== 'signedOut' && wasSignedIn()
  const profile = roles.profile && (!cloud.uid || roles.profile.uid === cloud.uid) ? roles.profile : null
  if (!signedIn && !restoring) return roles.role ? <SignIn role={roles.role} /> : <Welcome />
  if (!profile) return roles.error && !roles.loading ? <ProfileError error={roles.error} /> : <Splash />

  const staff = profile.owner || profile.teacher
  if (!staff && roles.role === 'teacher') return <TeacherCode />
  if (!staff && profile.classes === 0) return <JoinFirstClass />

  const withTabs = (tabs: Tab[], active: string, screen: React.ReactNode) => (
    <div className="pb-20">
      {screen}
      <TabBar
        tabs={tabs}
        active={active}
        onSelect={(id) => {
          if (id === 'teach' || id === 'learn') {
            setMode(id)
            home()
          } else go(id as Page)
        }}
      />
    </div>
  )

  // ——— لوحة المعلم والمالك ———
  if (staff && roles.mode === 'teach') {
    const tabs = profile.owner ? OWNER_TABS : TEACH_TABS
    const openClass = (code: string) => setRoute({ page: 'class', code })
    switch (route.page) {
      case 'class':
        return <ClassDashboard key={route.code} code={route.code} onBack={home} newAssignment={() => setRoute({ page: 'newAssignment', code: route.code })} />
      case 'newAssignment':
        return (
          <NewAssignment
            code={route.code}
            onBack={() => setRoute({ page: 'class', code: route.code })}
            onDone={() => setRoute({ page: 'class', code: route.code })}
          />
        )
      case 'owner':
        if (profile.owner) return withTabs(tabs, 'owner', <OwnerPanel openClass={openClass} />)
        break
      case 'settings':
        return withTabs(tabs, 'settings', <SettingsScreen go={go} teaching />)
    }
    return withTabs(tabs, 'home', <TeacherHome openClass={openClass} openOwner={() => go('owner')} />)
  }

  // ——— التعلّم: الإعداد الأولي (المستوى ثم عدد الكلمات اليومي) ———
  const tabs = staff ? STAFF_LEARN_TABS : LEARN_TABS
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
    case 'classes':
      if (staff) break
      return withTabs(tabs, 'classes', <Classes openStudentClass={(code) => setRoute({ page: 'studentClass', code })} />)
    case 'studentClass':
      return <StudentClass key={route.code} code={route.code} onBack={() => go('classes')} open={(id) => setRoute({ page: 'doAssignment', code: route.code, id })} />
    case 'doAssignment':
      return <DoAssignment key={route.id} code={route.code} id={route.id} onBack={() => setRoute({ page: 'studentClass', code: route.code })} />
    case 'library':
      return <StoryLibrary onBack={home} open={(storyId) => setRoute({ page: 'story', storyId, back: 'library' })} />
    case 'progress':
      return withTabs(tabs, 'progress', <Progress startQuiz={quiz('progress')} openMistakes={() => go('mistakes')} />)
    case 'mistakes':
      return <Mistakes onBack={() => go('progress')} onPractice={() => quiz('mistakes')('mistakes')} />
    case 'settings':
      return withTabs(tabs, 'settings', <SettingsScreen go={go} />)
    case 'levels':
      return (
        <LevelPicker onDone={() => go('settings')} onBack={() => go('settings')} onPlacement={() => go('placement')} />
      )
    case 'placement':
      return <Placement onBack={() => go('levels')} onChosen={() => go('settings')} />
    case 'daily':
      return <DailyCount onDone={() => go('settings')} onBack={() => go('settings')} />
  }
  return withTabs(
    tabs,
    'home',
    <Home
      go={go}
      startQuiz={quiz('home')}
      openStory={() => setRoute({ page: 'story', back: 'home' })}
      openStudentClass={(code) => setRoute({ page: 'studentClass', code })}
    />,
  )
}
