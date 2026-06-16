import { z } from 'zod'
import { DEGREES, isValidDegreeDepartment } from '../constants/academics.js'

export const mobile = z
  .string()
  .transform((v) => String(v).replace(/\D/g, '').slice(0, 10))
  .refine((v) => /^[0-9]{10}$/.test(v), 'Enter a valid 10-digit mobile number.')

const password = z.string().min(8, 'Password must be at least 8 characters.').max(128)
const otp = z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP.')

// ── Auth ──
// turnstileToken is the Cloudflare Turnstile widget response, verified in
// /otp/send before any SMS is sent. Optional in the schema (so dev without
// Turnstile still validates); enforcement happens in the route when a secret
// key is configured.
export const otpSendSchema = z
  .object({ mobileNumber: mobile, turnstileToken: z.string().max(2048).optional() })
  .strict()
export const otpVerifySchema = z
  .object({ mobileNumber: mobile, otp, challengeToken: z.string().min(1) })
  .strict()
export const loginSchema = z.object({ mobileNumber: mobile, password: z.string().min(1) }).strict()
export const setPasswordSchema = z.object({ password }).strict()
export const changePasswordSchema = z
  .object({ currentPassword: z.string().default(''), newPassword: password })
  .strict()
export const mobileStatusSchema = z.object({ mobileNumber: mobile }).strict()

// ── Alumni profile ──
const yearMax = new Date().getUTCFullYear() + 1
const optStr = (max = 200) => z.string().trim().max(max).optional().nullable()

// The frontend sends snake_case payloads. Accept both snake_case and camelCase
// by normalising keys to camelCase before validation.
const FIELD_ALIASES = {
  first_name: 'firstName',
  last_name: 'lastName',
  linkedin_url: 'linkedinUrl',
  year_of_completion: 'yearOfCompletion',
  roll_number: 'rollNumber',
  work_experiences: 'workExperiences',
  profile_image_url: 'profileImageUrl',
  cover_image_url: 'coverImageUrl',
  show_phone: 'showPhone',
  show_email: 'showEmail',
}

export function normalizeAlumniKeys(body) {
  if (!body || typeof body !== 'object') return body
  const out = {}
  for (const [k, v] of Object.entries(body)) {
    out[FIELD_ALIASES[k] || k] = v
  }
  // Drop fields the client must never set.
  delete out.isDisabled
  delete out.is_disabled
  delete out.userId
  delete out.user_id
  delete out.role
  delete out.id
  return out
}

// Work experience is stored loosely (the UI carries startup fields too).
const workExperience = z
  .object({
    company: optStr(200),
    designation: optStr(200),
    title: optStr(200),
    industry: optStr(120),
    experience: z.coerce.number().min(0).max(80).optional().nullable(),
    isStartup: z.boolean().optional(),
    startupName: optStr(200),
    startupType: optStr(200),
    from: optStr(20),
    to: optStr(20),
  })
  .passthrough()

const alumniFields = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254).optional().nullable(),
    phone: z
      .string()
      .transform((v) => (v ? String(v).replace(/\D/g, '').slice(0, 10) : v))
      .refine((v) => !v || /^[0-9]{10}$/.test(v), 'Phone must be 10 digits.')
      .optional()
      .nullable(),
    showPhone: z.boolean().optional(),
    showEmail: z.boolean().optional(),
    linkedinUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal('')),
    degree: optStr(120),
    department: optStr(120),
    yearOfCompletion: z.coerce.number().int().min(1950).max(yearMax).optional().nullable(),
    rollNumber: optStr(60),
    company: optStr(200),
    designation: optStr(200),
    industry: optStr(120),
    experience: z.coerce.number().min(0).max(80).optional().nullable(),
    // Accept null/undefined (no employment) as well as an array.
    workExperiences: z
      .array(workExperience)
      .max(30)
      .nullish()
      .transform((v) => v ?? []),
    address: optStr(400),
    city: optStr(120),
    state: optStr(120),
    country: optStr(120),
    pincode: z
      .string()
      .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits.')
      .optional()
      .nullable()
      .or(z.literal('')),
    profileImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
    coverImageUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  })
  // Strip unknown keys (e.g. a raw `profileImage` File ref) rather than erroring.
  .strip()

