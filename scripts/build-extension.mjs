// يبني إضافة المتصفح في extension/dist: كل مدخل ملف IIFE مستقل (سكربتات المحتوى لا تدعم import).
import { build } from 'vite'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../extension/', import.meta.url))
const out = `${root}dist`
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const entry of ['content', 'bridge', 'background', 'popup']) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: true,
      lib: { entry: `${root}src/${entry}.ts`, formats: ['iife'], name: `siyaq_${entry}`, fileName: () => `${entry}.js` },
    },
  })
}
cpSync(`${root}public`, out, { recursive: true })
console.log(`extension built → ${out}`)
