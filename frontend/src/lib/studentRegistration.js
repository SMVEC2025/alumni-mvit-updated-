// Registration status check — now a single authenticated API call.
import { api } from './apiClient'

export async function isStudentRegistered(user) {
  if (!user) return { registered: false, error: 'Missing user.' }
  try {
    const data = await api.get('/me/registration')
    return { registered: Boolean(data.registered), error: null, alumni: data.alumni || null }
  } catch (err) {
    return { registered: false, error: err?.message || 'Unable to check registration.' }
  }
}
