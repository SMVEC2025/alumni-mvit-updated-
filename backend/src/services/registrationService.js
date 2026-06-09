import { AlumniRegistration } from '../models/AlumniRegistration.js'
import { User } from '../models/User.js'
import { findSeedByPhone } from './seedService.js'

// ─────────────────────────────────────────────────────────────────────────────
// alumni_registrations is the ONE alumni collection. It is the source of truth
// AND what the directory / single-profile view / posts read (via toAlumniView).
// There is no separate read-model copy — one document per alumnus, period.
// ─────────────────────────────────────────────────────────────────────────────

// Mongo pincode/phone validators want clean values; coerce empties to null.
function nullIfBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v
}

// The single profile-completion submit. Handles BOTH a brand-new alumni and a
// breach-recovered account the user has just confirmed — the distinction is
// recorded as `source` but the flow is identical. Writes the verified record to
// alumni_registrations; that single write makes the person visible in the
// directory (gated on status:'verified'). Idempotent: re-submitting updates the
// same record.
export async function completeRegistration(userId, payload) {
  const user = await User.findById(userId).select('mobileNumber').lean()
  if (!user) return null
  const phone = user.mobileNumber

  // Was this phone part of the breach seed? Marks source; never shown to user.
  const seed = await findSeedByPhone(phone)
  const source = seed ? 'recovered' : 'new'

  const work = Array.isArray(payload.workExperiences) ? payload.workExperiences : []
  const address = {
    line1: nullIfBlank(payload.address?.line1),
    city: nullIfBlank(payload.address?.city),
    state: nullIfBlank(payload.address?.state),
    country: nullIfBlank(payload.address?.country),
    pincode: nullIfBlank(payload.address?.pincode),
  }

  const fields = {
    name: payload.name,
    email: nullIfBlank(payload.email),
    phone,
    degree: payload.degree,
    department: payload.department,
    yearOfCompletion: payload.yearOfCompletion ?? null,
    rollNumber: nullIfBlank(payload.rollNumber),
    address,
    image: nullIfBlank(payload.image) ?? seed?.prefill?.image ?? null,
    coverImage: nullIfBlank(payload.coverImage) ?? seed?.prefill?.coverImage ?? null,
    linkedinUrl: nullIfBlank(payload.linkedinUrl),
    workExperiences: work,
    showPhone: payload.showPhone ?? true,
    isDisabled: false,
    status: 'verified',
    source,
  }

  const registration = await AlumniRegistration.findOneAndUpdate(
    { userId },
    { $set: fields, $setOnInsert: { userId } },
    // runValidators enforces the model-level degree enum + degree↔department pair
    // guard on this write too (Mongoose skips validators on update by default).
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  )

  return registration
}
