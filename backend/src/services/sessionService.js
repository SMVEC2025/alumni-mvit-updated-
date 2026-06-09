import { Session } from '../models/Session.js'
import {
  signAccessToken,
  createRefreshToken,
  hashToken,
  refreshExpiryDate,
} from '../utils/jwt.js'
import { parseUserAgent, clientIp } from '../utils/userAgent.js'

// Issue an access token + a tracked refresh token, recording the device.
export async function issueTokens(user, req) {
  const accessToken = signAccessToken({ userId: user._id, role: user.role })
  const { token: refreshToken, jti, hash } = createRefreshToken({ userId: user._id })
  const meta = parseUserAgent(req.headers['user-agent'])

  await Session.create({
    _id: jti,
    userId: user._id,
    tokenHash: hash,
    expiresAt: refreshExpiryDate(),
    lastSeenAt: new Date(),
    userAgent: req.headers['user-agent'] || null,
    browser: meta.browser,
    platform: meta.platform,
    deviceName: meta.deviceName,
    ip: clientIp(req),
  })

  return { accessToken, refreshToken, sessionId: jti }
}

// Validate a refresh token against its stored hash; returns the session or null.
export async function findValidSession(jti, refreshToken) {
  const session = await Session.findById(jti)
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await session.deleteOne()
    return null
  }
  if (session.tokenHash !== hashToken(refreshToken)) return null
  return session
}

export async function revokeSession(jti) {
  await Session.deleteOne({ _id: jti })
}

export async function revokeAllForUser(userId, exceptJti = null) {
  const query = { userId }
  if (exceptJti) query._id = { $ne: exceptJti }
  await Session.deleteMany(query)
}

export async function listSessions(userId) {
  return Session.find({ userId }).sort({ lastSeenAt: -1 }).lean()
}

export async function touchSession(jti) {
  await Session.updateOne(
    { _id: jti, lastSeenAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
    { $set: { lastSeenAt: new Date() } }
  )
}
