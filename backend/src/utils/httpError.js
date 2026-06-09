// Typed application error. Thrown anywhere; caught by the central errorHandler
// which turns it into the standard error envelope. Never leaks internals.
export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const Errors = {
  validation: (message = 'Validation failed', details) =>
    new HttpError(400, 'VALIDATION_ERROR', message, details),
  unauthenticated: (message = 'Authentication required') =>
    new HttpError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have permission to do this') =>
    new HttpError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message),
  conflict: (message = 'Already exists') => new HttpError(409, 'CONFLICT', message),
  rateLimited: (message = 'Too many requests') => new HttpError(429, 'RATE_LIMITED', message),
  otpInvalid: (message = 'OTP is invalid or expired') => new HttpError(400, 'OTP_INVALID', message),
  server: (message = 'Something went wrong') => new HttpError(500, 'SERVER_ERROR', message),
}

export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ ok: true, data })
}
