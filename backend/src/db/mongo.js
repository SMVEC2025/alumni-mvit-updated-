import mongoose from 'mongoose'
import { env } from '../config/env.js'

mongoose.set('strictQuery', true)

export async function connectMongo() {
  mongoose.connection.on('connected', () => console.log('✅ MongoDB connected'))
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message))
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'))

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  })
}

export async function disconnectMongo() {
  await mongoose.connection.close()
}
