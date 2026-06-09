import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'

// One document per outstanding email-OTP challenge. Unlike the mobile OTP
// (delegated to an external provider), email OTP is ours to issue and verify —
// so the code is stored here as a sha-256 hash (never plaintext), bounded by a
// TTL index and an attempt counter. The challengeToken is handed to the client
// and echoed back on verify so the flow stays stateless from the client's view.
const emailOtpSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid }, // = challengeToken

    enrollNo: { type: Number, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },

    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true, _id: false }
)

// TTL index: Mongo removes the challenge once it expires.
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const EmailOtp = mongoose.model('EmailOtp', emailOtpSchema)
