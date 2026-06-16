import rateLimit from 'express-rate-limit'

const handler = (_req, res) =>
  res.status(429).json({
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
  })

const base = { standardHeaders: true, legacyHeaders: false, handler }

// Tiered IP-based limiters (unauthenticated paths and coarse traffic cap).
export const otpLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, max: 7 })

// Per-mobile OTP limiter — keyed on the normalised mobile number from the
// validated request body. Applied after validate() so req.body.mobileNumber
// is guaranteed. Prevents a single number being spammed from many IPs.
export const otpMobileLimiter = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000,
  max: 7,
  keyGenerator: (req) => `otp:mobile:${req.body?.mobileNumber ?? 'unknown'}`,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many OTP requests for this number. Please try again later.' } },
})
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 8 })
export const writeLimiter = rateLimit({ ...base, windowMs: 60 * 1000, max: 30 })
export const readLimiter = rateLimit({ ...base, windowMs: 60 * 1000, max: 120 })
export const contactLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 3 })

// Per-user limiters — keyed on the authenticated userId from req.auth.
// Applied after requireAuth so req.auth is guaranteed to be present.
// These cap per-account abuse regardless of IP rotation.
const userKeyGenerator = (req) => `user:${req.auth?.userId ?? 'anon'}`

export const userWriteLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: userKeyGenerator,
})

export const userReadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userKeyGenerator,
})
