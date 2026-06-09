import { env } from './config/env.js'
import { connectMongo, disconnectMongo } from './db/mongo.js'
import { buildApp } from './app.js'

async function start() {
  await connectMongo()
  const app = buildApp()

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 SMVEC Alumni API listening on http://localhost:${env.PORT}`)
    console.log(`   env=${env.NODE_ENV}  mongo=${env.MONGODB_URI}`)
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
