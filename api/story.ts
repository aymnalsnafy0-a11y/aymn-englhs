// Vercel Function: POST /api/story — المفتاح GEMINI_API_KEY من متغيرات البيئة في Vercel.
import { handleStory } from '../server/story.js'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const { status, json } = await handleStory(body, process.env)
  return Response.json(json, { status, headers: { 'cache-control': 'no-store' } })
}
