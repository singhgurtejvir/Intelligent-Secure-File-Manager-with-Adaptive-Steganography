import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { File } from '../models/File.js'
import { normalizeContext, matchesContext, buildDecoyContent, DeviceContext } from '../utils/context.js'
import { encryptBuffer, decryptBuffer } from '../utils/crypto.js'
import {
  getFileInfo,
  deleteUploadedFile,
  readUploadedFile,
  validateMagicBytes,
  getUploadedFilePath,
} from '../utils/upload.js'
import {
  deleteStoredFile,
  getEncryptedPayloadPath,
  readEncryptedPayload,
  writeEncryptedPayload,
} from '../utils/storage.js'
import {
  BinaryAsset,
  analyzeCarrier,
  embedIntoCarrier,
  extractFromCarrier,
  readBinaryAsset,
} from '../services/worker.js'
import { writeAuditLog } from '../utils/audit.js'

const MAX_SHARDS = 12

type WorkerMethod = 'lsb' | 'dct'

type VisualMetrics = {
  mse: number
  psnr: number | null
  ssim: number
}

type EmbeddedStorageResult = {
  storageMode: 'embedded'
  steganographyMethod: 'lsb' | 'dct' | 'multi-file'
  carrierPath: string
  carrierShardPaths?: string[]
  encryptedPayloadPath: string
  encryptedPayloadSize: number
  capacityUsedPercent?: number
  visualMetrics?: VisualMetrics
  distribution?: {
    shardCount: number
    shardMethod: WorkerMethod
  }
}

type EncryptedFileStorageResult = ReturnType<typeof buildEncryptedFallback>

type UploadStorageResult = EmbeddedStorageResult | EncryptedFileStorageResult

type DecryptableFile = {
  _id?: string
  context?: Record<string, string>
  decoyContent?: string
  encryptedPayloadPath?: string
  carrierPath: string
  cleanCarrierPath?: string
  carrierShardPaths?: string[]
  storageMode?: 'embedded' | 'encrypted-file' | 'plain'
  steganographyMethod: 'lsb' | 'dct' | 'multi-file' | 'none'
  metadata: {
    originalPayloadName: string
    originalPayloadMimeType?: string
    distribution?: {
      shardCount: number
      shardMethod: WorkerMethod
    }
  }
}

function getBaseMethodFromMime(mimeType: string): WorkerMethod {
  return mimeType === 'image/jpeg' ? 'dct' : 'lsb'
}

function createBinaryAsset(filename: string, bytes: Buffer, mimeType?: string): BinaryAsset {
  return { filename, bytes, mimeType }
}

function makeShardFilename(filename: string, index: number): string {
  const ext = path.extname(filename)
  const stem = filename.slice(0, filename.length - ext.length)
  return `${stem}-shard-${String(index + 1).padStart(2, '0')}${ext}`
}

