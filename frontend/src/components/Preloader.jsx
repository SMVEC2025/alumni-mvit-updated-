import { useEffect, useState } from 'react'
import { safeSessionStorageGet, safeSessionStorageSet } from '../lib/safeStorage'

const PRELOADER_SHOWN_KEY = 'smvec_preloader_shown'
const PRELOADER_TOTAL_MS = 1600

export default function Preloader() {
  const [isVisible, setIsVisible] = useState(() => {
    return !safeSessionStorageGet(PRELOADER_SHOWN_KEY)
  })

  useEffect(() => {
    if (!isVisible) return

    safeSessionStorageSet(PRELOADER_SHOWN_KEY, '1')

    const timer = setTimeout(() => {
      setIsVisible(false)
    }, PRELOADER_TOTAL_MS)

    return () => clearTimeout(timer)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="preloader-main" aria-live="polite" aria-label="Loading">
      <div className="preloader-spinner" aria-hidden="true" />
    </div>
  )
}

