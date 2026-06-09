import { HttpError } from '../utils/httpError.js'
import { env } from '../config/env.js'

// 404 for unmatched routes.
export function notFoundHandler(_req, res) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found.' } })
}

// Central error handler — converts everything to the safe error envelope.
// Internal details are logged, never returned to the client.
export function errorHandler(err, req, res, _next) {
  // Known, intentional errors.
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    })
  }

  // Malformed request body (express.json could not parse it). body-parser sets
  // err.type = 'entity.parse.failed' and err.status = 400. This is a CLIENT
  // error, not a server fault — return a clean 400, never a 500/stack.
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400 && 'body' in err)) {
    return res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON in request body.' },
    })
  }

  // Request body too large (express.json limit exceeded).
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
    })
  }

  // Mongo duplicate key → CONFLICT.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field'
    return res.status(409).json({
      ok: false,
      error: { code: 'CONFLICT', message: `That ${field} is already in use.` },
    })
  }

  // Mongoose validation → VALIDATION_ERROR.
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }))
    return res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid data.', details },
    })
  }

  // Unknown — log full detail server-side, return a generic message.
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({
    ok: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
      ...(env.isProd ? {} : { debug: String(err?.message || err) }),
    },
  })
}
