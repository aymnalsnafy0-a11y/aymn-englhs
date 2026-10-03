/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** خادم التطوير يخدم /api/story بنفس منطق دالة Vercel، والمفتاح من .env (لا يصل للواجهة). */
function storyApi(env: Record<string, string>): Plugin {
  return {
    name: 'siyaq-story-api',
    configureServer(server) {
      server.middlewares.use('/api/story', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let body: unknown = null
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        } catch {
          /* handled as bad_request */
        }
        const { handleStory } = await server.ssrLoadModule('/server/story.ts')
        const { status, json } = await handleStory(body, env)
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(json))
      })
    },
  }
}

// وضع artifact: نسخة للمعاينة على claude.ai — مسارات نسبية وبدون service worker.
export default defineConfig(({ mode }) => ({
  // متغيرات بلا بادئة VITE_ تبقى في الخادم فقط.
  base: mode === 'artifact' ? './' : '/',
  build: mode === 'artifact' ? { outDir: 'dist-artifact' } : undefined,
  plugins: [
    storyApi(loadEnv(mode, process.cwd(), '')),
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
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}))
