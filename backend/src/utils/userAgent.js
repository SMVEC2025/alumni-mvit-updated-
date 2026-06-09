export function parseUserAgent(rawUserAgent) {
  const ua = String(rawUserAgent || '')
  const browser = detectBrowser(ua)
  const platform = detectPlatform(ua)
  return { browser, platform, deviceName: `${browser} on ${platform}` }
}

function detectBrowser(ua) {
  if (/edg\//i.test(ua)) return 'Edge'
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome'
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari'
  if (/firefox\//i.test(ua)) return 'Firefox'
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera'
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  return 'Unknown browser'
}

function detectPlatform(ua) {
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os x|macintosh/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown device'
}

export function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['cf-connecting-ip'] ||
    req.ip ||
    null
  )
}