function splitBuffer(buffer: Buffer, chunkCount: number): Buffer[] {
  const chunks: Buffer[] = []
  const chunkSize = Math.ceil(buffer.length / chunkCount)

  for (let index = 0; index < chunkCount; index += 1) {
    const start = index * chunkSize
    const end = Math.min(buffer.length, start + chunkSize)
    chunks.push(buffer.subarray(start, end))
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

function deleteCarrierSet(primaryCarrier: string, shardPaths?: string[]): void {
  const targets = new Set<string>([primaryCarrier, ...(shardPaths || [])])
  for (const target of targets) {
    deleteUploadedFile(target)
  }
}

function preserveCleanCarrierCopy(carrierFile: Express.Multer.File): string {
  const ext = path.extname(carrierFile.originalname || carrierFile.filename)
  const cleanCarrierFilename = `clean-${Date.now()}-${crypto.randomUUID()}${ext}`
  fs.copyFileSync(getUploadedFilePath(carrierFile.filename), getUploadedFilePath(cleanCarrierFilename))
  return cleanCarrierFilename
}

async function embedSingleCarrier(options: {
  carrierFile: Express.Multer.File
  payloadFile: Express.Multer.File
  password: string
  baseMethod: WorkerMethod
  carrierAsset: BinaryAsset
  payloadAsset: BinaryAsset
}) {
  const embedResult = await embedIntoCarrier({
    carrier: options.carrierAsset,
    payload: options.payloadAsset,
    password: options.password,
    method: options.baseMethod,
  })

  fs.writeFileSync(getUploadedFilePath(options.carrierFile.filename), embedResult.carrierBytes)

  return {
    storageMode: 'embedded' as const,
    steganographyMethod: options.baseMethod as 'lsb' | 'dct',
    carrierPath: options.carrierFile.filename,
    carrierShardPaths: undefined,
    encryptedPayloadPath: undefined,
    encryptedPayloadSize: embedResult.encryptedPayloadSize,
    capacityUsedPercent: embedResult.capacityUsedPercent,
    visualMetrics: embedResult.visualMetrics,
    distribution: undefined,
  }
}

async function embedMultiCarrier(options: {
  carrierFile: Express.Multer.File
  payloadFile: Express.Multer.File
  password: string
  baseMethod: WorkerMethod
  carrierAsset: BinaryAsset
  payloadBuffer: Buffer
  perCarrierCapacity: number
}) {
  const shardCount = Math.ceil(options.payloadBuffer.length / options.perCarrierCapacity)
  if (shardCount > MAX_SHARDS) {
    throw new Error(`Payload requires ${shardCount} shards, which exceeds the limit of ${MAX_SHARDS}`)
  }

  const payloadChunks = splitBuffer(options.payloadBuffer, shardCount)
  const shardPaths: string[] = []
  let totalEncryptedPayloadSize = 0
  let totalCapacityUsedPercent = 0
  let firstMetrics: { mse: number; psnr: number | null; ssim: number } | undefined

  try {
    for (let index = 0; index < payloadChunks.length; index += 1) {
      const shardFilename = index === 0 ? options.carrierFile.filename : makeShardFilename(options.carrierFile.filename, index)
      const shardCarrierAsset = createBinaryAsset(
        shardFilename,
        Buffer.from(options.carrierAsset.bytes),
        options.carrierAsset.mimeType,
      )
      const shardPayloadAsset = createBinaryAsset(
        `${path.parse(options.payloadFile.originalname).name}-part-${index + 1}.bin`,
        Buffer.from(payloadChunks[index]),
        options.payloadFile.mimetype,
      )

      const embedResult = await embedIntoCarrier({
        carrier: shardCarrierAsset,
        payload: shardPayloadAsset,
        password: options.password,
        method: options.baseMethod,
      })

      fs.writeFileSync(getUploadedFilePath(shardFilename), embedResult.carrierBytes)
      shardPaths.push(shardFilename)
      totalEncryptedPayloadSize += embedResult.encryptedPayloadSize
      totalCapacityUsedPercent += embedResult.capacityUsedPercent
      if (!firstMetrics) {
        firstMetrics = embedResult.visualMetrics
      }
    }
  } catch (error) {
    deleteCarrierSet(options.carrierFile.filename, shardPaths)
    throw error
  }

  return {
    storageMode: 'embedded' as const,
    steganographyMethod: 'multi-file' as const,
    carrierPath: shardPaths[0],
    carrierShardPaths: shardPaths,
    encryptedPayloadPath: undefined,
    encryptedPayloadSize: totalEncryptedPayloadSize,
    capacityUsedPercent: Number((totalCapacityUsedPercent / shardPaths.length).toFixed(4)),
    visualMetrics: firstMetrics,
    distribution: {
      shardCount: shardPaths.length,
      shardMethod: options.baseMethod,
    },
  }
}

function buildEncryptedFallback(payloadBuffer: Buffer, password: string) {
  const encryptedBackup = createEncryptedPayloadBackup(payloadBuffer, password)

  return {
    storageMode: 'encrypted-file' as const,
    steganographyMethod: undefined,
    carrierShardPaths: undefined,
    encryptedPayloadPath: encryptedBackup.encryptedPayloadPath,
    encryptedPayloadSize: encryptedBackup.encryptedPayloadSize,
    capacityUsedPercent: undefined,
    visualMetrics: undefined,
    distribution: undefined,
  }
}

function createEncryptedPayloadBackup(payloadBuffer: Buffer, password: string) {
  const encryptedPayloadPath = `${Date.now()}-${crypto.randomUUID()}.bin`
  const encryptedPayload = encryptBuffer(payloadBuffer, password)
  writeEncryptedPayload(encryptedPayloadPath, encryptedPayload)

  return {
    encryptedPayloadPath,
    encryptedPayloadSize: encryptedPayload.length,
  }
}

export async function handleFileUpload(
  userId: string,
  carrierFile: Express.Multer.File,
  payloadFile: Express.Multer.File,
  password: string,
  context?: DeviceContext,
) {
  if (!carrierFile || !payloadFile) {
    throw new Error('Both carrier and payload files are required')
  }

  if (!password || password.length < 8) {
    deleteUploadedFile(carrierFile.filename)
    deleteUploadedFile(payloadFile.filename)
    throw new Error('Upload password must be at least 8 characters')
  }

  const carrierInfo = getFileInfo(carrierFile.filename)
  if (!carrierInfo) {
    throw new Error('Failed to process carrier file')
  }

  const validCarrierMimes = ['image/png', 'image/jpeg', 'image/gif']
  if (!validCarrierMimes.includes(carrierFile.mimetype)) {
    deleteUploadedFile(carrierFile.filename)
    deleteUploadedFile(payloadFile.filename)
    throw new Error('Carrier must be a PNG, JPEG, or GIF image')
  }

  const carrierBuffer = readUploadedFile(carrierFile.filename)
  const payloadBuffer = readUploadedFile(payloadFile.filename)
  const encryptedBackup = createEncryptedPayloadBackup(payloadBuffer, password)
  const cleanCarrierPath = preserveCleanCarrierCopy(carrierFile)

  if (!validateMagicBytes(carrierBuffer, carrierFile.mimetype)) {
    deleteUploadedFile(carrierFile.filename)
    deleteUploadedFile(payloadFile.filename)
    deleteUploadedFile(cleanCarrierPath)
    throw new Error('Carrier file contents do not match the selected MIME type')
  }

  if (!validateMagicBytes(payloadBuffer, payloadFile.mimetype)) {
    deleteUploadedFile(carrierFile.filename)
    deleteUploadedFile(payloadFile.filename)
    deleteUploadedFile(cleanCarrierPath)
    throw new Error('Payload file contents do not match the detected MIME type')
  }

  const baseMethod = getBaseMethodFromMime(carrierFile.mimetype)
  const carrierAsset = createBinaryAsset(carrierFile.filename, carrierBuffer, carrierFile.mimetype)
  const payloadAsset = createBinaryAsset(payloadFile.originalname, payloadBuffer, payloadFile.mimetype)

  let analysisCapacityBytes = Math.floor(carrierInfo.size * 0.1)
  try {
    const analysis = await analyzeCarrier(carrierAsset, payloadFile.size)
    analysisCapacityBytes = analysis.estimated_capacity_bytes
  } catch {
    // Fall back to the existing heuristic if the worker analysis is unavailable.
  }

  let embeddingResult: UploadStorageResult

  try {
    if (payloadFile.size <= analysisCapacityBytes) {
      const embeddedResult = await embedSingleCarrier({
        carrierFile,
        payloadFile,
        password,
        baseMethod,
        carrierAsset,
        payloadAsset,
      })
      embeddingResult = {
        ...embeddedResult,
        encryptedPayloadPath: encryptedBackup.encryptedPayloadPath,
        encryptedPayloadSize: encryptedBackup.encryptedPayloadSize,
      }
    } else {
      const embeddedResult = await embedMultiCarrier({
        carrierFile,
        payloadFile,
        password,
        baseMethod,
        carrierAsset,
        payloadBuffer,
        perCarrierCapacity: analysisCapacityBytes,
      })
      embeddingResult = {
        ...embeddedResult,
        encryptedPayloadPath: encryptedBackup.encryptedPayloadPath,
        encryptedPayloadSize: encryptedBackup.encryptedPayloadSize,
      }
    }
  } catch {
    embeddingResult = buildEncryptedFallback(payloadBuffer, password)
    if (embeddingResult.encryptedPayloadPath !== encryptedBackup.encryptedPayloadPath) {
      deleteStoredFile(getEncryptedPayloadPath(encryptedBackup.encryptedPayloadPath))
    }
  }

  deleteUploadedFile(payloadFile.filename)

  const file = new File({
    userId,
    name: payloadFile.originalname,
    type: payloadFile.mimetype.startsWith('image') ? 'image' : 'document',
    carrierOriginalName: carrierFile.originalname,
    carrierPath: embeddingResult.storageMode === 'embedded' ? carrierFile.filename : carrierFile.filename,
    cleanCarrierPath,
    carrierShardPaths: embeddingResult.carrierShardPaths,
    carrierMimeType: carrierFile.mimetype,
    carrierSize: carrierInfo.size,
    encryptedPayloadPath: embeddingResult.encryptedPayloadPath,
    encryptedPayloadSize: embeddingResult.encryptedPayloadSize,
    storageMode: embeddingResult.storageMode,
    steganographyMethod:
      embeddingResult.storageMode === 'encrypted-file'
        ? baseMethod
        : embeddingResult.steganographyMethod,
    metadata: {
      originalPayloadName: payloadFile.originalname,
      originalPayloadSize: payloadFile.size,
      originalPayloadMimeType: payloadFile.mimetype || 'application/octet-stream',
      encryptionAlgorithm: 'AES-256-GCM',
      capacityUsedPercent: embeddingResult.capacityUsedPercent,
      analysisCapacityBytes,
      visualMetrics: embeddingResult.visualMetrics,
      distribution: embeddingResult.distribution,
    },
    context: normalizeContext(context),
    decoyContent: buildDecoyContent(payloadFile.originalname),
  })

  let savedFile
  try {
    savedFile = await file.save()
  } catch (error) {
    deleteCarrierSet(carrierFile.filename, embeddingResult.carrierShardPaths)
    deleteUploadedFile(cleanCarrierPath)
    if (embeddingResult.encryptedPayloadPath) {
      deleteStoredFile(getEncryptedPayloadPath(embeddingResult.encryptedPayloadPath))
    }
    throw error
  }

  writeAuditLog({
    action: 'file.uploaded',
    userId,
    fileId: savedFile._id?.toString(),
    method: savedFile.steganographyMethod,
    storageMode: savedFile.storageMode,
    shardCount: savedFile.metadata.distribution?.shardCount || 1,
    capacityUsedPercent: savedFile.metadata.capacityUsedPercent,
  })

  return {
    _id: savedFile._id,
    name: savedFile.name,
    carrierOriginalName: savedFile.carrierOriginalName,
    type: savedFile.type,
    carrierPath: savedFile.carrierPath,
    steganographyMethod: savedFile.steganographyMethod,
    metadata: savedFile.metadata,
    createdAt: savedFile.createdAt,
  }
}

export async function handlePlainFileUpload(
  userId: string,
  visibleFile: Express.Multer.File,
) {
  if (!visibleFile) {
    throw new Error('A file is required')
  }

  const fileInfo = getFileInfo(visibleFile.filename)
  if (!fileInfo) {
    throw new Error('Failed to process uploaded file')
  }

  const fileBuffer = readUploadedFile(visibleFile.filename)
  if (!validateMagicBytes(fileBuffer, visibleFile.mimetype)) {
    deleteUploadedFile(visibleFile.filename)
    throw new Error('Uploaded file contents do not match the detected MIME type')
  }

  const file = new File({
    userId,
    name: visibleFile.originalname,
    type: visibleFile.mimetype.startsWith('image') ? 'image' : 'document',
    carrierOriginalName: visibleFile.originalname,
    carrierPath: visibleFile.filename,
    carrierMimeType: visibleFile.mimetype || 'application/octet-stream',
    carrierSize: fileInfo.size,
    encryptedPayloadSize: 0,
    storageMode: 'plain',
    steganographyMethod: 'none',
    metadata: {
      originalPayloadName: visibleFile.originalname,
      originalPayloadSize: visibleFile.size,
      originalPayloadMimeType: visibleFile.mimetype || 'application/octet-stream',
      encryptionAlgorithm: 'none',
    },
  })

  let savedFile
  try {
    savedFile = await file.save()
  } catch (error) {
    deleteUploadedFile(visibleFile.filename)
    throw error
  }

  writeAuditLog({
    action: 'file.uploaded',
    userId,
    fileId: savedFile._id?.toString(),
    method: 'none',
    storageMode: 'plain',
    shardCount: 1,
  })

  return {
    _id: savedFile._id,
    name: savedFile.name,
    carrierOriginalName: savedFile.carrierOriginalName,
    type: savedFile.type,
    carrierPath: savedFile.carrierPath,
    steganographyMethod: savedFile.steganographyMethod,
    storageMode: savedFile.storageMode,
    metadata: savedFile.metadata,
    createdAt: savedFile.createdAt,
  }
}

export async function getFileList(userId: string) {
  const files = await File.find({ userId }).exec()

  return files.map((file) => ({
    id: file._id?.toString() || '',
    name: file.name,
    carrierOriginalName: file.carrierOriginalName,
    type: file.type,
    carrierMimeType: file.carrierMimeType,
    carrierSize: file.carrierSize,
    originalPayloadSize: file.metadata.originalPayloadSize,
    originalPayloadName: file.metadata.originalPayloadName,
    steganographyMethod: file.steganographyMethod,
    storageMode: file.storageMode,
    capacityUsedPercent: file.metadata.capacityUsedPercent,
    shardCount: file.metadata.distribution?.shardCount || 1,
    createdAt: file.createdAt,
  }))
}

export async function deleteFile(userId: string, fileId: string): Promise<{ _id?: string; id?: string }> {
  const file = await File.findById(fileId).exec()

  if (!file) {
    throw new Error('File not found')
  }

  if (file.userId !== userId) {
    throw new Error('Unauthorized: Cannot delete file belonging to another user')
  }

  deleteCarrierSet(file.carrierPath, file.carrierShardPaths)
  if (file.cleanCarrierPath) {
    deleteUploadedFile(file.cleanCarrierPath)
  }
  if (file.encryptedPayloadPath) {
    deleteStoredFile(getEncryptedPayloadPath(file.encryptedPayloadPath))
  }

  await File.findByIdAndDelete(fileId)

  writeAuditLog({
    action: 'file.deleted',
    userId,
    fileId,
    shardCount: file.metadata.distribution?.shardCount || 1,
  })

  return { id: file._id?.toString() }
}

async function decryptEmbeddedFile(file: DecryptableFile, password: string): Promise<Buffer> {
  const distribution = file.metadata.distribution
  const shardMethod = distribution?.shardMethod || getBaseMethodFromMime('image/png')
  const shardPaths = file.carrierShardPaths && file.carrierShardPaths.length > 0
    ? file.carrierShardPaths
    : [file.carrierPath]

  const extractedChunks: Buffer[] = []
  for (const shardPath of shardPaths) {
    const shardAsset = readBinaryAsset(getUploadedFilePath(shardPath))
    const chunk = await extractFromCarrier({
      carrier: shardAsset,
      password,
      method: file.steganographyMethod === 'dct'
        ? 'dct'
        : file.steganographyMethod === 'multi-file'
          ? shardMethod
          : 'lsb',
    })
    extractedChunks.push(chunk)
  }

  return Buffer.concat(extractedChunks)
}

function decryptStoredPayload(file: DecryptableFile, password: string): Buffer {
  if (!file.encryptedPayloadPath) {
    throw new Error('Encrypted payload is unavailable')
  }

  const encryptedPayload = readEncryptedPayload(file.encryptedPayloadPath)
  return decryptBuffer(encryptedPayload, password)
}

export async function decryptStoredFile(
  file: DecryptableFile,
  password: string,
  context?: DeviceContext,
): Promise<
  | { allowed: false; decoyContent: string; score: number }
  | { allowed: true; content: Buffer; fileName: string; mimeType: string }
> {
  if (!password) {
    throw new Error('Password is required for decryption')
  }

  if (file.storageMode === 'plain' || file.steganographyMethod === 'none') {
    throw new Error('Plain files do not require decryption')
  }

  const validation = matchesContext(file.context, context)
  if (!validation.allowed) {
    writeAuditLog({
      action: 'file.decrypt.denied',
      fileId: file._id?.toString(),
      fileName: file.metadata.originalPayloadName,
      contextScore: validation.score,
    })

    return {
      allowed: false,
      decoyContent: file.decoyContent || buildDecoyContent(file.metadata.originalPayloadName),
      score: validation.score,
    }
  }

  let decrypted: Buffer
  if (file.storageMode === 'embedded') {
    try {
      decrypted = await decryptEmbeddedFile(file, password)
    } catch (error) {
      if (!file.encryptedPayloadPath) {
        throw error
      }

      decrypted = decryptStoredPayload(file, password)
    }
  } else {
    decrypted = decryptStoredPayload(file, password)
  }

  writeAuditLog({
    action: 'file.decrypt.success',
    fileId: file._id?.toString(),
    fileName: file.metadata.originalPayloadName,
  })

  return {
    allowed: true,
    content: decrypted,
    fileName: file.metadata.originalPayloadName,
    mimeType: file.metadata.originalPayloadMimeType || 'application/octet-stream',
  }
}
