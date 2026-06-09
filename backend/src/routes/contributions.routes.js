import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js'
import {
  contributionCreateSchema,
  contributionUpdateSchema,
  contributionListQuerySchema,
  contributionReviewSchema,
  contributionInterestSchema,
} from '../validators/contributionSchemas.js'
import {
  createContribution,
  listContributions,
  getContribution,
  updateContribution,
  deleteContribution,
  reviewContribution,
  expressInterest,
  withdrawInterest,
  listInterested,
} from '../services/contributionService.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'

const router = Router()

// Only registered alumni (with a profile) may contribute. Staff/admin too.
async function requireRegistered(req, _res, next) {
  if (req.auth.role === 'staff' || req.auth.role === 'admin') return next()
  const profile = await AlumniRegistration.findOne({ userId: req.auth.userId }).select('_id').lean()
  if (!profile) {
    return next(Errors.forbidden('Complete your alumni registration before contributing.'))
  }
  next()
}

// GET /contributions — listing (paginated, filterable).
router.get(
  '/contributions',
  readLimiter,
  requireAuth,
  validate(contributionListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    ok(res, await listContributions(req.auth, req.query))
  })
)

// GET /contributions/:id — single contribution.
router.get(
  '/contributions/:id',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, { contribution: await getContribution(req.auth, req.params.id) })
  })
)

// GET /contributions/:id/interested — who expressed interest (owner/staff only).
router.get(
  '/contributions/:id/interested',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await listInterested(req.auth, req.params.id))
  })
)

// POST /contributions — create (registered alumni / staff). Starts as pending.
router.post(
  '/contributions',
  writeLimiter,
  requireAuth,
  asyncHandler(requireRegistered),
  validate(contributionCreateSchema),
  asyncHandler(async (req, res) => {
    ok(res, { contribution: await createContribution(req.auth.userId, req.body) }, 201)
  })
)

// PATCH /contributions/:id — owner or staff.
router.patch(
  '/contributions/:id',
  writeLimiter,
  requireAuth,
  validate(contributionUpdateSchema),
  asyncHandler(async (req, res) => {
    ok(res, { contribution: await updateContribution(req.auth, req.params.id, req.body) })
  })
)

// DELETE /contributions/:id — owner or staff.
router.delete(
  '/contributions/:id',
  writeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteContribution(req.auth, req.params.id)
    ok(res, { success: true })
  })
)

// POST /contributions/:id/review — staff approve / feature / archive.
router.post(
  '/contributions/:id/review',
  writeLimiter,
  requireAuth,
  requireRole('staff', 'admin'),
  validate(contributionReviewSchema),
  asyncHandler(async (req, res) => {
    console.log(`[CONTRIB REVIEW] ${req.auth.userId} -> ${req.params.id} = ${req.body.status}`)
    ok(res, { contribution: await reviewContribution(req.auth, req.params.id, req.body) })
  })
)

// POST /contributions/:id/interest — express interest.
router.post(
  '/contributions/:id/interest',
  writeLimiter,
  requireAuth,
  validate(contributionInterestSchema),
  asyncHandler(async (req, res) => {
    ok(res, await expressInterest(req.auth.userId, req.params.id, req.body.note))
  })
)

// POST /contributions/:id/withdraw-interest — undo interest.
router.post(
  '/contributions/:id/withdraw-interest',
  writeLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await withdrawInterest(req.auth.userId, req.params.id))
  })
)

export default router
