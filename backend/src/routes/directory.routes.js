import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { readLimiter } from '../middleware/rateLimit.js'
import { directoryQuerySchema } from '../validators/schemas.js'
import { fetchDirectoryPage, fetchFilterMetadata } from '../services/directoryService.js'
import { toAlumniView, toAlumniViewList } from '../utils/privacy.js'
import { AlumniRegistration } from '../models/AlumniRegistration.js'

const router = Router()

// GET /directory — paginated, filtered, privacy-stripped list.
router.get(
  '/directory',
  readLimiter,
  requireAuth,
  validate(directoryQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await fetchDirectoryPage(req.auth, req.query)
    ok(res, {
      rows: toAlumniViewList(result.rows, req.auth),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    })
  })
)

// GET /directory/filters — dropdown metadata (departments, years). Changes
// slowly and is role-scoped, so allow a short PRIVATE cache (per-user browser
// only, never a shared/CDN cache) to cut repeat fetches on navigation.
router.get(
  '/directory/filters',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await fetchFilterMetadata(req.auth)
    res.set('Cache-Control', 'private, max-age=300')
    ok(res, data)
  })
)

// GET /alumni/:id — single profile (privacy-stripped; disabled hidden from non-staff).
router.get(
  '/alumni/:id',
  readLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const doc = await AlumniRegistration.findById(req.params.id).lean()
    if (!doc) throw Errors.notFound('Profile not found.')

    const isStaff = req.auth.role === 'staff' || req.auth.role === 'admin'
    const isOwner = String(doc.userId) === String(req.auth.userId)
    if (doc.isDisabled && !isStaff && !isOwner) throw Errors.notFound('Profile not found.')

    ok(res, { alumni: toAlumniView(doc, req.auth) })
  })
)

export default router
