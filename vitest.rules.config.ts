import { defineConfig } from 'vitest/config'

// اختبارات قواعد Firestore — تحتاج محاكي Firebase (npm run test:rules).
export default defineConfig({
  test: { include: ['rules-tests/**/*.test.ts'], environment: 'node', testTimeout: 20000, fileParallelism: false },
})
