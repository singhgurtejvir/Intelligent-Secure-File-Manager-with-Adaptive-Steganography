import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import { File } from '../models/File.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'
import { getUploadedFilePath, upload } from '../utils/upload.js'
import { matchesContext } from '../utils/context.js'
import {
  handleFileUpload,
  getFileList,
  deleteFile,
  decryptStoredFile,
} from '../controllers/fileController.js'
import { createRateLimit } from '../middleware/rateLimit.js'

type StoredFile = Parameters<typeof decryptStoredFile>[0] & {
  userId: string
  carrierMimeType?: string
  carrierOriginalName?: string
}

type FileModelContract = {
  findById(id: string): { exec(): Promise<StoredFile | null> }
}

type FileControllerContract = {
  handleFileUpload: typeof handleFileUpload
  getFileList: typeof getFileList
  deleteFile: typeof deleteFile
  decryptStoredFile: typeof decryptStoredFile
}

export function createFileRouter({
  fileModel = File as unknown as FileModelContract,
  fileController = {
    handleFileUpload,
    getFileList,
    deleteFile,
    decryptStoredFile,
  } satisfies FileControllerContract,
}: {
  fileModel?: FileModelContract
  fileController?: FileControllerContract
} = {}) {
  const router = Router()
  const uploadRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'upload' })
  const decryptRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'decrypt' })

  // Protect all routes with authentication
  router.use(authMiddleware)

  // GET /api/files - List all files for user
  router.get('/', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const files = await fileController.getFileList(userId)
      res.json(files)
    } catch (error) {
      console.error('List files error:', error)
      res.status(500).json({ error: 'Failed to fetch files' })
    }
  })

  // POST /api/files/upload - Upload carrier + payload
  router.post(
    '/upload',
    uploadRateLimit,
    upload.fields([
      { name: 'carrier', maxCount: 1 },
      { name: 'payload', maxCount: 1 },
    ]),
    async (req: AuthRequest, res) => {
      try {
        const userId = req.userId!
        const files = req.files as { [fieldname: string]: Express.Multer.File[] }

        // Validate files exist
        if (!files.carrier || !files.payload) {
          return res.status(400).json({ error: 'Both carrier and payload files are required' })
        }

        const carrierFile = files.carrier[0]
        const payloadFile = files.payload[0]
        const context = req.body.context ? JSON.parse(req.body.context) : undefined
        const password = typeof req.body.password === 'string' ? req.body.password : ''

        // Handle upload
        const result = await fileController.handleFileUpload(
          userId,
          carrierFile,
          payloadFile,
          password,
          context,
        )

        res.status(201).json(result)
      } catch (error) {
        console.error('Upload error:', error)
        const message = error instanceof Error ? error.message : 'Upload failed'
        res.status(400).json({ error: message })
      }
    },
  )

  // GET /api/files/:id/carrier - View carrier image inline
  router.get('/:id/carrier', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const { id } = req.params

      const file = await fileModel.findById(id).exec()
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' })
      }

      const carrierPath = path.resolve(getUploadedFilePath(file.carrierPath))
      if (!fs.existsSync(carrierPath)) {
        return res.status(404).json({ error: 'Carrier file not found' })
      }

      res.setHeader('Content-Type', file.carrierMimeType || 'application/octet-stream')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.carrierOriginalName || path.basename(file.carrierPath))}"`,
      )

      return res.sendFile(carrierPath)
    } catch (error) {
      console.error('Carrier preview error:', error)
      return res.status(500).json({ error: 'Failed to load carrier file' })
    }
  })

  // POST /api/files/:id/context-check - Validate current device context for a file
  router.post('/:id/context-check', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const { id } = req.params
      const { context } = req.body

      const file = await fileModel.findById(id).exec()
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' })
      }

      const result = matchesContext(file.context, context)
      return res.json(result)
    } catch (error) {
      console.error('Context check error:', error)
      return res.status(500).json({ error: 'Failed to validate file context' })
    }
  })

  // POST /api/files/:id/decrypt - Decrypt and extract payload
  router.post('/:id/decrypt', decryptRateLimit, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const { id } = req.params
      const { password, context } = req.body

      // Find file
      const file = await fileModel.findById(id).exec()
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' })
      }

      const result = await fileController.decryptStoredFile(file, password, context)

      if (!result.allowed) {
        return res.status(403).json({
          error: 'Access denied - context mismatch',
          decoyContent: result.decoyContent,
          contextScore: result.score,
        })
      }

      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(result.fileName)}"`,
      )
      res.send(result.content)
    } catch (error) {
      console.error('Decrypt error:', error)
      const message = error instanceof Error ? error.message : 'Decryption failed'
      const statusCode = message.includes('password') ? 401 : 500
      res.status(statusCode).json({ error: message })
    }
  })

  // DELETE /api/files/:id - Delete file
  router.delete('/:id', async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!
      const { id } = req.params

      const deletedFile = await fileController.deleteFile(userId, id)

      res.json({ message: 'File deleted successfully', id: deletedFile._id })
    } catch (error) {
      console.error('Delete error:', error)
      const message = error instanceof Error ? error.message : 'Delete failed'
      const statusCode = message.includes('not found') ? 404 : 500
      res.status(statusCode).json({ error: message })
    }
  })

  return router
}

const router = createFileRouter()

export default router
