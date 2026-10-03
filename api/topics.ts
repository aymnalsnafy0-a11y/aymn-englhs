// Vercel Function: POST /api/topics — تصنيف الكلمات في مجموعات مواضيع (دفعات من 200).
import { handleTopics } from '../server/content.js'
import { serve } from '../server/http.js'

export function POST(request: Request): Promise<Response> {
  return serve(request, handleTopics)
}
