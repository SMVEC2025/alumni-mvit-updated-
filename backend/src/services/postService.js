import { Post } from '../models/Post.js'
import { PostLike } from '../models/PostLike.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'
import { Errors } from '../utils/httpError.js'
import { notifyPostLiked, notifyPostModerated } from './notificationService.js'

function escapeRegex(v) {
  return String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build the author display block (name + photo + headline) for a set of posts,
// keyed by authorId. The author's email/phone are NEVER included.
async function authorMap(authorIds) {
  const ids = [...new Set(authorIds.filter(Boolean))]
  if (!ids.length) return {}
  const profiles = await AlumniRegistration.find({ userId: { $in: ids } })
    .select('userId name workExperiences image isDisabled')
    .lean()
  const map = {}
  for (const p of profiles) {
    const firstJob = Array.isArray(p.workExperiences) ? p.workExperiences[0] : null
    map[p.userId] = {
      id: p.userId,
      // The author's alumni profile id — used to deep-link to their directory
      // profile (/directory/alumni/:profile_id). Null/absent when the profile
      // is disabled so the UI won't link to a hidden profile.
      profile_id: p.isDisabled ? null : p._id,
      name: p.name || 'Alumni',
      headline: [firstJob?.designation, firstJob?.company].filter(Boolean).join(' at ') || null,
      profile_image_url: p.image ?? null,
    }
  }
  return map
}

// Shape a post for output. `liked` reflects whether the viewer liked it.
function toPostView(doc, author, liked, viewer) {
  const isAuthor = viewer && String(viewer.userId) === String(doc.authorId)
  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')
  return {
    id: doc._id,
    title: doc.title,
    body: doc.body,
    cover_image_url: doc.coverImageUrl ?? null,
    tags: doc.tags ?? [],
    like_count: doc.likeCount ?? 0,
    liked: Boolean(liked),
    is_hidden: doc.isHidden ?? false,
    author: author || { id: doc.authorId, name: 'Alumni', headline: null, profile_image_url: null },
    can_edit: Boolean(isAuthor),
    can_moderate: Boolean(isStaff),
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

export async function createPost(authorId, data) {
  const doc = await Post.create({
    authorId,
    title: data.title,
    body: data.body,
    coverImageUrl: data.coverImageUrl || null,
    tags: data.tags || [],
  })
  const authors = await authorMap([authorId])
  return toPostView(doc.toObject(), authors[authorId], false, { userId: authorId })
}

export async function listPosts(viewer, params) {
  const page = Math.max(Number(params.page) || 1, 1)
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 20)
  const skip = (page - 1) * limit
  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')

  const and = []
  // Non-staff never see hidden posts (except their own — authors keep seeing theirs).
  if (!isStaff) {
    and.push({ $or: [{ isHidden: false }, { authorId: viewer?.userId }] })
  }
  if (params.tag) and.push({ tags: params.tag })
  if (params.author) and.push({ authorId: params.author })
  if (params.mine && viewer?.userId) and.push({ authorId: viewer.userId })
  if (params.search) {
    const re = new RegExp(escapeRegex(params.search), 'i')
    and.push({ $or: [{ title: re }, { body: re }, { tags: re }] })
  }
  const query = and.length ? { $and: and } : {}

  const [docs, total] = await Promise.all([
    Post.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(query),
  ])

  const authors = await authorMap(docs.map((d) => d.authorId))
  const likedSet = await likedPostIds(viewer?.userId, docs.map((d) => d._id))

  return {
    rows: docs.map((d) => toPostView(d, authors[d.authorId], likedSet.has(d._id), viewer)),
    total,
    page,
    limit,
    hasMore: skip + docs.length < total,
  }
}

export async function getPost(viewer, id) {
  const doc = await Post.findById(id).lean()
  if (!doc) throw Errors.notFound('Post not found.')

  const isStaff = viewer && (viewer.role === 'staff' || viewer.role === 'admin')
  const isAuthor = viewer && String(viewer.userId) === String(doc.authorId)
  if (doc.isHidden && !isStaff && !isAuthor) throw Errors.notFound('Post not found.')

  const authors = await authorMap([doc.authorId])
  const likedSet = await likedPostIds(viewer?.userId, [doc._id])
  return toPostView(doc, authors[doc.authorId], likedSet.has(doc._id), viewer)
}

// Public, read-only view of a single post — for shared links (no login).
// Only non-hidden posts are returned. Author identity is name/photo/headline
// only; contact details are never exposed. No like/edit/moderate flags.
export async function getPublicPost(id) {
  const doc = await Post.findById(id).lean()
  if (!doc || doc.isHidden) throw Errors.notFound('Post not found.')

  const authors = await authorMap([doc.authorId])
  const author = authors[doc.authorId] || { name: 'SMVEC Alumni', headline: null, profile_image_url: null }
  return {
    id: doc._id,
    title: doc.title,
    body: doc.body,
    cover_image_url: doc.coverImageUrl ?? null,
    tags: doc.tags ?? [],
    like_count: doc.likeCount ?? 0,
    author: { name: author.name, headline: author.headline, profile_image_url: author.profile_image_url },
    created_at: doc.createdAt,
  }
}

export async function updatePost(viewer, id, data) {
  const doc = await Post.findById(id)
  if (!doc) throw Errors.notFound('Post not found.')
  const isStaff = viewer.role === 'staff' || viewer.role === 'admin'
  const isAuthor = String(doc.authorId) === String(viewer.userId)
  if (!isAuthor && !isStaff) throw Errors.forbidden('You can only edit your own posts.')

  if (data.title !== undefined) doc.title = data.title
  if (data.body !== undefined) doc.body = data.body
  if (data.coverImageUrl !== undefined) doc.coverImageUrl = data.coverImageUrl || null
  if (data.tags !== undefined) doc.tags = data.tags
  await doc.save()

  const authors = await authorMap([doc.authorId])
  const likedSet = await likedPostIds(viewer.userId, [doc._id])
  return toPostView(doc.toObject(), authors[doc.authorId], likedSet.has(doc._id), viewer)
}

export async function deletePost(viewer, id) {
  // Only the author id is needed for the ownership check before delete — no need
  // to pull the full post body/tags/cover into memory.
  const doc = await Post.findById(id).select('authorId').lean()
  if (!doc) throw Errors.notFound('Post not found.')
  const isStaff = viewer.role === 'staff' || viewer.role === 'admin'
  const isAuthor = String(doc.authorId) === String(viewer.userId)
  if (!isAuthor && !isStaff) throw Errors.forbidden('You can only delete your own posts.')

  await Promise.all([Post.deleteOne({ _id: id }), PostLike.deleteMany({ postId: id })])
}

// Staff-only moderation: hide / unhide.
export async function setHidden(id, hidden) {
  const doc = await Post.findByIdAndUpdate(id, { isHidden: hidden }, { new: true }).lean()
  if (!doc) throw Errors.notFound('Post not found.')
  // Let the author know their post was moderated.
  notifyPostModerated({
    recipientId: doc.authorId,
    postId: doc._id,
    postTitle: doc.title,
    hidden,
  }).catch(() => {})
  return { id: doc._id, is_hidden: doc.isHidden }
}

export async function likePost(userId, id) {
  const post = await Post.findById(id).select('_id isHidden authorId title').lean()
  if (!post) throw Errors.notFound('Post not found.')
  let isNewLike = false
  try {
    await PostLike.create({ postId: id, userId })
    await Post.updateOne({ _id: id }, { $inc: { likeCount: 1 } })
    isNewLike = true
  } catch (err) {
    if (err?.code !== 11000) throw err // already liked → idempotent no-op
  }
  // Notify the author on a genuinely new like (not a repeat / self-like).
  if (isNewLike && String(post.authorId) !== String(userId)) {
    const actors = await authorMap([userId])
    notifyPostLiked({
      recipientId: post.authorId,
      actorId: userId,
      actorName: actors[userId]?.name || null,
      actorProfileId: actors[userId]?.profile_id || null,
      postId: id,
      postTitle: post.title,
    }).catch(() => {}) // fire-and-forget; never block the like
  }
  const fresh = await Post.findById(id).select('likeCount').lean()
  return { liked: true, like_count: fresh?.likeCount ?? 0 }
}

export async function unlikePost(userId, id) {
  const res = await PostLike.deleteOne({ postId: id, userId })
  if (res.deletedCount) {
    await Post.updateOne({ _id: id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } })
  }
  const fresh = await Post.findById(id).select('likeCount').lean()
  return { liked: false, like_count: fresh?.likeCount ?? 0 }
}

async function likedPostIds(userId, postIds) {
  if (!userId || !postIds.length) return new Set()
  const likes = await PostLike.find({ userId, postId: { $in: postIds } }).select('postId').lean()
  return new Set(likes.map((l) => l.postId))
}
