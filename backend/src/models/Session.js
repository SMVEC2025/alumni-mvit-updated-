import mongoose from 'mongoose'

// One document per active refresh token (device). The raw refresh token is
// NEVER stored — only its sha-256 hash. Expired rows auto-delete via TTL index.
const sessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // = refresh-token jti (uuid)
    userId: { type: String, required: true, ref: 'User', index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: null },
    browser: { type: String, default: null },
    platform: { type: String, default: null },
    deviceName: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true, _id: false }
)

// TTL index: Mongo removes the doc once expiresAt passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model('Session', sessionSchema)
