import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/auth.js'

export interface AuthRequest extends Request {
  userId?: string
  email?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' })
  }
  
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  
  req.userId = decoded.userId
  req.email = decoded.email
  next()
}
