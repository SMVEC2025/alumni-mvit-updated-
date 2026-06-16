import mongoose from 'mongoose'
import { v4 as uuid } from 'uuid'
import { DEGREES, isValidDegreeDepartment } from '../constants/academics.js'

// Work / employment entry supplied by the user. Optional throughout — a user may
// be a fresher or prefer not to disclose, so none of these block submission.
const workExperienceSchema = new mongoose.Schema(
  {
    company: { type: String, trim: true, default: null },
    designation: { type: String, trim: true, default: null },
    industry: { type: String, trim: true, default: null },
    experience: { type: Number, default: null },
    isStartup: { type: Boolean, default: false },
    startupName: { type: String, trim: true, default: null },
    startupType: { type: String, trim: true, default: null },
  },
  { _id: false }
)

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    state: { type: String, default: null, trim: true },
    country: { type: String, default: null, trim: true },
    pincode: { type: String, default: null, trim: true },
  },
  { _id: false }
)

// The confirmed alumni profile. Written once the user reviews their (possibly
// pre-filled) details and submits the single completion form. Holds BOTH brand
// new alumni (`source: 'new'`) and breach-recovered accounts the user has now
// confirmed (`source: 'recovered'`). Every record here is `status: 'verified'`,
// which is what gates visibility in the public directory.
const alumniRegistrationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuid },

    // One registration per login identity. null for unverified seed records that
    // haven't been claimed by a login yet.
    userId: { type: String, default: null, ref: 'User', sparse: true, index: true },

    // ── Identity (reviewed/entered by the user) ──
    name: { type: String, default: null, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    // (phone uniqueness/index declared once below via schema.index)
    phone: { type: String, default: null },
    // Defense-in-depth: even a direct model write (script / future route that
    // skips the Zod validator) must use a known degree. `null` is allowed so
    // partially-filled / recovered records aren't blocked. The degree↔department
    // PAIR is checked by the document-level validator below (a field-level enum
    // can't express "department must match the chosen degree").
    degree: { type: String, default: null, trim: true, enum: [...DEGREES, null] },
    department: { type: String, default: null, trim: true },
    yearOfCompletion: { type: Number, default: null },
    rollNumber: { type: String, default: null, trim: true },
    address: { type: addressSchema, default: () => ({}) },

    // ── Media + optional extras ──
    image: { type: String, default: null },
    coverImage: { type: String, default: null },
    linkedinUrl: { type: String, default: null, trim: true },
    workExperiences: { type: [workExperienceSchema], default: [] },

    // ── Visibility flags ──
    showPhone: { type: Boolean, default: true },
    showEmail: { type: Boolean, default: true },
    // Staff moderation toggle — disabled profiles are hidden from non-staff in
    // the directory / single-profile view.
    isDisabled: { type: Boolean, default: false, index: true },

    // Always 'verified' once written (the form submit is the verification act).
    status: { type: String, enum: ['unverified', 'verified'], default: 'verified', index: true },
    // 'new'       → no prior breach record matched this phone
    // 'recovered' → matched a row in alumni_records (breach seed), now confirmed
    source: { type: String, enum: ['new', 'recovered'], default: 'new' },
  },
  { timestamps: true, _id: false, collection: 'alumni_registrations' }
)

// ── Directory indexes (this is now the single collection the directory reads) ──
// Uniqueness: email (case-insensitive) and phone, when present.
alumniRegistrationSchema.index({ email: 1 }, { unique: true, sparse: true, collation: { locale: 'en', strength: 2 } })
alumniRegistrationSchema.index({ phone: 1 }, { unique: true, sparse: true })
alumniRegistrationSchema.index({ department: 1, yearOfCompletion: 1 })
alumniRegistrationSchema.index({ createdAt: -1 })
// Directory sort options (directoryService.buildSort): without these, sorting by
// name or company is a full collection scan + in-memory sort.
alumniRegistrationSchema.index({ name: 1 })
alumniRegistrationSchema.index({ 'workExperiences.company': 1, createdAt: -1 })
// Text index powers directory keyword search (name + work + city).
alumniRegistrationSchema.index({
  name: 'text',
  'workExperiences.company': 'text',
  'workExperiences.designation': 'text',
  'address.city': 'text',
})

// Document-level guard for the degree↔department PAIR. Only enforced when BOTH
// are set, so partially-filled / recovered records (null fields) still save.
// Runs on save() and on update operators with `runValidators: true`.
alumniRegistrationSchema.path('department').validate(function validateDepartment(department) {
  // `this` is the doc on save; for findOneAndUpdate it's the query — fall back
  // to the update payload so the pair is still checked on updates.
  const degree = typeof this.get === 'function' ? this.get('degree') : this.getUpdate?.()?.$set?.degree
  if (!degree || !department) return true // partial record — nothing to pair-check
  return isValidDegreeDepartment(degree, department)
}, 'Department does not match the selected degree.')

export const AlumniRegistration = mongoose.model('AlumniRegistration', alumniRegistrationSchema)
