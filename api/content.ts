// Vercel Function: POST /api/content — توليد محتوى الكلمات (دفعات من 10).
import { handleContent } from '../server/content.js'
import { serve } from '../server/http.js'

export function POST(request: Request): Promise<Response> {
  return serve(request, handleContent)
}
