import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { readLimiter, writeLimiter, userWriteLimiter, userReadLimiter } from '../middleware/rateLimit.js'
import {
  postCreateSchema,
  postUpdateSchema,
  postListQuerySchema,
} from '../validators/postSchemas.js'
import {
  createPost,
  listPosts,
  getPost,
  updatePost,
  deletePost,
  setHidden,
  likePost,
  unlikePost,
} from '../services/postService.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'

const router = Router()

// Only registered alumni (with a profile) may author posts. Staff/admin too.
async function requireRegistered(req, _res, next) {
  if (req.auth.role === 'staff' || req.auth.role === 'admin') return next()
  const profile = await AlumniRegistration.findOne({ userId: req.auth.userId }).select('_id').lean()
  if (!profile) {
    return next(Errors.forbidden('Complete your alumni registration before posting.'))
  }
  next()
}

// GET /posts — feed (paginated, filterable).
router.get(
  '/posts',
  readLimiter,
  requireAuth,
  userReadLimiter,
  validate(postListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    ok(res, await listPosts(req.auth, req.query))
  })
)

// GET /posts/:id — single post.
router.get(
  '/posts/:id',
  readLimiter,
  requireAuth,
  userReadLimiter,
  asyncHandler(async (req, res) => {
    ok(res, { post: await getPost(req.auth, req.params.id) })
  })
)

// POST /posts — create (registered alumni / staff).
router.post(
  '/posts',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(requireRegistered),
  validate(postCreateSchema),
  asyncHandler(async (req, res) => {
    ok(res, { post: await createPost(req.auth.userId, req.body) }, 201)
  })
)

// PATCH /posts/:id — author or staff.
router.patch(
  '/posts/:id',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  validate(postUpdateSchema),
  asyncHandler(async (req, res) => {
    ok(res, { post: await updatePost(req.auth, req.params.id, req.body) })
  })
)

// DELETE /posts/:id — author or staff.
router.delete(
  '/posts/:id',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(async (req, res) => {
    await deletePost(req.auth, req.params.id)
    ok(res, { success: true })
  })
)

// POST /posts/:id/like  /  unlike.
router.post(
  '/posts/:id/like',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(async (req, res) => {
    ok(res, await likePost(req.auth.userId, req.params.id))
  })
)
router.post(
  '/posts/:id/unlike',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(async (req, res) => {
    ok(res, await unlikePost(req.auth.userId, req.params.id))
  })
)

// Staff moderation: hide / unhide.
router.post(
  '/posts/:id/hide',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  requireRole('staff', 'admin'),
  asyncHandler(async (req, res) => {
    console.log(`[MODERATION] ${req.auth.userId} hid post ${req.params.id}`)
    ok(res, await setHidden(req.params.id, true))
  })
)
router.post(
  '/posts/:id/unhide',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  requireRole('staff', 'admin'),
  asyncHandler(async (req, res) => {
    ok(res, await setHidden(req.params.id, false))
  })
)

export default router
