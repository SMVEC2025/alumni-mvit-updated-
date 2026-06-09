import { v4 as uuid } from 'uuid'
import { ContactMessage } from '../models/ContactMessage.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { sendContactEmails } from './emailService.js'

// Persist an encrypted message, then deliver emails in the background.
// Returns the new id immediately; email status is updated asynchronously.
export async function submitContactMessage(payload, meta) {
  const id = uuid()

  await ContactMessage.create({
    _id: id,
    name: encrypt(payload.name),
    email: encrypt(payload.email),
    subject: encrypt(payload.subject),
    message: encrypt(payload.message),
    ipAddress: meta.ip || null,
    userAgent: meta.userAgent || null,
    status: 'received',
  })

  // Fire-and-forget email delivery; record outcome on the row.
  deliver(id, payload).catch((err) => console.error('contact email error:', err?.message))

  return { id, status: 'received' }
}

async function deliver(id, payload) {
  let status = 'emailed'
  let emailError = null
  try {
    await sendContactEmails(payload, id)
  } catch (err) {
    status = 'failed'
    emailError = err instanceof Error ? err.message : String(err)
  }
  await ContactMessage.updateOne({ _id: id }, { $set: { status, emailError } })
}

// Admin-only: list decrypted messages.
export async function listMessages() {
  const rows = await ContactMessage.find().sort({ createdAt: -1 }).limit(500).lean()
  return rows.map((r) => ({
    id: r._id,
    name: safeDecrypt(r.name),
    email: safeDecrypt(r.email),
    subject: safeDecrypt(r.subject),
    message: safeDecrypt(r.message),
    status: r.status,
    emailError: r.emailError,
    createdAt: r.createdAt,
    readAt: r.readAt,
  }))
}

export async function markRead(id) {
  await ContactMessage.updateOne({ _id: id }, { $set: { status: 'read', readAt: new Date() } })
}

export async function deleteMessage(id) {
  await ContactMessage.deleteOne({ _id: id })
}

function safeDecrypt(v) {
  try {
    return decrypt(v)
  } catch {
    return '[decryption failed]'
  }
}
