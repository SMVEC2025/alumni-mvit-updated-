import { env } from './config/env.js'
import { connectMongo, disconnectMongo } from './db/mongo.js'
import { buildApp } from './app.js'

async function start() {
  await connectMongo()
  const app = buildApp()

  // Bind to 0.0.0.0 (all interfaces) — required by Cloud Run / containers, which
  // route external traffic to the container's published port. Cloud Run injects
  // PORT (8080); locally it falls back to env default (4000).
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`🚀 SMVEC Alumni API listening on port ${env.PORT} (env=${env.NODE_ENV})`)
  })

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down…`)
    server.close(async () => {
      await disconnectMongo()
      process.exit(0)
    })
    // Force-exit if it hangs.
    setTimeout(() => process.exit(1), 10000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err)
  process.exit(1)
})
