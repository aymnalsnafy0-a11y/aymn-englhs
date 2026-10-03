/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// وضع artifact: نسخة للمعاينة على claude.ai — مسارات نسبية وبدون service worker.
export default defineConfig(({ mode }) => ({
  base: mode === 'artifact' ? './' : '/',
  build: mode === 'artifact' ? { outDir: 'dist-artifact' } : undefined,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      disable: mode === 'artifact',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'سياق — كلمات أكسفورد 5000',
        short_name: 'سياق',
        description: 'تعلّم كلمات أكسفورد 5000 بالترتيب حسب المستوى',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f766e',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}))
