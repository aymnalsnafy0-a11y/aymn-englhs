import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { WordLookup } from './components/WordLookup'
import './index.css'

if (import.meta.env.MODE !== 'artifact') registerSW({ immediate: true })

// عند التضمين داخل صفحة أخرى قد لا تحمل <html> اتجاه الواجهة.
document.documentElement.lang = 'ar'
document.documentElement.dir = 'rtl'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <WordLookup />
  </StrictMode>,
)
