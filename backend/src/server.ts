import dotenv from 'dotenv'
import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/database.js'
import { closeQueue, initQueue } from './services/queue.js'

dotenv.config()

const app = createApp()
const PORT = process.env.PORT || 3000

connectDB().catch((err) => {
  console.warn('MongoDB connection failed:', err.message)
  console.warn('Continuing without database. Some features will be disabled.')
})

initQueue().catch((err) => {
  console.warn('RabbitMQ connection failed:', err.message)
  console.warn('Continuing without message queue. Async processing disabled.')
})

const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully.`)
  server.close(async () => {
    await closeQueue().catch(() => undefined)
    await disconnectDB().catch(() => undefined)
    process.exit(0)
  })
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
