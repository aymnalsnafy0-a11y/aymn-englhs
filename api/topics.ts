// Vercel Function: POST /api/topics — تصنيف الكلمات في مجموعات مواضيع (دفعات من 200).
import { handleTopics } from '../server/content.js'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const { status, json } = await handleTopics(body, process.env)
  return Response.json(json, { status, headers: { 'cache-control': 'no-store' } })
}
