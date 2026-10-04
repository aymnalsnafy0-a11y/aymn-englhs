// Vercel Function: POST /api/exercises — تمارين من ملاحظات الدرس أو صوره.
import { handleExercises } from '../server/exercises.js'
import { serve } from '../server/http.js'

export function POST(request: Request): Promise<Response> {
  return serve(request, handleExercises)
}
