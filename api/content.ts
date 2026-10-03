// Vercel Function: POST /api/content — توليد محتوى الكلمات (دفعات من 10).
import { handleContent } from '../server/content.js'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const { status, json } = await handleContent(body, process.env)
  return Response.json(json, { status, headers: { 'cache-control': 'no-store' } })
}
