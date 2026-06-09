// Notifications API — feed, unread badge, and read-state updates.
import { api } from './apiClient'

export async function fetchNotifications({ page = 1, limit = 15, unread } = {}) {
  const query = { page, limit }
  if (unread) query.unread = true
  return api.get('/notifications', { query })
}

export async function fetchUnreadCount() {
  const data = await api.get('/notifications/unread-count')
  return data.unread_count ?? 0
}

export async function markNotificationRead(id) {
  const data = await api.post(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  const data = await api.post('/notifications/read-all')
  return data
}
