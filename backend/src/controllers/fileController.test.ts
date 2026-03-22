import fs from 'fs'
import path from 'path'
import { jest } from '@jest/globals'
import { encryptBuffer } from '../utils/crypto.js'

const matchesContextMock = jest.fn(() => ({ allowed: true, score: 1 }))
const buildDecoyContentMock = jest.fn((name: string) => `decoy:${name}`)
const getUploadedFilePathMock = jest.fn((filename: string) => filename)
const extractFromCarrierMock = jest.fn()
const readBinaryAssetMock = jest.fn()
const writeAuditLogMock = jest.fn()

jest.unstable_mockModule('../models/File.js', () => ({
  File: jest.fn(),
}))

jest.unstable_mockModule('../utils/context.js', () => ({
  normalizeContext: jest.fn((value) => value),
  matchesContext: matchesContextMock,
  buildDecoyContent: buildDecoyContentMock,
}))

jest.unstable_mockModule('../utils/upload.js', () => ({
  getFileInfo: jest.fn(),
  deleteUploadedFile: jest.fn(),
  readUploadedFile: jest.fn(),
  validateMagicBytes: jest.fn(),
  getUploadedFilePath: getUploadedFilePathMock,
}))

jest.unstable_mockModule('../services/worker.js', () => ({
  analyzeCarrier: jest.fn(),
  embedIntoCarrier: jest.fn(),
  extractFromCarrier: extractFromCarrierMock,
  readBinaryAsset: readBinaryAssetMock,
}))

jest.unstable_mockModule('../utils/audit.js', () => ({
  writeAuditLog: writeAuditLogMock,
}))

let decryptStoredFile: typeof import('./fileController.js').decryptStoredFile

describe('fileController decryptStoredFile', () => {
  beforeAll(async () => {
    const controllerModule = await import('./fileController.js')
    decryptStoredFile = controllerModule.decryptStoredFile
  })

  beforeEach(() => {
    jest.clearAllMocks()
    matchesContextMock.mockReturnValue({ allowed: true, score: 1 })
  })

  it('falls back to the encrypted payload backup when embedded extraction fails', async () => {
    const encryptedDirectory = path.resolve('uploads', 'encrypted')
    const encryptedBackupPath = path.join(encryptedDirectory, 'backup.bin')

    extractFromCarrierMock.mockImplementationOnce(async () => {
      throw new Error(
        'Steganography worker is unavailable during LSB extraction. Start the worker with "npm run dev" or "npm run worker:dev".',
      )
    })
    readBinaryAssetMock.mockReturnValue({
      filename: 'carrier.png',
      bytes: Buffer.from('carrier'),
      mimeType: 'image/png',
    })

    fs.mkdirSync(encryptedDirectory, { recursive: true })
    fs.writeFileSync(encryptedBackupPath, encryptBuffer(Buffer.from('restored-secret'), 'password123'))

    try {
      const result = await decryptStoredFile(
        {
          _id: 'file-1',
          carrierPath: 'carrier.png',
          encryptedPayloadPath: 'backup.bin',
          storageMode: 'embedded',
          steganographyMethod: 'lsb',
          metadata: {
            originalPayloadName: 'secret.txt',
            originalPayloadMimeType: 'text/plain',
          },
        },
        'password123',
        { deviceFingerprint: 'device-1' },
      )

      expect(result).toEqual({
        allowed: true,
        content: Buffer.from('restored-secret'),
        fileName: 'secret.txt',
        mimeType: 'text/plain',
      })
    } finally {
      if (fs.existsSync(encryptedBackupPath)) {
        fs.unlinkSync(encryptedBackupPath)
      }
    }
  })
})
