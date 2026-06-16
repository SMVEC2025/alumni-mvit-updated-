import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/httpError.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { readLimiter, writeLimiter, userWriteLimiter, userReadLimiter } from '../middleware/rateLimit.js'
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../services/notificationService.js'

const router = Router()

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  unread: z.coerce.boolean().optional(),
})

// GET /notifications — the current user's notification feed (paginated).
router.get(
  '/notifications',
  readLimiter,
  requireAuth,
  userReadLimiter,
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    ok(res, await listNotifications(req.auth.userId, req.query))
  })
)

// GET /notifications/unread-count — lightweight poll for the navbar badge.
router.get(
  '/notifications/unread-count',
  readLimiter,
  requireAuth,
  userReadLimiter,
  asyncHandler(async (req, res) => {
    ok(res, await getUnreadCount(req.auth.userId))
  })
)

// POST /notifications/read-all — mark every unread notification as read.
router.post(
  '/notifications/read-all',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(async (req, res) => {
    ok(res, await markAllRead(req.auth.userId))
  })
)

// POST /notifications/:id/read — mark a single notification as read.
router.post(
  '/notifications/:id/read',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  asyncHandler(async (req, res) => {
    ok(res, await markRead(req.auth.userId, req.params.id))
  })
)

export default router
