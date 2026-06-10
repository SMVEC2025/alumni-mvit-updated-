import { Router } from 'express'
import { env } from '../config/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { otpLimiter, authLimiter, readLimiter, writeLimiter } from '../middleware/rateLimit.js'
import {
  otpSendSchema,
  otpVerifySchema,
  loginSchema,
  setPasswordSchema,
  changePasswordSchema,
  mobileStatusSchema,
} from '../validators/schemas.js'
import { sendOtp, verifyOtp } from '../services/otpService.js'
import {
  ensureUser,
  getUserByMobile,
  syncRole,
  toPublicUser,
  isRegistered,
} from '../services/userService.js'
import { resolveRole } from '../services/roleService.js'
import { findSeedByPhone } from '../services/seedService.js'
import {
  issueTokens,
  findValidSession,
  revokeSession,
  revokeAllForUser,
  listSessions,
  touchSession,
} from '../services/sessionService.js'
import { verifyPassword, hashPassword } from '../utils/password.js'
import { verifyRefreshToken } from '../utils/jwt.js'
import { User } from '../models/User.js'

const router = Router()

// SameSite=None requires Secure (browsers drop None cookies without it), so
// force Secure whenever SameSite is 'none' as well as in production. `domain` is
// set only when COOKIE_DOMAIN is configured (e.g. ".yourdomain.com") so the
// refresh cookie is shared across app./api. subdomains; left undefined locally
// for a host-only cookie. See config/env.js.
const refreshCookieOpts = {
  httpOnly: true,
  secure: env.isProd || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  domain: env.cookieDomain,
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('refresh_token', refreshToken, refreshCookieOpts)
  res.cookie('access_token', accessToken, { ...refreshCookieOpts, path: '/', maxAge: 15 * 60 * 1000 })
}

function clearAuthCookies(res) {
  res.clearCookie('refresh_token', { ...refreshCookieOpts })
  res.clearCookie('access_token', { ...refreshCookieOpts, path: '/' })
}

// ── OTP: send ──
router.post(
  '/otp/send',
  otpLimiter,
  validate(otpSendSchema),
  asyncHandler(async (req, res) => {
    const { mobileNumber } = req.body
    const result = await sendOtp(mobileNumber)
    ok(res, {
      challengeToken: result.challengeToken,
      expiresInSec: result.expiresInSec,
    })
  })
)

// ── OTP: verify → login ──
router.post(
  '/otp/verify',
  authLimiter,
  validate(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const { mobileNumber, otp, challengeToken } = req.body
    await verifyOtp(mobileNumber, otp, challengeToken)

    const user = await ensureUser(mobileNumber)
    const { accessToken, refreshToken } = await issueTokens(user, req)
    setAuthCookies(res, accessToken, refreshToken)

    const registered = await isRegistered(user._id)
    // Silent breach-recovery: if this phone exists in the seed and the user has
    // not yet confirmed their profile, hand back the pre-filled data + which
    // fields are still missing. The client renders this as a normal completion
    // form — the word "recovery" never reaches the user. New phones → null.
    let recovery = null
    if (!registered) {
      recovery = await findSeedByPhone(user.mobileNumber)
    }

    ok(res, {
      accessToken,
      user: toPublicUser(user),
      registered,
      recovery,
    })
  })
)

// ── Password login ──
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { mobileNumber, password } = req.body
    const user = await getUserByMobile(mobileNumber)

    // Generic error for both "no user" and "wrong password" — no enumeration.
    const valid = await verifyPassword(password, user?.passwordHash)
    if (!user || !valid) throw Errors.unauthenticated('Invalid mobile number or password.')

    await syncRole(user)
    const { accessToken, refreshToken } = await issueTokens(user, req)
    setAuthCookies(res, accessToken, refreshToken)
    ok(res, { accessToken, user: toPublicUser(user) })
  })
)

// ── Set / create password (after OTP) ──
router.post(
  '/password/set',
  authLimiter,
  requireAuth,
  validate(setPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.userId)
    if (!user) throw Errors.unauthenticated()
    user.passwordHash = await hashPassword(req.body.password)
    await user.save()
    ok(res, { user: toPublicUser(user) })
  })
)

