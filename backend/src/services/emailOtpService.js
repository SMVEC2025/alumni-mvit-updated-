import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { EmailOtp } from '../models/EmailOtp.js'
import { hashToken } from '../utils/jwt.js'
import { Errors, HttpError } from '../utils/httpError.js'

const CODE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5

// Build the sender transport once. Uses the alumnismvec@smvec.ac.in mailbox
// (SMTP_USER_NOTIFY) with its app password (SMTP_PASS_NOTIFY).
let _transport = null
function transport() {
  if (!env.smtpConfigured) {
    throw new HttpError(503, 'SERVER_ERROR', 'Email service is not configured. Please verify via mobile.')
  }
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER_NOTIFY, pass: env.SMTP_PASS_NOTIFY },
    })
  }
  return _transport
}

// Cryptographically-random 6-digit code (000000–999999).
function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

function otpEmail(code) {
  return {
    subject: `${code} is your MVIT Alumni verification code`,
    text: `Your MVIT Alumni verification code is ${code}. It is valid for 10 minutes. If you did not request this, please ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:480px;margin:auto">
      <h2 style="color:#37419a;margin-bottom:4px">MVIT Alumni</h2>
      <p style="color:#444">Use the verification code below to confirm your identity:</p>
      <div style="font-size:30px;letter-spacing:8px;font-weight:700;color:#37419a;background:#faf9f6;border:1px solid #d8a42d33;border-radius:10px;padding:16px 0;text-align:center;margin:18px 0">${code}</div>
      <p style="color:#777;font-size:13px">This code is valid for <strong>10 minutes</strong>. If you didn't request it, you can safely ignore this email.</p>
    </div>`,
  }
}

// Issue a fresh email OTP for an enrolment record and send it. Returns the
// challengeToken the client echoes back on verify. Any prior unconsumed
// challenges for this enrolment are dropped so only the newest code works.
export async function sendEmailOtp(enrollNo, email) {
  if (!email) throw Errors.validation('No registered email on record for this enrolment.')

  const code = generateCode()
  await EmailOtp.deleteMany({ enrollNo, consumed: false })

  const doc = await EmailOtp.create({
    enrollNo,
    email: String(email).toLowerCase().trim(),
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  })

  const { subject, text, html } = otpEmail(code)
  try {
    await transport().sendMail({
      from: `MVIT Alumni <${env.SMTP_USER_NOTIFY}>`,
      to: email,
      subject,
      text,
      html,
    })
  } catch {
    // Don't leave a dangling challenge the user can never satisfy.
    await EmailOtp.deleteOne({ _id: doc._id })
    throw new HttpError(502, 'SERVER_ERROR', 'Unable to send the verification email. Please try again.')
  }

  return { challengeToken: doc._id, expiresInSec: Math.floor(CODE_TTL_MS / 1000) }
}

// Verify a submitted code against a challenge. Enforces expiry + attempt limit,
// and is single-use (marks the challenge consumed on success).
export async function verifyEmailOtp(enrollNo, code, challengeToken) {
  const doc = await EmailOtp.findById(challengeToken)
  if (!doc || doc.enrollNo !== enrollNo || doc.consumed) {
    throw Errors.otpInvalid('OTP is invalid or expired. Please request a new one.')
  }
  if (doc.expiresAt < new Date()) {
    await EmailOtp.deleteOne({ _id: doc._id })
    throw Errors.otpInvalid('OTP has expired. Please request a new one.')
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    await EmailOtp.deleteOne({ _id: doc._id })
    throw Errors.otpInvalid('Too many incorrect attempts. Please request a new OTP.')
  }

  if (doc.codeHash !== hashToken(String(code))) {
    doc.attempts += 1
    await doc.save()
    const left = MAX_ATTEMPTS - doc.attempts
    throw Errors.otpInvalid(
      left > 0 ? `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} remaining.` : 'Too many incorrect attempts. Please request a new OTP.'
    )
  }

  doc.consumed = true
  await doc.save()
  return true
}
