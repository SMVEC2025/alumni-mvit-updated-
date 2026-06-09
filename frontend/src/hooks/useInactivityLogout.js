import { useEffect, useRef } from 'react'
import { logout } from '../lib/auth'
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from '../lib/safeStorage'

const LAST_ACTIVITY_KEY = 'smvec_last_activity_at'
const ACTIVITY_THROTTLE_MS = 1000
const CHECK_INTERVAL_MS = 15000
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

const activityEvents = [
  'click',
  'keydown',
  'mousemove',
  'scroll',
  'touchstart',
  'pointerdown',
]

function getLastActivityAt() {
  const value = Number(safeLocalStorageGet(LAST_ACTIVITY_KEY) || 0)
  return Number.isFinite(value) ? value : 0
}

function setLastActivityAt(value) {
  safeLocalStorageSet(LAST_ACTIVITY_KEY, String(value))
}

export function useInactivityLogout(user, options = {}) {
  const navigate = options.navigate
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const lastWriteRef = useRef(0)
  const loggingOutRef = useRef(false)

  useEffect(() => {
    if (!user) {
      safeLocalStorageRemove(LAST_ACTIVITY_KEY)
      loggingOutRef.current = false
      return undefined
    }

    const now = Date.now()
    if (!getLastActivityAt()) {
      setLastActivityAt(now)
    }

    const markActivity = () => {
      const currentTime = Date.now()
      if (currentTime - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return
      lastWriteRef.current = currentTime
      setLastActivityAt(currentTime)
    }

    const expireSession = async () => {
      if (loggingOutRef.current) return
      loggingOutRef.current = true
      safeLocalStorageRemove(LAST_ACTIVITY_KEY)
      await logout()
      navigate?.('/login', {
        replace: true,
        state: { reason: 'session-timeout' },
      })
    }

    const checkInactivity = () => {
      const lastActivityAt = getLastActivityAt()
      if (!lastActivityAt) {
        setLastActivityAt(Date.now())
        return
      }

      if (Date.now() - lastActivityAt >= timeoutMs) {
        void expireSession()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity()
      }
    }

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true })
    })
    window.addEventListener('focus', checkInactivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const intervalId = window.setInterval(checkInactivity, CHECK_INTERVAL_MS)
    checkInactivity()

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity)
      })
      window.removeEventListener('focus', checkInactivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(intervalId)
    }
  }, [navigate, timeoutMs, user])
}
