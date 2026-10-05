/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import postcss from 'postcss'
import cascadeLayers from '@csstools/postcss-cascade-layers'

/**
 * Tailwind v4 يضع كل التنسيقات داخل @layer، والمتصفحات الأقدم (مثل Safari قبل 15.4) تتجاهلها كلها.
 * بعد البناء نحوّل الطبقات إلى CSS عادي بنفس الأولوية، فيظهر الموقع منسقًا في كل المتصفحات.
 */
function flattenCssLayers(): Plugin {
  return {
    name: 'flatten-css-layers',
    apply: 'build',
    async generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue
        const result = await postcss([cascadeLayers()]).process(String(file.source), { from: undefined })
        file.source = result.css
      }
    },
  }
}

/** خادم التطوير يخدم /api/* بنفس منطق دوال Vercel، والمفتاح من .env (لا يصل للواجهة). */
const ROUTES: Record<string, [string, string]> = {
  '/api/story': ['/server/story.ts', 'handleStory'],
  '/api/content': ['/server/content.ts', 'handleContent'],
  '/api/topics': ['/server/content.ts', 'handleTopics'],
  '/api/exercises': ['/server/exercises.ts', 'handleExercises'],
}

function devApi(env: Record<string, string>): Plugin {
  return {
    name: 'siyaq-dev-api',
    configureServer(server) {
      for (const [route, [file, handler]] of Object.entries(ROUTES)) server.middlewares.use(route, async (req, res) => {
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
        const mod = await server.ssrLoadModule(file)
        const { status, json } = await mod[handler](body, env)
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(json))
      })
    },
  }
}

// وضع artifact: نسخة للمعاينة على claude.ai — مسارات نسبية وبدون service worker.
export default defineConfig(({ mode }) => ({
  // رقم الإصدار يظهر أسفل الإعدادات (للتأكد أن الجهاز يعمل بآخر نسخة).
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  // متغيرات بلا بادئة VITE_ تبقى في الخادم فقط.
  // BASE_PATH لـ GitHub Pages (الموقع تحت /aymn-englhs/)؛ artifact بمسارات نسبية.
  base: mode === 'artifact' ? './' : (process.env.BASE_PATH ?? '/'),
  build: {
    ...(mode === 'artifact' ? { outDir: 'dist-artifact' } : {}),
    // يعمل على الأجهزة الأقدم أيضًا (مثل آيفون بنظام iOS 14–16 وأندرويد قديم):
    // تُحوَّل الألوان الحديثة (oklch) وصيغ JS الجديدة إلى ما تفهمه هذه المتصفحات.
    target: ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'],
    cssTarget: ['safari14', 'chrome87', 'firefox78', 'edge88'],
    cssMinify: 'lightningcss',
  },
  plugins: [
    devApi(loadEnv(mode, process.cwd(), '')),
    react(),
    tailwindcss(),
    flattenCssLayers(),
    VitePWA({
      registerType: 'autoUpdate',
      disable: mode === 'artifact',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'سياق — كلمات أكسفورد 5000',
        short_name: 'سياق',
        description: 'تعلّم كلمات أكسفورد 5000 بالترتيب حسب المستوى',
        lang: 'ar',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f766e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
}))
