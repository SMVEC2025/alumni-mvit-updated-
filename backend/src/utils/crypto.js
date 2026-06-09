import crypto from 'node:crypto'
import { env } from '../config/env.js'

// AES-256-GCM authenticated encryption for contact-message fields at rest.
// Format stored: base64(iv).base64(authTag).base64(ciphertext)
const ALGO = 'aes-256-gcm'

function getKey() {
  const key = Buffer.from(env.CONTACT_ENC_KEY, 'base64')
  if (key.length !== 32) {
    throw new Error('CONTACT_ENC_KEY must decode to exactly 32 bytes (base64 of 32 raw bytes).')
  }
  return key
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`
}

export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.')
  if (!ivB64 || !tagB64 || !dataB64) return ''
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return dec.toString('utf8')
}
