import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Sends notification (→ coordinator) + acknowledgement (→ user). Throws on
// failure so the caller can record status. No-op-throws if SMTP unconfigured.
export async function sendContactEmails(payload, id) {
  if (!env.smtpConfigured) throw new Error('SMTP is not configured.')

  const coordinator = env.COORDINATOR_EMAIL || env.SMTP_USER_ACK
  const shortRef = id.split('-')[0]

  // 1) Notify coordinator (from notify mailbox).
  const notify = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER_NOTIFY, pass: env.SMTP_PASS_NOTIFY },
  })
  await notify.sendMail({
    from: `SMVEC Alumni <${env.SMTP_USER_NOTIFY}>`,
    to: coordinator,
    replyTo: payload.email,
    subject: `[Alumni Contact ${shortRef}] ${payload.subject}`,
    text: `New contact form submission\n\nRef: ${id}\nName: ${payload.name}\nEmail: ${payload.email}\nSubject: ${payload.subject}\n\nMessage:\n${payload.message}`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:600px">
      <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
      <h3 style="color:#37419a">Message</h3>
      <div style="background:#faf9f6;border-left:3px solid #d8a42d;padding:14px 16px;white-space:pre-wrap">${escapeHtml(payload.message)}</div>
    </div>`,
  })

  // 2) Acknowledge the sender (from ack mailbox).
  const ack = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER_ACK, pass: env.SMTP_PASS_ACK },
  })
  await ack.sendMail({
    from: `SMVEC Alumni Coordinator <${env.SMTP_USER_ACK}>`,
    to: payload.email,
    subject: `We received your message — Ref ${shortRef}`,
    text: `Hi ${payload.name},\n\nThank you for reaching out to the SMVEC Alumni Association. We have received your message and will get back to you shortly.\n\nReference: ${shortRef}\nSubject: ${payload.subject}\n${payload.message}\n\nWarm Regards,\nAlumni Coordinator`,
    html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:600px">
      <p>Hi ${escapeHtml(payload.name)},</p>
      <p>We have received your message and the SMVEC Alumni Coordinator will get back to you shortly.</p>
      <p style="color:#777;font-size:12px">Reference: <code>${escapeHtml(shortRef)}</code></p>
      <div style="background:#faf9f6;border:1px solid #d8a42d33;padding:14px 16px">
        <p style="margin:0 0 8px"><strong>${escapeHtml(payload.subject)}</strong></p>
        <div style="white-space:pre-wrap;color:#444">${escapeHtml(payload.message)}</div>
      </div>
      <p style="margin-top:22px;color:#444">Warm Regards,<br/><strong>Alumni Coordinator</strong></p>
    </div>`,
  })
}
