import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { contactLimiter, readLimiter, writeLimiter } from '../middleware/rateLimit.js'
import { contactSchema } from '../validators/schemas.js'
import { clientIp } from '../utils/userAgent.js'
import {
  submitContactMessage,
  listMessages,
  markRead,
  deleteMessage,
} from '../services/contactService.js'

const router = Router()

// POST /contact — public contact form (tightly rate-limited).
router.post(
  '/contact',
  contactLimiter,
  validate(contactSchema),
  asyncHandler(async (req, res) => {
    const result = await submitContactMessage(req.body, {
      ip: clientIp(req),
      userAgent: req.headers['user-agent']?.slice(0, 500) || null,
    })
    ok(res, result)
  })
)

// GET /contact/messages — admin inbox (decrypted server-side).
router.get(
  '/contact/messages',
  readLimiter,
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    ok(res, { messages: await listMessages() })
  })
)

// POST /contact/messages/:id/read — admin.
router.post(
  '/contact/messages/:id/read',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await markRead(req.params.id)
    ok(res, { success: true })
  })
)

// DELETE /contact/messages/:id — admin.
router.delete(
  '/contact/messages/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteMessage(req.params.id)
    ok(res, { success: true })
  })
)

export default router
