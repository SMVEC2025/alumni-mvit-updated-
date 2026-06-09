import rateLimit from 'express-rate-limit'

const handler = (_req, res) =>
  res.status(429).json({
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
  })

const base = { standardHeaders: true, legacyHeaders: false, handler }

// Tiered limiters matching the API spec.
export const otpLimiter = rateLimit({ ...base, windowMs: 10 * 60 * 1000, max: 3 })
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, max: 8 })
export const writeLimiter = rateLimit({ ...base, windowMs: 60 * 1000, max: 30 })
export const readLimiter = rateLimit({ ...base, windowMs: 60 * 1000, max: 120 })
export const contactLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, max: 3 })
