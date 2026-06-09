import mongoose from 'mongoose'

// Read-only access to the breach-recovery seed (`alumni_records`). These rows
// were imported from the old Supabase dump. Their `user_id` is the OLD auth id
// and does NOT match the new `users._id`; `phone` is the reliable bridge to the
// person logging in (verified unique + non-null across all seed rows).
//
// Nothing here mentions "recovery" to the client — callers receive a prefill and
// a list of still-missing fields, which simply drives a normal completion form.
const SEED_COLLECTION = 'alumni_records'

function seedCollection() {
  return mongoose.connection.collection(SEED_COLLECTION)
}

// Fields the user MUST end up providing (everything except LinkedIn + work).
// Address is required as a whole (line1 + the four locality parts).
const REQUIRED_TOP = ['name', 'degree', 'department', 'yearOfCompletion', 'rollNumber']
const REQUIRED_ADDRESS = ['line1', 'city', 'state', 'country', 'pincode']

function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
}

// Map a raw alumni_records row (snake_case) to the camelCase prefill the form +
// registration model use.
function toPrefill(row) {
  return {
    name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    degree: row.degree ?? null,
    department: row.department ?? null,
    yearOfCompletion: row.year_of_completion ?? null,
    rollNumber: row.roll_number != null ? String(row.roll_number) : null,
    address: {
      line1: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      country: row.country ?? null,
      pincode: row.pincode != null ? String(row.pincode) : null,
    },
    image: row.profile_image_url ?? null,
    coverImage: row.cover_image_url ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    workExperiences: Array.isArray(row.work_experiences) ? row.work_experiences : [],
    showPhone: row.show_phone ?? true,
  }
}

// Which required fields are still blank in the prefill (drives the "force the
// user to fill these" UX). LinkedIn + work are intentionally never listed.
function computeMissing(prefill) {
  const missing = []
  for (const k of REQUIRED_TOP) if (isBlank(prefill[k])) missing.push(k)
  for (const k of REQUIRED_ADDRESS) if (isBlank(prefill.address?.[k])) missing.push(`address.${k}`)
  if (isBlank(prefill.image)) missing.push('image')
  return missing
}

// Look up the seed row for a phone number. Returns the prefill + missing fields,
// or null when this phone was never part of the breach seed (i.e. a brand new
// user — treat as a normal new registration with an empty form).
export async function findSeedByPhone(phone) {
  if (!phone) return null
  const row = await seedCollection().findOne({ phone: String(phone) })
  if (!row) return null
  const prefill = toPrefill(row)
  return {
    prefill,
    missingFields: computeMissing(prefill),
    source: 'recovered',
  }
}

export { REQUIRED_TOP, REQUIRED_ADDRESS, isBlank }
