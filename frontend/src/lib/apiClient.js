// Central API client for the SMVEC Alumni backend.
// - Bearer access token stored in localStorage (mirrored to sessionStorage).
// - Refresh token is an httpOnly cookie managed by the server.
// - On 401, transparently tries one /auth/refresh then retries the request.
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeSessionStorageRemove,
} from './safeStorage'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/+$/, '')
const ACCESS_KEY = 'smvec_access_token'
const REQUEST_TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getAccessToken() {
  return safeLocalStorageGet(ACCESS_KEY) || safeSessionStorageGet(ACCESS_KEY) || null
}

export function setAccessToken(token) {
  if (!token) return clearAccessToken()
  safeLocalStorageSet(ACCESS_KEY, token)
  safeSessionStorageSet(ACCESS_KEY, token)
}

export function clearAccessToken() {
  safeLocalStorageRemove(ACCESS_KEY)
  safeSessionStorageRemove(ACCESS_KEY)
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

let _refreshPromise = null

async function tryRefresh() {
  // Deduplicate concurrent refreshes.
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.data?.accessToken) {
        setAccessToken(data.data.accessToken)
        return data.data.accessToken
      }
      clearAccessToken()
      return null
    } catch {
      return null
    } finally {
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

async function rawRequest(method, path, { body, query, headers = {}, isForm = false, retry = true } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const token = getAccessToken()
  const finalHeaders = { ...headers }
  if (token) finalHeaders.Authorization = `Bearer ${token}`
  if (!isForm && body !== undefined) finalHeaders['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const aborted = err?.name === 'AbortError'
    throw new ApiError(
      aborted ? 'Request timed out. Please check your connection.' : 'Unable to connect. Please try again.',
      0,
      'NETWORK'
    )
  }
  clearTimeout(timeout)

  const payload = await res.json().catch(() => ({}))

  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return rawRequest(method, path, { body, query, headers, isForm, retry: false })
    }
  }

  if (!res.ok || payload?.ok === false) {
    const err = payload?.error || {}
    throw new ApiError(err.message || 'Request failed.', res.status, err.code, err.details)
  }

  return payload?.data ?? {}
}

export const api = {
  get: (path, opts) => rawRequest('GET', path, opts),
  post: (path, body, opts) => rawRequest('POST', path, { ...opts, body }),
  patch: (path, body, opts) => rawRequest('PATCH', path, { ...opts, body }),
  del: (path, opts) => rawRequest('DELETE', path, opts),
  postForm: (path, formData, opts) => rawRequest('POST', path, { ...opts, body: formData, isForm: true }),
}

export { API_BASE }
