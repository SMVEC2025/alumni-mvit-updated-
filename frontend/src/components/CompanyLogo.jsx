import { useMemo, useState } from 'react'
import { getCompanyLogoEntry } from '../lib/companyLogo'

function CompanyLogo({ company, className = '', fallback = null, alt }) {
  const [failedLogoUrl, setFailedLogoUrl] = useState('')
  const companyEntry = useMemo(() => getCompanyLogoEntry(company), [company])
  const logoUrl = companyEntry?.logoUrl || ''
  const loadError = failedLogoUrl === logoUrl

  if (!logoUrl || loadError) return fallback

  return (
    <img
      src={logoUrl}
      alt={alt || `${companyEntry?.label || company || 'Company'} logo`}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedLogoUrl(logoUrl)}
    />
  )
}

export default CompanyLogo

