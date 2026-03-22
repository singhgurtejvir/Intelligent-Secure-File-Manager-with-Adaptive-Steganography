import { Router, Request, Response } from 'express'
import { User } from '../models/User.js'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateRecoveryKey,
} from '../utils/auth.js'

type UserDocument = {
  _id?: { toString(): string } | string
  email: string
  passwordHash: string
  recoveryKey: string
  save(): Promise<void>
}

type UserModelContract = {
  findOne(query: { email: string }): { exec(): Promise<UserDocument | null> }
  new (payload: {
    email: string
    passwordHash: string
    recoveryKey: string
  }): UserDocument
}

export function createAuthRouter({ userModel = User as unknown as UserModelContract } = {}) {
  const router = Router()

  // POST /api/auth/register - Register new user
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
      const password = typeof req.body.password === 'string' ? req.body.password : ''

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }

      // Check if user already exists
      const existingUser = await userModel.findOne({ email }).exec()
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' })
      }

      // Hash password and generate recovery key
      const passwordHash = await hashPassword(password)
      const recoveryKey = generateRecoveryKey()

      // Create user
      const user = new userModel({
        email,
        passwordHash,
        recoveryKey,
      })

      await user.save()

      // Generate JWT token
      const token = generateToken(user._id!.toString(), user.email)

      res.status(201).json({
        userId: user._id,
        email: user.email,
        recoveryKey,
        token,
        expiresIn: 604800, // 7 days in seconds
      })
    } catch (error) {
      console.error('Registration error:', error)
      res.status(500).json({ error: 'Registration failed' })
    }
  })

  // POST /api/auth/login - Login user
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
      const password = typeof req.body.password === 'string' ? req.body.password : ''

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }

      // Find user
      const user = await userModel.findOne({ email }).exec()
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      // Verify password
      const passwordValid = await verifyPassword(password, user.passwordHash)
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      // Generate JWT token
      const token = generateToken(user._id!.toString(), user.email)

      res.json({
        userId: user._id,
        email: user.email,
        token,
        expiresIn: 604800, // 7 days in seconds
      })
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({ error: 'Login failed' })
    }
  })

  return router
}

const router = createAuthRouter()

export default router
