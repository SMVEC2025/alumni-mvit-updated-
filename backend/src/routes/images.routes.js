import { Router } from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok, Errors } from '../utils/httpError.js'
import { requireAuth } from '../middleware/auth.js'
import { writeLimiter, userWriteLimiter } from '../middleware/rateLimit.js'
import { detectImageType, uploadImage } from '../services/storageService.js'

const router = Router()

const MAX_BYTES = 3 * 1024 * 1024
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
})

// POST /images — multipart: file + kind(profile|cover|post). Auth required.
router.post(
  '/images',
  writeLimiter,
  requireAuth,
  userWriteLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const kind = String(req.body?.kind || 'profile').toLowerCase()
    if (!['profile', 'cover', 'post'].includes(kind)) throw Errors.validation('Invalid upload kind.')
    if (!req.file) throw Errors.validation('Image file is required.')

    // Trust magic bytes, not the declared MIME type.
    const realType = detectImageType(req.file.buffer)
    if (!realType) throw Errors.validation('Only JPG, PNG, and WEBP images are allowed.')

    const { key, publicUrl } = await uploadImage({
      userId: req.auth.userId,
      kind,
      buffer: req.file.buffer,
      contentType: realType,
      uniqueId: kind === 'post' ? uuid() : undefined,
    })

    ok(res, { key, publicUrl, kind })
  })
)

// Multer-specific error (file too large) → clean message.
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Image must be 3MB or less.' } })
    }
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Upload failed.' } })
  }
  next(err)
})

export default router
