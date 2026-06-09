import { Notification } from '../models/Notification.js'
import { Errors } from '../utils/httpError.js'

// Shape a notification document for the client. Snake_case to match the rest
// of the API surface (see postService).
function toView(doc) {
  return {
    id: doc._id,
    type: doc.type,
    actor_id: doc.actorId ?? null,
    actor_name: doc.actorName ?? null,
    post_id: doc.postId ?? null,
    message: doc.message,
    link: doc.link ?? null,
    read: Boolean(doc.read),
    created_at: doc.createdAt,
  }
}

// --- Emit API (called by other services on domain events) -------------------

// Create a notification. Never throws into the caller's main flow — a failed
// notification must not break the action that triggered it (e.g. a like). All
// emit helpers below funnel through here.
async function emit({ recipientId, type, actorId = null, actorName = null, postId = null, message, link = null }) {
  if (!recipientId || !message) return null
  // Don't notify yourself about your own actions.
  if (actorId && String(actorId) === String(recipientId)) return null
  try {
    const doc = await Notification.create({ recipientId, type, actorId, actorName, postId, message, link })
    return doc
  } catch (err) {
    console.error('[notifications] emit failed:', err?.message || err)
    return null
  }
}

// Public, generic emitter for other domain services (contributions, etc.).
// Same fire-and-forget contract: never throws into the caller's flow.
export function emitToUser(opts) {
  return emit(opts)
}

// Someone liked a post — notify the author. Collapses repeat likes: if an
// unread like notification from the same actor on the same post already exists,
// we don't stack another.
export async function notifyPostLiked({ recipientId, actorId, actorName, actorProfileId = null, postId, postTitle }) {
  if (!recipientId || String(actorId) === String(recipientId)) return
  const existing = await Notification.findOne({
    recipientId,
    actorId,
    postId,
    type: 'post_like',
    read: false,
  }).select('_id').lean()
  if (existing) return // already has a pending like notice from this person

  const who = actorName || 'Someone'
  const what = postTitle ? `“${truncate(postTitle, 60)}”` : 'your post'
  await emit({
    recipientId,
    type: 'post_like',
    actorId,
    actorName,
    postId,
    message: `${who} liked your post ${what}.`,
    // Clicking the notification opens the alumnus who liked it — their
    // directory profile — falling back to the post when no profile is linkable.
    link: actorProfileId ? `/directory/alumni/${actorProfileId}` : `/blogs?post=${postId}`,
  })
}

// Staff hid / unhid a post — notify the author.
export async function notifyPostModerated({ recipientId, postId, postTitle, hidden }) {
  const what = postTitle ? `“${truncate(postTitle, 60)}”` : 'your post'
  await emit({
    recipientId,
    type: hidden ? 'post_hidden' : 'post_unhidden',
    postId,
    message: hidden
      ? `Your post ${what} was hidden by a moderator.`
      : `Your post ${what} is visible again.`,
    link: `/blogs?post=${postId}`,
  })
}

// First-time welcome.
export async function notifyWelcome(recipientId) {
  await emit({
    recipientId,
    type: 'welcome',
    message: 'Welcome to the SMVEC Alumni network! Complete your profile and share your first post.',
    link: '/blogs',
  })
}

function truncate(str, n) {
  const s = String(str)
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// --- User-facing read/list API ---------------------------------------------

export async function listNotifications(userId, params = {}) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 15, 1), 50)
  const skip = (page - 1) * limit

  const query = { recipientId: userId }
  if (params.unread) query.read = false

  const [docs, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipientId: userId, read: false }),
  ])

  return {
    rows: docs.map(toView),
    total,
    page,
    limit,
    hasMore: skip + docs.length < total,
    unread_count: unreadCount,
  }
}

export async function getUnreadCount(userId) {
  const count = await Notification.countDocuments({ recipientId: userId, read: false })
  return { unread_count: count }
}

export async function markRead(userId, id) {
  const doc = await Notification.findOneAndUpdate(
    { _id: id, recipientId: userId },
    { read: true },
    { new: true }
  ).lean()
  if (!doc) throw Errors.notFound('Notification not found.')
  return toView(doc)
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { recipientId: userId, read: false },
    { read: true }
  )
  return { updated: res.modifiedCount ?? 0 }
}
