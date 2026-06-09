import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { v4 as uuid } from 'uuid'
import { env } from '../config/env.js'

// ── Access token: short-lived, carries identity + role. ──
export function signAccessToken({ userId, role }) {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL,
  })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) // throws on invalid/expired
}

// ── Refresh token: long-lived, one-time-use, tracked in `sessions`. ──
// Returns { token, jti, hash } — store the hash, give the client the token.
export function createRefreshToken({ userId }) {
  const jti = uuid()
  const token = jwt.sign({ jti }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.REFRESH_TOKEN_TTL,
  })
  return { token, jti, hash: hashToken(token) }
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET)
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Compute an absolute expiry Date for a ttl string like "30d".
export function refreshExpiryDate() {
  const decoded = jwt.decode(
    jwt.sign({}, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_TOKEN_TTL })
  )
  return new Date(decoded.exp * 1000)
}
