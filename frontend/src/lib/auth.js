// Auth layer — same public API the app already consumes, now backed by the
// SMVEC Alumni Node backend instead of Supabase.
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeSessionStorageRemove,
} from './safeStorage'
import { api, setAccessToken, clearAccessToken, getAccessToken } from './apiClient'

const USER_KEY = 'smvec_user'
const VERIFIED_AT_KEY = 'smvec_session_verified_at'
const RECOVERY_KEY = 'smvec_profile_prefill'
const VERIFY_CACHE_TTL_MS = 45000

const listeners = new Set()
let _memoryUser = null

function notifyListeners(user) {
  listeners.forEach((fn) => fn(user))
}

function persist(key, value) {
  safeLocalStorageSet(key, value)
  safeSessionStorageSet(key, value)
}
function remove(key) {
  safeLocalStorageRemove(key)
  safeSessionStorageRemove(key)
}

export function normalizeMobile(input = '') {
  return String(input).replace(/\D/g, '').slice(0, 10)
}

export function onAuthChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function saveSession(accessToken, user) {
  if (accessToken) setAccessToken(accessToken)
  persist(USER_KEY, JSON.stringify(user))
  persist(VERIFIED_AT_KEY, String(Date.now()))
  _memoryUser = user
  notifyListeners(user)
}

function clearSession() {
  clearAccessToken()
  remove(USER_KEY)
  remove(VERIFIED_AT_KEY)
  safeSessionStorageRemove(RECOVERY_KEY)
  _memoryUser = null
  notifyListeners(null)
}

// Kept for backward compatibility with callers that read the token directly.
export function getSessionToken() {
  return getAccessToken()
}

export function clearLocalSession() {
  clearSession()
}

export function getUser() {
  try {
    const raw = safeLocalStorageGet(USER_KEY) || safeSessionStorageGet(USER_KEY)
    if (!raw) return _memoryUser
    persist(USER_KEY, raw)
    const parsed = JSON.parse(raw)
    _memoryUser = parsed
    return parsed
  } catch {
    return _memoryUser
  }
}

// ── OTP ──
// turnstileToken is the Cloudflare Turnstile widget response; the backend
// verifies it before sending the SMS. Omitted when Turnstile isn't configured.
export async function sendOtp(mobileNumber, turnstileToken) {
  const cleaned = normalizeMobile(mobileNumber)
  if (!/^\d{10}$/.test(cleaned)) throw new Error('Enter a valid 10-digit mobile number.')
  const body = { mobileNumber: cleaned }
  if (turnstileToken) body.turnstileToken = turnstileToken
  // Returns { challengeToken, expiresInSec } — caller passes challengeToken to verifyOtp.
  return api.post('/auth/otp/send', body)
}

export async function verifyOtp(otp, mobileNumber, token) {
  const trimmed = String(otp || '').trim()
  if (!/^\d{6}$/.test(trimmed)) throw new Error('Please enter the 6-digit OTP.')
  const cleaned = normalizeMobile(mobileNumber)
  const data = await api.post('/auth/otp/verify', {
    mobileNumber: cleaned,
    otp: trimmed,
    challengeToken: token,
  })
  saveSession(data.accessToken, data.user)
  // Stash any pre-fill the server returned so the completion form can show the
  // user their existing details. (Server returns this for any phone with prior
  // data; the UI treats it simply as a pre-filled form — no "recovery" wording.)
  if (data.recovery) {
    safeSessionStorageSet(RECOVERY_KEY, JSON.stringify(data.recovery))
  } else {
    safeSessionStorageRemove(RECOVERY_KEY)
  }
  return data
}

// The profile pre-fill captured at login (or null). Read once by the completion
// form; cleared after a successful submit.
export function getProfilePrefill() {
  try {
    const raw = safeSessionStorageGet(RECOVERY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearProfilePrefill() {
  safeSessionStorageRemove(RECOVERY_KEY)
}

export async function checkMobileStatus(mobileNumber) {
  const cleaned = normalizeMobile(mobileNumber)
  return api.get('/auth/mobile-status', { query: { mobileNumber: cleaned } })
}

export async function login(mobileNumber, password) {
  const cleaned = normalizeMobile(mobileNumber)
  const data = await api.post('/auth/login', { mobileNumber: cleaned, password })
  saveSession(data.accessToken, data.user)
  return data
}

export async function setPassword(mobileNumber, password) {
  // Requires an authenticated session (after OTP verify).
  const data = await api.post('/auth/password/set', { password })
  if (data?.user) saveSession(getAccessToken(), data.user)
  return data
}

export async function changePassword(currentPassword, newPassword) {
  const data = await api.post('/auth/password/change', {
    currentPassword,
    newPassword,
  })
  // change-password revokes other sessions server-side; keep current user.
  if (data?.user) persist(USER_KEY, JSON.stringify(data.user))
  return data
}

export async function logoutAllDevices() {
  try {
    await api.post('/auth/logout-all')
  } finally {
    clearSession()
  }
  return { success: true }
}

export async function listSessions() {
  return api.get('/auth/sessions')
}

export async function revokeSession(revokeSessionId) {
  const data = await api.post(`/auth/sessions/${revokeSessionId}/revoke`)
  if (data?.revokedCurrent) clearSession()
  return data
}

let _verifyPromise = null

export async function verifySession() {
  const token = getAccessToken()
  if (!token) return null
  const cachedUser = getUser()

  const lastVerifiedAt = Math.max(
    Number(safeLocalStorageGet(VERIFIED_AT_KEY) || 0),
    Number(safeSessionStorageGet(VERIFIED_AT_KEY) || 0)
  )
  if (cachedUser && Date.now() - lastVerifiedAt < VERIFY_CACHE_TTL_MS) {
    return cachedUser
  }

  if (_verifyPromise) return _verifyPromise
  _verifyPromise = (async () => {
    try {
      const data = await api.get('/auth/me')
      persist(USER_KEY, JSON.stringify(data.user))
      persist(VERIFIED_AT_KEY, String(Date.now()))
      _memoryUser = data.user
      return data.user
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        clearSession()
        return null
      }
      return getUser() // keep local session on transient errors
    } finally {
      _verifyPromise = null
    }
  })()
  return _verifyPromise
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } catch {
    /* ignore — local logout proceeds regardless */
  }
  clearSession()
}
