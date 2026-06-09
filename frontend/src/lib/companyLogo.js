import { companies } from '../data/suggestions'

const normalizeCompanyName = (value) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/['`".,]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const simplifyCompanyName = (value) => normalizeCompanyName(value)
  .replace(/\b(inc|ltd|llc|corp|corporation|company|co|group|private|pvt|limited|technologies|technology)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const byNormalized = new Map()
const bySimplified = new Map()
const catalog = []

for (const entry of companies) {
  const label = typeof entry === 'string' ? entry : entry?.label
  const domain = typeof entry === 'object' ? entry?.domain : ''
  const logoUrl = typeof entry === 'object' ? (entry?.logo_url || (domain ? `https://img.logo.dev/${domain}?token=pk_aEaIVlgYQ8WHNSlREeczoQ` : '')) : ''
  if (!label) continue

  const normalized = normalizeCompanyName(label)
  const simplified = simplifyCompanyName(label)
  const payload = { label, domain, logoUrl }

  catalog.push(payload)
  if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, payload)
  if (simplified && !bySimplified.has(simplified)) bySimplified.set(simplified, payload)
}

export function getCompanyLogoEntry(companyName) {
  const normalized = normalizeCompanyName(companyName)
  if (!normalized) return null

  if (byNormalized.has(normalized)) return byNormalized.get(normalized)

  const simplified = simplifyCompanyName(companyName)
  if (simplified && bySimplified.has(simplified)) return bySimplified.get(simplified)

  for (const entry of catalog) {
    const target = normalizeCompanyName(entry.label)
    if (target && (normalized.includes(target) || target.includes(normalized))) {
      return entry
    }
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    const domain = normalized
    return { label: companyName, domain, logoUrl: `https://img.logo.dev/${domain}?token=pk_aEaIVlgYQ8WHNSlREeczoQ` }
  }

  return null
}

export function getCompanyLogoUrl(companyName) {
  return getCompanyLogoEntry(companyName)?.logoUrl || ''
}

