import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

// name/email/subject/message are stored ENCRYPTED (AES-256-GCM) at the service
// layer before insert. This schema holds the ciphertext strings + plaintext
// metadata. Decryption happens only server-side for admins.
const contactMessageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },
    name: { type: String, required: true }, // ciphertext
    email: { type: String, required: true }, // ciphertext
    subject: { type: String, required: true }, // ciphertext
    message: { type: String, required: true }, // ciphertext

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    status: {
      type: String,
      enum: ['received', 'emailed', 'failed', 'read'],
      default: 'received',
      index: true,
    },
    emailError: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false }
)

contactMessageSchema.index({ createdAt: -1 })

export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema)
