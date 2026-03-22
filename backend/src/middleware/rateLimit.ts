import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

export function createRateLimit(options: {
  windowMs: number
  maxRequests: number
  keyPrefix: string
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'
    const key = `${options.keyPrefix}:${identifier}`
    const now = Date.now()
    const current = store.get(key)

    if (!current || current.resetAt <= now) {
      const nextWindow = now + options.windowMs
      store.set(key, { count: 1, resetAt: nextWindow })
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', Math.max(options.maxRequests - 1, 0).toString())
      res.setHeader('X-RateLimit-Reset', Math.ceil(nextWindow / 1000).toString())
      return next()
    }

    if (current.count >= options.maxRequests) {
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetAt / 1000).toString())
      return res.status(429).json({ error: 'Too many requests, please try again later' })
    }

    current.count += 1
    store.set(key, current)

    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', Math.max(options.maxRequests - current.count, 0).toString())
    res.setHeader('X-RateLimit-Reset', Math.ceil(current.resetAt / 1000).toString())
    next()
  }
}
