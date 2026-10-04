/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** 1 عند البناء لموقع ثابت بلا خادم (GitHub Pages). */
  readonly VITE_STATIC?: string
  /** 1 لتوصيل الحساب بمحاكي Firebase المحلي (للاختبار فقط). */
  readonly VITE_FIREBASE_EMULATOR?: string
}
