import { AlumniRegistration } from '../models/AlumniRegistration.js'

function escapeRegex(v) {
  return String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build a flexible "contains" regex that tolerates spaces between tokens.
function flexible(value) {
  const compact = String(value || '').trim().replace(/\s+/g, ' ')
  if (!compact) return null
  const tokens = compact.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(escapeRegex)
  const pattern = tokens.length <= 1 ? escapeRegex(compact) : tokens.join('.*')
  return new RegExp(pattern, 'i')
}

// Build the Mongo filter, enforcing visibility rules by role. The directory now
// reads the single alumni_registrations collection, so it also requires
// status:'verified' — unconfirmed/unclaimed people never surface.
function buildQuery({ viewer, params }) {
  const { search, dept, year, city, company, visibility } = params
  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')

  const and = [{ status: 'verified' }]

  // Visibility: non-staff ONLY see enabled profiles. visibility=disabled is
  // staff-only; ignored otherwise.
  if (!isStaff) {
    and.push({ isDisabled: false })
  } else if (visibility === 'disabled') {
    and.push({ isDisabled: true })
  } else {
    and.push({ isDisabled: false })
  }

  if (dept) and.push({ department: flexible(dept) })
  if (year) and.push({ yearOfCompletion: Number(year) })
  if (city) and.push({ 'address.city': flexible(city) })

  if (company) {
    const re = flexible(company)
    and.push({ 'workExperiences.company': re })
  }

  if (search) {
    const re = flexible(search)
    and.push({
      $or: [
        { name: re },
        { email: re },
        { 'workExperiences.company': re },
        { 'workExperiences.designation': re },
        { 'address.city': re },
      ],
    })
  }

  return and.length ? { $and: and } : {}
}

function buildSort(sortBy) {
  if (sortBy === 'name') return { name: 1 }
  if (sortBy === 'company') return { 'workExperiences.0.company': 1, createdAt: -1 }
  return { createdAt: -1, _id: -1 }
}

export async function fetchDirectoryPage(viewer, params) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 50)
  const skip = (page - 1) * limit

  const query = buildQuery({ viewer, params })

  const [rows, total] = await Promise.all([
    AlumniRegistration.find(query).sort(buildSort(params.sortBy)).skip(skip).limit(limit).lean(),
    AlumniRegistration.countDocuments(query),
  ])

  return { rows, total, page, limit, hasMore: skip + rows.length < total }
}

export async function fetchFilterMetadata(viewer) {
  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')
  const match = isStaff ? { status: 'verified' } : { status: 'verified', isDisabled: false }

  const [departments, years] = await Promise.all([
    AlumniRegistration.distinct('department', match),
    AlumniRegistration.distinct('yearOfCompletion', match),
  ])

  return {
    departments: departments.filter(Boolean).sort(),
    years: years.filter(Boolean).sort((a, b) => b - a),
  }
}
