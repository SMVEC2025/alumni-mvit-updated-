// Wraps async route handlers so thrown errors reach the central errorHandler
// without try/catch boilerplate in every route.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)
