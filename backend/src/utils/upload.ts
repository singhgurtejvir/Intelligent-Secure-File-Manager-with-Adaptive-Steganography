import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'
import path from 'path'
import fs from 'fs'

// Create upload directory if it doesn't exist
const uploadDir = 'uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random.ext
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const ext = path.extname(file.originalname)
    cb(null, `${timestamp}-${random}${ext}`)
  },
})

// File filter to validate types
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Allow images and documents
  const allowedMimes = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Allowed: PNG, JPEG, GIF, PDF, DOC`))
  }
}

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 52428800, // 50MB
  },
})

// Helper to delete uploaded file
export function deleteUploadedFile(filename: string): void {
  const filepath = path.join(uploadDir, filename)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

// Helper to get file info
export function getFileInfo(filename: string): { size: number; path: string } | null {
  const filepath = path.join(uploadDir, filename)
  if (fs.existsSync(filepath)) {
    const stat = fs.statSync(filepath)
    return {
      size: stat.size,
      path: filepath,
    }
  }
  return null
}

export function readUploadedFile(filename: string): Buffer {
  return fs.readFileSync(path.join(uploadDir, filename))
}

export function getUploadedFilePath(filename: string): string {
  return path.join(uploadDir, filename)
}

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures: Record<string, number[][]> = {
    'image/png': [[0x89, 0x50, 0x4e, 0x47]],
    'image/jpeg': [[0xff, 0xd8, 0xff]],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  }

  const knownSignatures = signatures[mimeType]
  if (!knownSignatures) {
    return true
  }

  return knownSignatures.some((signature) =>
    signature.every((value, index) => buffer[index] === value),
  )
}
