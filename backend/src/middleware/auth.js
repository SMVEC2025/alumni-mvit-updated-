import { verifyAccessToken } from '../utils/jwt.js'
import { Errors } from '../utils/httpError.js'

// Extract a bearer token from the Authorization header or the access cookie.
function extractToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  if (req.cookies?.access_token) return req.cookies.access_token
  return null
}

// requireAuth — populates req.auth = { userId, role }. Fails closed.
export function requireAuth(req, _res, next) {
  const token = extractToken(req)
  if (!token) return next(Errors.unauthenticated())
  try {
    const payload = verifyAccessToken(token)
    req.auth = { userId: payload.sub, role: payload.role || 'alumni' }
    next()
  } catch {
    next(Errors.unauthenticated('Session expired or invalid. Please sign in again.'))
  }
}

// Optional auth — sets req.auth if a valid token is present, else continues.
export function optionalAuth(req, _res, next) {
  const token = extractToken(req)
  if (!token) return next()
  try {
    const payload = verifyAccessToken(token)
    req.auth = { userId: payload.sub, role: payload.role || 'alumni' }
  } catch {
    /* ignore — treat as anonymous */
  }
  next()
}

// requireRole — caller's role must be in the allowed set.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(Errors.unauthenticated())
    if (!roles.includes(req.auth.role)) return next(Errors.forbidden())
    next()
  }
}
