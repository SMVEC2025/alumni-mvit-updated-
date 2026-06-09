// Contact form + admin inbox — backed by the REST API.
import { api } from './apiClient'

export async function sendContactMessage({ name, email, subject, message }) {
  return api.post('/contact', { name, email, subject, message })
}

export async function listContactMessages() {
  return api.get('/contact/messages')
}

export async function markMessageRead(id) {
  return api.post(`/contact/messages/${id}/read`)
}

export async function deleteContactMessage(id) {
  return api.del(`/contact/messages/${id}`)
}