// ── Change password ──
router.post(
  '/password/change',
  authLimiter,
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.auth.userId)
    if (!user) throw Errors.unauthenticated()

    if (user.passwordHash) {
      const okCurrent = await verifyPassword(currentPassword, user.passwordHash)
      if (!okCurrent) throw Errors.unauthenticated('Current password is incorrect.')
    }

    user.passwordHash = await hashPassword(newPassword)
    await user.save()
    // Force re-login on all other devices.
    await revokeAllForUser(user._id)
    clearAuthCookies(res)
    ok(res, { user: toPublicUser(user) })
  })
)

// ── Refresh access token (rotates refresh token) ──
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token
    if (!token) throw Errors.unauthenticated('No refresh token.')

    let payload
    try {
      payload = verifyRefreshToken(token)
    } catch {
      throw Errors.unauthenticated('Refresh token invalid or expired.')
    }

    const session = await findValidSession(payload.jti, token)
    if (!session) {
      // Possible reuse/theft — revoke the family.
      await revokeAllForUser(payload.sub)
      clearAuthCookies(res)
      throw Errors.unauthenticated('Session no longer valid.')
    }

    const user = await User.findById(payload.sub)
    if (!user) throw Errors.unauthenticated()

    // Rotate: drop old session, issue fresh pair.
    await revokeSession(session._id)
    const { accessToken, refreshToken } = await issueTokens(user, req)
    setAuthCookies(res, accessToken, refreshToken)
    ok(res, { accessToken, user: toPublicUser(user) })
  })
)

// ── Current user ──
router.get(
  '/me',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.userId)
    if (!user) throw Errors.unauthenticated()
    await syncRole(user)
    ok(res, { user: toPublicUser(user), registered: await isRegistered(user._id) })
  })
)

// ── Pre-login mobile status (drives login UI) ──
// Read-only, no secret returned — the login page polls this on a debounce as the
// user types, so it needs the generous read limiter (120/min), NOT the strict
// auth limiter (8/15min) which would lock a normal typing/login session out.
router.get(
  '/mobile-status',
  readLimiter,
  validate(mobileStatusSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { mobileNumber } = req.query
    const user = await getUserByMobile(mobileNumber)
    const role = await resolveRole(mobileNumber)
    ok(res, {
      exists: Boolean(user),
      isStaff: role === 'staff' || role === 'admin',
      hasPassword: Boolean(user?.passwordHash),
    })
  })
)

// ── List my sessions ──
router.get(
  '/sessions',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentJti = currentSessionJti(req)
    const sessions = await listSessions(req.auth.userId)
    ok(res, {
      sessions: sessions.map((s) => ({
        id: s._id,
        browser: s.browser,
        platform: s.platform,
        deviceName: s.deviceName,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
        isCurrent: s._id === currentJti,
      })),
    })
  })
)

// ── Revoke one session ──
router.post(
  '/sessions/:id/revoke',
  writeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.auth.userId)
    const target = sessions.find((s) => s._id === req.params.id)
    if (!target) throw Errors.notFound('Session not found.')
    await revokeSession(target._id)
    const revokedCurrent = target._id === currentSessionJti(req)
    if (revokedCurrent) clearAuthCookies(res)
    ok(res, { success: true, revokedCurrent })
  })
)

// ── Logout (current device) ──
router.post(
  '/logout',
  writeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const jti = currentSessionJti(req)
    if (jti) await revokeSession(jti)
    clearAuthCookies(res)
    ok(res, { success: true })
  })
)

// ── Logout all devices ──
router.post(
  '/logout-all',
  writeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeAllForUser(req.auth.userId)
    clearAuthCookies(res)
    ok(res, { success: true })
  })
)

// Resolve the current refresh-token jti (to mark/revoke the current device).
function currentSessionJti(req) {
  const token = req.cookies?.refresh_token
  if (!token) return null
  try {
    return verifyRefreshToken(token).jti
  } catch {
    return null
  }
}

export default router
