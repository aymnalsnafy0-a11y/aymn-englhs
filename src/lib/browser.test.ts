import { describe, expect, it } from 'vitest'
import { chromeIntent, inAppBrowser } from './browser'

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  iosInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0',
  iosWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36',
  snapchat: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 Snapchat/12.90',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
}

describe('inAppBrowser', () => {
  it('lets normal browsers through', () => {
    for (const ua of [UA.iosSafari, UA.iosChrome, UA.androidChrome, UA.desktop]) expect(inAppBrowser(ua)).toBeNull()
  })
  it('spots in-app browsers', () => {
    expect(inAppBrowser(UA.iosInstagram)).toBe('إنستقرام')
    expect(inAppBrowser(UA.snapchat)).toBe('سناب شات')
    expect(inAppBrowser(UA.androidWebView)).toBe('تطبيق')
    expect(inAppBrowser(UA.iosWebView)).toBe('تطبيق')
  })
  it('builds a Chrome intent link', () => {
    expect(chromeIntent('https://a.github.io/app/?x=1')).toBe('intent://a.github.io/app/?x=1#Intent;scheme=https;package=com.android.chrome;end')
  })
})
