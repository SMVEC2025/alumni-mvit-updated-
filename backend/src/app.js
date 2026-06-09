import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { env } from './config/env.js'
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js'

import authRoutes from './routes/auth.routes.js'
import directoryRoutes from './routes/directory.routes.js'
import alumniRoutes from './routes/alumni.routes.js'
import facultyRoutes from './routes/faculty.routes.js'
import imageRoutes from './routes/images.routes.js'
import contactRoutes from './routes/contact.routes.js'
import postRoutes from './routes/posts.routes.js'
import notificationRoutes from './routes/notifications.routes.js'
import contributionRoutes from './routes/contributions.routes.js'
import publicRoutes from './routes/public.routes.js'

export function buildApp() {
  const app = express()

  // Behind a proxy (nginx/render) so req.ip + rate-limit see the real client.
  app.set('trust proxy', 1)

  // 1) Security headers.
  app.use(helmet())

  // 2) CORS — explicit allowlist only, credentials enabled for cookies.
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl (no Origin header) and allowlisted origins.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true)
        cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  // 3) Parsers (body size cap; uploads handled by multer separately).
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  // 4) Request logging.
  app.use(morgan(env.isProd ? 'combined' : 'dev'))

  // Health check.
  app.get('/api/health', (_req, res) => res.json({ ok: true, data: { status: 'up' } }))

  // 5) Routes.
  app.use('/api/auth', authRoutes)
  app.use('/api', directoryRoutes)
  app.use('/api', alumniRoutes)
  app.use('/api', facultyRoutes)
  app.use('/api', imageRoutes)
  app.use('/api', contactRoutes)
  app.use('/api', postRoutes)
  app.use('/api', notificationRoutes)
  app.use('/api', contributionRoutes)
  app.use('/api', publicRoutes)

  // 6) 404 + central error handler (last).
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
