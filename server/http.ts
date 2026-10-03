/**
 * غلاف مشترك لدوال Vercel: يرفض طلبات المتصفح القادمة من مواقع أخرى (حتى لا تستهلك
 * حصة Gemini المجانية من صفحات غريبة)، ويحلّل JSON ويعيد الاستجابة.
 */
type Handler = (body: unknown, env: NodeJS.ProcessEnv) => Promise<{ status: number; json: unknown }>

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // ليس طلبًا من صفحة ويب (curl، خادم)
  try {
    return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
  } catch {
    return false
  }
}

export async function serve(request: Request, handler: Handler): Promise<Response> {
  const headers = { 'cache-control': 'no-store' }
  if (!sameOrigin(request)) return Response.json({ error: 'forbidden' }, { status: 403, headers })
  const body = await request.json().catch(() => null)
  const { status, json } = await handler(body, process.env)
  return Response.json(json, { status, headers })
}
