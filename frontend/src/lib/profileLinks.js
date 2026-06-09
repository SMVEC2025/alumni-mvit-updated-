const LINKEDIN_HOST_REGEX = /^(www\.)?linkedin\.com\/.+/i
const LINKEDIN_URL_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/.+/i

export function normalizeLinkedInUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (LINKEDIN_URL_REGEX.test(trimmed)) return trimmed
  if (LINKEDIN_HOST_REGEX.test(trimmed)) return `https://${trimmed}`
  return ''
}

export function isValidLinkedInUrl(value) {
  const trimmed = String(value || '').trim()
  return !trimmed || Boolean(normalizeLinkedInUrl(trimmed))
}
