import { User } from '../models/User.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'
import { resolveRole } from './roleService.js'

// Public-safe shape of a user.
export function toPublicUser(user) {
  return {
    id: user._id,
    // Emit both casings so the frontend (which reads `mobile_number`) and any
    // camelCase consumer both work.
    mobile_number: user.mobileNumber,
    mobileNumber: user.mobileNumber,
    role: user.role,
    hasPassword: Boolean(user.passwordHash),
  }
}

export async function getUserByMobile(mobileNumber) {
  return User.findOne({ mobileNumber })
}

// Get or create a user, keeping role in sync with the faculty/admin source.
export async function ensureUser(mobileNumber) {
  const role = await resolveRole(mobileNumber)
  let user = await User.findOne({ mobileNumber })
  if (user) {
    if (user.role !== role) {
      user.role = role
      await user.save()
    }
    return user
  }
  user = await User.create({ mobileNumber, role, passwordHash: null })
  return user
}

// Re-sync role on each verification (someone promoted to faculty mid-session).
export async function syncRole(user) {
  const role = await resolveRole(user.mobileNumber)
  if (user.role !== role) {
    user.role = role
    await user.save()
  }
  return user
}

// "Registered" means the user has confirmed their profile via the completion
// form, i.e. a verified alumni_registrations record exists. This is the single
// gate for "skip the completion screen" across login redirects and /auth/me —
// it covers both brand-new alumni and breach-recovered, now-confirmed accounts.
export async function isRegistered(userId) {
  const profile = await AlumniRegistration.findOne({ userId }).select('_id').lean()
  return Boolean(profile)
}
