import { describe, expect, it } from 'vitest'
import { sameOrigin, serve } from './http'

const req = (headers: Record<string, string>) => new Request('https://siyaq.vercel.app/api/story', { method: 'POST', headers, body: '{}' })

describe('sameOrigin', () => {
  it('allows the app itself and non-browser clients, rejects other sites', async () => {
    expect(sameOrigin(req({ origin: 'https://siyaq.vercel.app', host: 'siyaq.vercel.app' }))).toBe(true)
    expect(sameOrigin(req({ host: 'siyaq.vercel.app' }))).toBe(true)
    expect(sameOrigin(req({ origin: 'https://evil.example', host: 'siyaq.vercel.app' }))).toBe(false)
    const res = await serve(req({ origin: 'https://evil.example', host: 'siyaq.vercel.app' }), async () => ({ status: 200, json: {} }))
    expect(res.status).toBe(403)
  })
})
