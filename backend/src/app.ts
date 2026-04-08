import cors from 'cors'
import express from 'express'
import { getDatabaseStatus } from './config/database.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestIdMiddleware, securityHeaders } from './middleware/security.js'
import { createRateLimit } from './middleware/rateLimit.js'
import { createAuthRouter } from './routes/auth.js'
import { createFileRouter } from './routes/files.js'
import { createShareRouter } from './routes/shares.js'
import { getQueueStatus } from './services/queue.js'

export function createApp({
  authRouter = createAuthRouter(),
  fileRouter = createFileRouter(),
  shareRouter = createShareRouter(),
}: {
  authRouter?: ReturnType<typeof createAuthRouter>
  fileRouter?: ReturnType<typeof createFileRouter>
  shareRouter?: ReturnType<typeof createShareRouter>
} = {}) {
  const app = express()
  const authRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'auth' })

  app.disable('x-powered-by')
  app.use(requestIdMiddleware)
  app.use(securityHeaders)
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (origin.match(/^http:\/\/localhost:\d+$/)) {
        return callback(null, true)
      }

      const allowedOrigin = process.env.CORS_ORIGIN
      if (allowedOrigin && origin === allowedOrigin) {
        return callback(null, true)
      }

      if (['http://localhost:5173', 'http://localhost:5175'].includes(origin)) {
        return callback(null, true)
      }

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }))
  app.use(express.json())
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  app.use('/api/auth', authRateLimit, authRouter)
  app.use('/api/files', fileRouter)
  app.use('/api/shares', shareRouter)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: getDatabaseStatus(),
        queue: getQueueStatus(),
      },
    })
  })

  app.get('/ready', (_req, res) => {
    const database = getDatabaseStatus()
    const queue = getQueueStatus()
    const ready = database.connected && queue.connected

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database, queue },
    })
  })

  app.use(errorHandler)

  return app
}
