import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js'
import { facultyCreateSchema } from '../validators/schemas.js'
import { Faculty } from '../models/Faculty.js'

const router = Router()

// POST /faculty — admin-gated. Adding a mobile here grants it staff role,
// so this must NOT be public (privilege escalation otherwise).
router.post(
  '/faculty',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  validate(facultyCreateSchema),
  asyncHandler(async (req, res) => {
    const doc = await Faculty.create(req.body)
    ok(res, { faculty: { id: doc._id, employeeId: doc.employeeId, name: doc.name, mobileNumber: doc.mobileNumber } }, 201)
  })
)

// GET /faculty — staff/admin listing.
router.get(
  '/faculty',
  readLimiter,
  requireAuth,
  requireRole('staff', 'admin'),
  asyncHandler(async (_req, res) => {
    const rows = await Faculty.find().sort({ name: 1 }).lean()
    ok(res, {
      faculty: rows.map((f) => ({
        id: f._id,
        employeeId: f.employeeId,
        name: f.name,
        mobileNumber: f.mobileNumber,
      })),
    })
  })
)

export default router
