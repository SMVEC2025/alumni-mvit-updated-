// Server-side privacy enforcement + field-shape mapping.
// The client is NEVER sent contact details the profile owner chose to hide;
// enforced here, not in the UI.
//
// Input is an AlumniRegistration doc (the single source of truth): single
// `name`, nested `address {line1,city,state,country,pincode}`, `image`,
// `coverImage`, `workExperiences[]`. Output uses the snake_case keys the
// frontend data contract expects (first_name, year_of_completion,
// work_experiences, is_disabled, …).

// Split "Jane Q Doe" → { first, last } for the first/last frontend contract.
function splitName(name) {
  const parts = String(name || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function baseView(doc) {
  const { first, last } = splitName(doc.name)
  const addr = doc.address || {}
  // Directory headline pulls from the first work experience.
  const firstJob = Array.isArray(doc.workExperiences) ? doc.workExperiences[0] : null
  return {
    id: doc._id,
    first_name: first,
    last_name: last,
    linkedin_url: doc.linkedinUrl ?? null,
    degree: doc.degree ?? null,
    department: doc.department ?? null,
    year_of_completion: doc.yearOfCompletion ?? null,
    company: firstJob?.company ?? null,
    designation: firstJob?.designation ?? null,
    industry: firstJob?.industry ?? null,
    experience: firstJob?.experience ?? null,
    work_experiences: doc.workExperiences ?? [],
    city: addr.city ?? null,
    state: addr.state ?? null,
    country: addr.country ?? null,
    profile_image_url: doc.image ?? null,
    cover_image_url: doc.coverImage ?? null,
    is_disabled: doc.isDisabled ?? false,
    show_email: doc.showEmail ?? true,
    show_phone: doc.showPhone ?? false,
    created_at: doc.createdAt ?? null,
    updated_at: doc.updatedAt ?? null,
  }
}

/**
 * Shape an alumni doc for output, honouring privacy flags.
 * @param {object} doc     plain alumni object (lean)
 * @param {object} viewer  { userId, role } of the requester (may be null)
 */
export function toAlumniView(doc, viewer = null) {
  if (!doc) return null
  const isOwner = viewer && String(viewer.userId) === String(doc.userId)
  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')

  const out = baseView(doc)

  // Contact details (email + phone) are visible ONLY to the profile owner and
  // to staff/admin. They are NEVER exposed to other alumni — regardless of any
  // show_email / show_phone flag.
  const canSeeContact = isOwner || isStaff
  out.email = canSeeContact ? doc.email ?? null : null
  out.phone = canSeeContact ? doc.phone ?? null : null

  // Owner/staff-only private fields.
  if (isOwner || isStaff) {
    out.user_id = doc.userId ?? null
    out.roll_number = doc.rollNumber ?? null
    out.address = doc.address?.line1 ?? null
    out.pincode = doc.address?.pincode ?? null
  }

  return out
}

export function toAlumniViewList(docs, viewer = null) {
  return (docs || []).map((d) => toAlumniView(d, viewer))
}
