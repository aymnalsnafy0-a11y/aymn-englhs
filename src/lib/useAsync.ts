import { useCallback, useEffect, useState } from 'react'

/** تحميل بيانات غير متزامنة (Firestore) مع حالة التحميل والخطأ وإعادة التحميل. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  const run = useCallback(load, deps)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    run().then(
      (data) => alive && setState({ data, loading: false }),
      (error) => alive && setState({ error, loading: false }),
    )
    return () => {
      alive = false
    }
  }, [run, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

/** رسالة عربية لأخطاء Firestore الشائعة. */
export function cloudErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  if (code === 'signed_out') return 'سجّل الدخول أولًا.'
  if (code === 'teacher_code_not_found') return 'رمز المعلم غير صحيح. تأكد منه مع مالك الموقع.'
  if (code === 'teacher_code_used') return 'هذا الرمز خاص بمعلم آخر. اطلب رمزك من مالك الموقع.'
  if (code === 'teacher_code_expired') return 'انتهت مدة هذا الرمز. اطلب من مالك الموقع تمديدها أو رمزًا جديدًا.'
  if (code === 'student_code_not_found') return 'رمز الطالب غير صحيح. تأكد منه مع معلمك.'
  if (code === 'student_code_used') return 'هذا الرمز خاص بطالب آخر. اطلب رمزك من معلمك.'
  if (code === 'permission-denied') return 'لا توجد صلاحية. تأكد من تحديث قواعد Firestore في مشروعك.'
  if (code === 'not_found') return 'لا يوجد فصل بهذا الرمز. تأكد منه مع المدرس.'
  if (code === 'unavailable' || code === 'auth/network-request-failed') return 'لا يوجد اتصال بالإنترنت.'
  return 'حدث خطأ. حاول مرة أخرى.'
}
