import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/httpError.js'
import { readLimiter } from '../middleware/rateLimit.js'
import { getPublicPost } from '../services/postService.js'

// Public, unauthenticated endpoints. Everything here is intentionally readable
// without a session. Keep this surface minimal.
const router = Router()

// GET /public/posts/:id — read a single non-hidden blog via a shared link.
router.get(
  '/public/posts/:id',
  readLimiter,
  asyncHandler(async (req, res) => {
    ok(res, { post: await getPublicPost(req.params.id) })
  })
)

export default router
