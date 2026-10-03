// Vercel Function: POST /api/story — المفتاح GEMINI_API_KEY من متغيرات البيئة في Vercel.
import { handleStory } from '../server/story.js'
import { serve } from '../server/http.js'

export function POST(request: Request): Promise<Response> {
  return serve(request, handleStory)
}
