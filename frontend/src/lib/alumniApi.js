// Alumni + faculty data operations against the REST API. Replaces the direct
// Supabase table access the pages used to perform.
import { api } from './apiClient'

// Returns the current user's alumni profile (or null) — full owner view.
export async function getMyRegistration() {
  const data = await api.get('/me/registration')
  return { registered: Boolean(data.registered), alumni: data.alumni || null }
}

// Fetch a single alumni profile by id (privacy-stripped by the server).
export async function getAlumniById(id) {
  const data = await api.get(`/alumni/${id}`)
  return data.alumni || null
}

// Create the caller's profile. Accepts snake_case payload (server normalises).
export async function createAlumni(payload) {
  const data = await api.post('/alumni', payload)
  return data.alumni
}

// The single profile-completion submit (recovery + new-user). Sends the full
// reviewed profile; the server requires every field except LinkedIn + work and
// writes a verified alumni_registrations record.
export async function completeRegistration(payload) {
  return api.post('/me/complete-registration', payload)
}

// Update a profile (owner or staff). Accepts snake_case payload.
export async function updateAlumni(id, payload) {
  const data = await api.patch(`/alumni/${id}`, payload)
  return data.alumni
}

// Staff moderation: enable/disable a profile.
export async function setAlumniDisabled(id, disabled) {
  const path = disabled ? `/alumni/${id}/disable` : `/alumni/${id}/enable`
  const data = await api.post(path)
  return data.alumni
}

// Faculty self/admin registration.
export async function createFaculty({ employeeId, name, mobileNumber }) {
  const data = await api.post('/faculty', { employeeId, name, mobileNumber })
  return data.faculty
}