// Cross-field degree/department guard for the flat (edit/create) shape. Because
// an edit can send these independently — and the schema never sees the existing
// record — we require that whenever EITHER degree or department is being set,
// BOTH are set together and form a valid pair. This stops a partial edit from
// leaving an inconsistent degree/department combination on the record.
function refineDegreeDepartment(v, ctx) {
  const hasDegree = v.degree !== undefined && v.degree !== null && v.degree !== ''
  const hasDept = v.department !== undefined && v.department !== null && v.department !== ''
  if (!hasDegree && !hasDept) return // neither touched → nothing to check
  if (!hasDegree) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['degree'], message: 'Select a degree when changing the department.' })
    return
  }
  if (!hasDept) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['department'], message: 'Select a department when changing the degree.' })
    return
  }
  if (!DEGREES.includes(v.degree)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['degree'], message: 'Please select a valid degree.' })
    return
  }
  if (!isValidDegreeDepartment(v.degree, v.department)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['department'], message: 'Please select a valid department for the chosen degree.' })
  }
}

// Both schemas normalise snake_case → camelCase and drop privileged fields
// (isDisabled/userId/role/id) before validation.
export const alumniCreateSchema = z.preprocess(
  normalizeAlumniKeys,
  alumniFields
    .refine((v) => v.firstName && v.lastName, {
      message: 'First and last name are required.',
    })
    .superRefine(refineDegreeDepartment)
)

export const alumniUpdateSchema = z.preprocess(
  normalizeAlumniKeys,
  alumniFields.partial().superRefine(refineDegreeDepartment)
)

// ── Faculty ──
export const facultyCreateSchema = z
  .object({
    employeeId: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(120),
    mobileNumber: mobile,
  })
  .strict()

// ── Contact ──
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    subject: z.string().trim().min(2).max(200),
    message: z.string().trim().min(10).max(5000),
  })
  .strict()

// Open registration (mobile-OTP flow, no roster). The user supplies their own
// name + the profile extras. Creates the registered_alumni record.
export const selfRegisterSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(254).optional().nullable().or(z.literal('')),
    image: z.string().trim().url().optional().nullable().or(z.literal('')),
    linkedinUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal('')),
    companyDetails: z.array(workExperience).max(30).optional().nullable(),
  })
  .strip()

// ── Profile completion (recovery + new-user single form) ──
// The one form every alumni fills after OTP login. EVERY field is required
// except linkedinUrl and workExperiences (occupation). Address must be complete.
// This produces a verified alumni_registrations record.
const requiredStr = (max, label) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max)

export const completeRegistrationSchema = z
  .object({
    name: requiredStr(120, 'Name'),
    email: z.string().trim().toLowerCase().email().max(254).optional().nullable().or(z.literal('')),
    // Degree must be one of the known degrees; department is checked against the
    // chosen degree's list in the cross-field .superRefine below.
    degree: z.enum(DEGREES, { errorMap: () => ({ message: 'Please select a valid degree.' }) }),
    department: requiredStr(120, 'Department'),
    yearOfCompletion: z.coerce
      .number({ required_error: 'Year of completion is required.', invalid_type_error: 'Year of completion is required.' })
      .int()
      .min(1950, 'Year of completion is out of range.')
      .max(yearMax, 'Year of completion is out of range.'),
    rollNumber: requiredStr(60, 'Roll number'),
    address: z.object({
      line1: requiredStr(400, 'Address'),
      city: requiredStr(120, 'City'),
      state: requiredStr(120, 'State'),
      country: requiredStr(120, 'Country'),
      pincode: z
        .string({ required_error: 'Pincode is required.', invalid_type_error: 'Pincode is required.' })
        .trim()
        .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits.'),
    }),
    image: requiredStr(2000, 'Profile photo').url('Profile photo is required.'),
    coverImage: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
    linkedinUrl: z.string().trim().url().max(300).optional().nullable().or(z.literal('')),
    workExperiences: z.array(workExperience).max(30).optional().nullable(),
    showPhone: z.boolean().optional(),
  })
  .strip()
  // Cross-field: the department must belong to the chosen degree.
  .superRefine((v, ctx) => {
    if (!isValidDegreeDepartment(v.degree, v.department)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['department'],
        message: 'Please select a valid department for the chosen degree.',
      })
    }
  })

// ── Directory query ──
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  search: z.string().trim().max(120).optional(),
  dept: z.string().trim().max(120).optional(),
  year: z.coerce.number().int().optional(),
  city: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  sortBy: z.enum(['name', 'company', 'recent']).default('recent'),
  visibility: z.enum(['active', 'disabled']).default('active'),
})
