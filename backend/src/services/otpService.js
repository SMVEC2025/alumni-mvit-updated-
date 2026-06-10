import { env } from '../config/env.js'
import { Errors, HttpError } from '../utils/httpError.js'

// OTP is fully delegated to the external provider (smveccallforotp). The
// provider sends the SMS and verifies the code; we only proxy and pass its
// stateless `token` through to the client. No OTP ever lives in our backend.
//
//   POST {OTP_API_URL}/api/send-otp   { mobile_number, college }     (x-api-key)
//     → { status:"success", token } | { status:"error", message, retry_after_seconds? }
//   POST {OTP_API_URL}/api/verify-otp { otp, mobile_number, token, college }
//     → { status:"success" } | { status:"error", message }

// The external OTP provider only has SMS delivery configured (DLT sender +
// template) for the 'smvec' college code. Sending 'mvit' is accepted by the API
// but the SMS is never delivered, so this must stay 'smvec'.
const COLLEGE = 'smvec'

function providerUrl(path) {
  const base = env.OTP_API_URL.replace(/\/+$/, '')
  return `${base}${path}`
}

async function callProvider(path, body) {
  let res
  try {
    res = await fetch(providerUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.OTP_API_AUTH_KEY,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new HttpError(502, 'SERVER_ERROR', 'Unable to reach the OTP service. Please try again.')
  }

  let data = {}
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { message: text }
  }
  return { httpOk: res.ok, data }
}

// Request an OTP. Returns the provider token the client must echo back on verify.
export async function sendOtp(mobileNumber) {
  const { data } = await callProvider('/api/send-otp', {
    mobile_number: mobileNumber,
    college: COLLEGE,
  })

  if (data.status !== 'success' || !data.token) {
    // Surface cooldown info if present.
    if (data.retry_after_seconds) {
      throw new HttpError(429, 'RATE_LIMITED', data.message || 'Please try again shortly.')
    }
    throw new HttpError(502, 'OTP_INVALID', data.message || 'Failed to send OTP. Please try again.')
  }

  return { challengeToken: data.token, expiresInSec: env.OTP_TTL_SEC }
}

// Verify an OTP against the provider using the previously issued token.
export async function verifyOtp(mobileNumber, otp, challengeToken) {
  const { data } = await callProvider('/api/verify-otp', {
    otp,
    mobile_number: mobileNumber,
    token: challengeToken,
    college: COLLEGE,
  })

  if (data.status !== 'success') {
    throw Errors.otpInvalid(data.message || 'OTP is invalid or expired.')
  }
  return true
}
