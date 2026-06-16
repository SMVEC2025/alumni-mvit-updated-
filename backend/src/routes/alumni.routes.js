import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { readLimiter, writeLimiter, userWriteLimiter, userReadLimiter } from '../middleware/rateLimit.js'
import { alumniUpdateSchema, completeRegistrationSchema } from '../validators/schemas.js'
import { toAlumniView } from '../utils/privacy.js'
import { completeRegistration } from '../services/registrationService.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'

const router = Router()

// GET /me/registration — is the caller registered + their profile.
// alumni_registrations is the single source of truth; "registered" and the
// profile both come from it.
router.get(
  '/me/registration',
  readLimiter,
  requireAuth,
  userReadLimiter,
  asyncHandler(async (req, res) => {
    const doc = await AlumniRegistration.findOne({ userId: req.auth.userId }).lean()
    ok(res, { registered: Boolean(doc), alumni: doc ? toAlumniView(doc, req.auth) : null })
  })
)

// POST /me/complete-registration — the single profile-completion form for the
// mobile-OTP flow. Handles both brand-new alumni and breach-recovered accounts
// the user is confirming (server decides which via phone↔seed match). Every
// field except LinkedIn + work experience is required. Writes the one verified
// alumni_registrations record, which is what the directory then shows.
router.post(
  '/me/complete-registration',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  validate(completeRegistrationSchema),
  asyncHandler(async (req, res) => {
    const registration = await completeRegistration(req.auth.userId, req.body)
    if (!registration) throw Errors.unauthenticated()
    ok(res, { registered: true, registration: { name: registration.name, status: registration.status } }, 201)
  })
)

// (Legacy POST /me/register and POST /alumni create routes removed: the single
// /me/complete-registration form is now the only way a profile is created.)

// Map the validated (flat, camelCase) profile-edit payload onto the registration
// document's shape. Frontend still sends/edits flat fields (first_name, city,
// profile_image_url, …); alumniUpdateSchema normalises them to camelCase, and
// here they fold into the canonical nested record. Only provided keys are set
// (partial update), so an edit of one field never wipes the rest.
function applyEditToRegistration(doc, updates) {
  const has = (k) => Object.prototype.hasOwnProperty.call(updates, k)

  // Name: the frontend edits first/last; the record stores a single name.
  if (has('firstName') || has('lastName')) {
    const first = has('firstName') ? updates.firstName : (doc.name || '').split(' ')[0]
    const last = has('lastName') ? updates.lastName : (doc.name || '').split(' ').slice(1).join(' ')
    doc.name = [first, last].filter((p) => p && p !== '-').join(' ').trim() || doc.name
  }

  if (has('email')) doc.email = updates.email || null
  if (has('linkedinUrl')) doc.linkedinUrl = updates.linkedinUrl || null
  if (has('degree')) doc.degree = updates.degree || null
  if (has('department')) doc.department = updates.department || null
  if (has('yearOfCompletion')) doc.yearOfCompletion = updates.yearOfCompletion ?? null
  if (has('rollNumber')) doc.rollNumber = updates.rollNumber || null
  if (has('showPhone')) doc.showPhone = Boolean(updates.showPhone)
  if (has('showEmail')) doc.showEmail = Boolean(updates.showEmail)
  if (has('profileImageUrl')) doc.image = updates.profileImageUrl || null
  if (has('coverImageUrl')) doc.coverImage = updates.coverImageUrl || null
  if (has('workExperiences')) doc.workExperiences = Array.isArray(updates.workExperiences) ? updates.workExperiences : []

  // Address parts fold into the nested object.
  const addr = doc.address || {}
  if (has('address')) addr.line1 = updates.address || null
  if (has('city')) addr.city = updates.city || null
  if (has('state')) addr.state = updates.state || null
  if (has('country')) addr.country = updates.country || null
  if (has('pincode')) addr.pincode = updates.pincode || null
  doc.address = addr
}

// PATCH /alumni/:id — owner or staff edits the one canonical record.
router.patch(
  '/alumni/:id',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  validate(alumniUpdateSchema),
  asyncHandler(async (req, res) => {
    const doc = await AlumniRegistration.findById(req.params.id)
    if (!doc) throw Errors.notFound('Profile not found.')

    const isStaff = req.auth.role === 'staff' || req.auth.role === 'admin'
    const isOwner = String(doc.userId) === String(req.auth.userId)
    if (!isOwner && !isStaff) throw Errors.forbidden('You can only edit your own profile.')

    // Phone stays tied to the login mobile number — it can't be changed here.
    const updates = { ...req.body }
    delete updates.phone

    applyEditToRegistration(doc, updates)
    await doc.save()
    ok(res, { alumni: toAlumniView(doc.toObject(), req.auth) })
  })
)

// POST /alumni/:id/disable — staff moderation.
router.post(
  '/alumni/:id/disable',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  requireRole('staff', 'admin'),
  asyncHandler(async (req, res) => {
    const doc = await AlumniRegistration.findByIdAndUpdate(req.params.id, { isDisabled: true }, { new: true }).lean()
    if (!doc) throw Errors.notFound('Profile not found.')
    console.log(`[MODERATION] ${req.auth.userId} disabled alumni ${doc._id}`)
    ok(res, { alumni: toAlumniView(doc, req.auth) })
  })
)

// POST /alumni/:id/enable — staff moderation.
router.post(
  '/alumni/:id/enable',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  requireRole('staff', 'admin'),
  asyncHandler(async (req, res) => {
    const doc = await AlumniRegistration.findByIdAndUpdate(req.params.id, { isDisabled: false }, { new: true }).lean()
    if (!doc) throw Errors.notFound('Profile not found.')
    console.log(`[MODERATION] ${req.auth.userId} enabled alumni ${doc._id}`)
    ok(res, { alumni: toAlumniView(doc, req.auth) })
  })
)

export default router
