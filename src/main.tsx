import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { WordLookup } from './components/WordLookup'
import './index.css'

// التحديث تلقائي: نبحث عن نسخة جديدة عند العودة للموقع وكل نصف ساعة، فتُطبَّق دون تدخل.
if (import.meta.env.MODE !== 'artifact') {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => {})
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
}

// عند التضمين داخل صفحة أخرى قد لا تحمل <html> اتجاه الواجهة.
document.documentElement.lang = 'ar'
document.documentElement.dir = 'rtl'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <WordLookup />
  </StrictMode>,
)
