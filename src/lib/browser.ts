/**
 * متصفحات داخل التطبيقات (إنستقرام، سناب، تيك توك، فيسبوك…): Google يمنع تسجيل الدخول فيها،
 * فننصح بفتح الرابط في Chrome أو Safari (الدخول بالإيميل يعمل فيها عادي).
 */
const APPS: [RegExp, string][] = [
  [/Instagram/i, 'إنستقرام'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'فيسبوك'],
  [/Snapchat/i, 'سناب شات'],
  [/musical_ly|TikTok|BytedanceWebview/i, 'تيك توك'],
  [/WhatsApp/i, 'واتساب'],
  [/Line\//i, 'لاين'],
  [/Twitter|TwitterAndroid/i, 'إكس'],
  [/Telegram/i, 'تيليجرام'],
]

export function inAppBrowser(ua: string): string | null {
  for (const [re, name] of APPS) if (re.test(ua)) return name
  // أندرويد WebView يضع «; wv)»، وآيفون WebView بلا «Safari/».
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return 'تطبيق'
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return 'تطبيق'
  return null
}

export const isAndroid = (ua: string) => /Android/i.test(ua)
export const isIOS = (ua: string) => /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)

/** رابط يفتح الصفحة الحالية في Chrome على أندرويد (من داخل تطبيق آخر). */
export function chromeIntent(url: string): string {
  const u = new URL(url)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`
}
