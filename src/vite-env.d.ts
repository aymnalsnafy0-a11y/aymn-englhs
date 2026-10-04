/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** 1 عند البناء لموقع ثابت بلا خادم (GitHub Pages). */
  readonly VITE_STATIC?: string
}
