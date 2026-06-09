import { Faculty } from '../models/Faculty.js'
import { env } from '../config/env.js'

// Resolve a user's role from their mobile number.
// - admin  : mobile in ADMIN_MOBILE_NUMBERS allowlist
// - staff  : mobile present in faculty collection
// - alumni : everyone else
export async function resolveRole(mobileNumber) {
  if (env.adminMobiles.includes(mobileNumber)) return 'admin'
  const faculty = await Faculty.findOne({ mobileNumber }).lean()
  return faculty ? 'staff' : 'alumni'
}
