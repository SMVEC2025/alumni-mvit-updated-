import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/httpError.js'
import { readLimiter } from '../middleware/rateLimit.js'
import { getPublicPost } from '../services/postService.js'

// Public, unauthenticated endpoints. Everything here is intentionally readable
// without a session. Keep this surface minimal.
const router = Router()

// GET /public/posts/:id — read a single non-hidden blog via a shared link.
// Public + shareable, so it's cacheable: short browser/CDN cache with a longer
// stale-while-revalidate window for snappy repeat loads of shared links.
router.get(
  '/public/posts/:id',
  readLimiter,
  asyncHandler(async (req, res) => {
    const post = await getPublicPost(req.params.id)
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    ok(res, { post })
  })
)

export default router
