import { Errors } from '../utils/httpError.js'

// validate(schema, source) — runs a zod schema against req[source], replaces it
// with the parsed (and stripped) value, or throws VALIDATION_ERROR.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }))
      return next(Errors.validation('Please check the highlighted fields.', details))
    }
    req[source] = result.data
    next()
  }
}
