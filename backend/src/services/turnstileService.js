import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Errors } from '../utils/httpError.js'

// Cloudflare Turnstile server-side verification. The browser solves the widget
// challenge and sends back a one-time token (cf-turnstile-response); we confirm
// it with Cloudflare's siteverify endpoint BEFORE doing anything expensive (here:
// sending an OTP SMS). A token is single-use and short-lived, so this stops bots
// from hammering /otp/send and burning SMS credits.
//
//   POST https://challenges.cloudflare.com/turnstile/v0/siteverify
//     { secret, response, remoteip? }  →  { success: bool, "error-codes": [...] }
//
// See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// When no secret is configured the check is skipped (returns silently). This
// keeps local/dev environments runnable without Turnstile; production MUST set
// TURNSTILE_SECRET_KEY (env.js warns at boot when it's missing).
export function isTurnstileEnabled() {
  return Boolean(env.TURNSTILE_SECRET_KEY)
}

/**
 * Verify a Turnstile token. Throws an HttpError (400) when the token is missing,
 * invalid, expired, or already used. Resolves silently on success — or when
 * Turnstile is not configured (dev convenience).
 *
 * @param {string} token  the cf-turnstile-response value from the browser
 * @param {string} [remoteIp]  the client IP (optional, improves Cloudflare scoring)
 */
export async function verifyTurnstile(token, remoteIp) {
  if (!isTurnstileEnabled()) return

  if (!token || typeof token !== 'string') {
    throw Errors.validation('Captcha verification is required.')
  }

  const body = new URLSearchParams()
  body.append('secret', env.TURNSTILE_SECRET_KEY)
  body.append('response', token)
  if (remoteIp) body.append('remoteip', remoteIp)

  let data
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    data = await res.json()
  } catch {
    // Network/parse failure talking to Cloudflare — fail closed so a bot can't
    // slip through by knocking siteverify offline.
    throw Errors.validation('Could not verify captcha right now. Please try again.')
  }

  if (!data?.success) {
    throw Errors.validation('Captcha verification failed. Please try again.')
  }
}

// ── "Captcha recently passed" pass ───────────────────────────────────────────
// A Turnstile token is single-use, but we only want to make the user solve the
// challenge ONCE per login attempt — not again on every "Resend OTP". After a
// verified send we mint a short-lived signed pass (a JWT) stored in an httpOnly
// cookie; a follow-up /otp/send accepts that pass instead of a fresh token.
// Per-IP rate limiting (3 sends / 10 min) remains the hard backstop on abuse.
const CAPTCHA_PASS_TTL_SEC = 10 * 60 // matches the otpLimiter window
export const CAPTCHA_PASS_COOKIE = 'captcha_pass'

export function issueCaptchaPass() {
  if (!isTurnstileEnabled()) return null
  return jwt.sign({ kind: 'captcha-pass' }, env.JWT_ACCESS_SECRET, {
    expiresIn: CAPTCHA_PASS_TTL_SEC,
  })
}

export function hasValidCaptchaPass(passToken) {
  if (!passToken) return false
  try {
    const decoded = jwt.verify(passToken, env.JWT_ACCESS_SECRET)
    return decoded?.kind === 'captcha-pass'
  } catch {
    return false
  }
}

export const CAPTCHA_PASS_MAX_AGE_MS = CAPTCHA_PASS_TTL_SEC * 1000
