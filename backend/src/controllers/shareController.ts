import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { File } from '../models/File.js'
import { Share } from '../models/Share.js'
import { User } from '../models/User.js'
import { getUploadedFilePath } from '../utils/upload.js'
import { writeSharedArtifact, readSharedArtifact } from '../utils/shareStorage.js'
import { decryptStoredFile } from './fileController.js'
import { writeAuditLog } from '../utils/audit.js'

type ShareableFile = {
  _id?: { toString(): string } | string
  userId: string
  name: string
  carrierOriginalName: string
  carrierPath: string
  cleanCarrierPath?: string
  carrierMimeType: string
  storageMode: 'embedded' | 'encrypted-file' | 'plain'
  steganographyMethod: 'lsb' | 'dct' | 'multi-file' | 'none'
  metadata: {
    originalPayloadName: string
    originalPayloadMimeType?: string
  }
  context?: Record<string, string>
}

type ShareDocument = {
  _id?: { toString(): string } | string
  ownerUserId: string
  ownerEmail: string
  recipientUserId?: string
  recipientEmail?: string
  fileId: string
  fileName: string
  carrierOriginalName: string
  shareType: 'account' | 'link' | 'code'
  deliveryMode: 'plain-file' | 'embedded-carrier' | 'payload-file'
  token?: string
  code?: string
  artifactPath: string
  mimeType: string
  downloadFileName: string
  sourceStorageMode: 'embedded' | 'encrypted-file' | 'plain'
  sourceSteganographyMethod: 'lsb' | 'dct' | 'multi-file' | 'none'
  accessCount: number
  lastAccessedAt?: Date
  createdAt: Date
  save(): Promise<ShareDocument>
}

type UserDocument = {
  _id?: { toString(): string } | string
  email: string
}

type FileModelContract = {
  findById(id: string): { exec(): Promise<ShareableFile | null> }
}

type ShareModelContract = {
  new (payload: Record<string, unknown>): ShareDocument
  find(query: Record<string, unknown>): {
    sort(value: Record<string, 1 | -1>): { exec(): Promise<ShareDocument[]> }
  }
  findOne(query: Record<string, unknown>): { exec(): Promise<ShareDocument | null> }
}

type UserModelContract = {
  findOne(query: { email: string }): { exec(): Promise<UserDocument | null> }
}

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:5173'

function toId(value: { toString(): string } | string | undefined): string {
  if (!value) {
    return ''
  }

  return typeof value === 'string' ? value : value.toString()
}

function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return value
}

function extensionFor(filename: string): string {
  const ext = path.extname(filename)
  return ext || '.bin'
}

function buildArtifactFilename(sourceName: string): string {
  return `${Date.now()}-${crypto.randomUUID()}${extensionFor(sourceName)}`
}

function serializeShare(share: ShareDocument) {
  const id = toId(share._id)
  return {
    id,
    shareType: share.shareType,
    deliveryMode: share.deliveryMode,
    recipientEmail: share.recipientEmail,
    fileName: share.fileName,
    carrierOriginalName: share.carrierOriginalName,
    downloadFileName: share.downloadFileName,
    mimeType: share.mimeType,
    token: share.token,
    code: share.code,
    accessCount: share.accessCount,
    createdAt: share.createdAt,
    url:
      share.shareType === 'link' && share.token
        ? `${FRONTEND_BASE_URL}/receive?link=${encodeURIComponent(share.token)}`
        : undefined,
  }
}

function assertDeliveryMode(file: ShareableFile, deliveryMode: string): asserts deliveryMode is 'plain-file' | 'embedded-carrier' | 'payload-file' {
  if (!['plain-file', 'embedded-carrier', 'payload-file'].includes(deliveryMode)) {
    throw new Error('Unsupported share delivery mode')
  }

  if (file.storageMode === 'plain' || file.steganographyMethod === 'none') {
    if (deliveryMode !== 'plain-file') {
      throw new Error('Standard files can only be shared as normal files')
    }
    return
  }

  if (deliveryMode === 'embedded-carrier' && file.steganographyMethod === 'multi-file') {
    throw new Error('Embedded sharing is not available for distributed multi-file items yet')
  }
}

async function buildShareArtifact(file: ShareableFile, deliveryMode: 'plain-file' | 'embedded-carrier' | 'payload-file', password?: string) {
  if (deliveryMode === 'plain-file') {
    const sourceFile =
      file.storageMode === 'plain' || file.steganographyMethod === 'none'
        ? file.carrierPath
        : file.cleanCarrierPath || file.carrierPath
    const sourcePath = path.resolve(getUploadedFilePath(sourceFile))
    const content = fs.readFileSync(sourcePath)
    return {
      content,
      mimeType: file.carrierMimeType || 'application/octet-stream',
      downloadFileName: file.carrierOriginalName,
    }
  }

  if (deliveryMode === 'embedded-carrier') {
    const sourcePath = path.resolve(getUploadedFilePath(file.carrierPath))
    const content = fs.readFileSync(sourcePath)
    return {
      content,
      mimeType: file.carrierMimeType || 'application/octet-stream',
      downloadFileName: file.carrierOriginalName,
    }
  }

  if (!password) {
    throw new Error('Password is required to share a decrypted payload')
  }

  const result = await decryptStoredFile(
    {
      ...file,
      _id: toId(file._id) || undefined,
    },
    password,
    file.context,
  )
  if (!result.allowed) {
    throw new Error('File context did not allow sharing this payload')
  }

  return {
    content: result.content,
    mimeType: result.mimeType,
    downloadFileName: result.fileName,
  }
}

export async function createShare(
  ownerUserId: string,
  ownerEmail: string,
  input: {
    fileId: string
    shareType: 'account' | 'link' | 'code'
    deliveryMode: 'plain-file' | 'embedded-carrier' | 'payload-file'
    recipientEmail?: string
    password?: string
  },
  deps: {
    fileModel?: FileModelContract
    shareModel?: ShareModelContract
    userModel?: UserModelContract
  } = {},
) {
  const fileModel = deps.fileModel || (File as unknown as FileModelContract)
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const userModel = deps.userModel || (User as unknown as UserModelContract)
  const file = await fileModel.findById(input.fileId).exec()

  if (!file || file.userId !== ownerUserId) {
    throw new Error('File not found')
  }

  assertDeliveryMode(file, input.deliveryMode)

  let recipientUserId: string | undefined
  let recipientEmail: string | undefined

  if (input.shareType === 'account') {
    const normalizedEmail = input.recipientEmail?.trim().toLowerCase()
    if (!normalizedEmail) {
      throw new Error('Recipient email is required for account shares')
    }

    const recipient = await userModel.findOne({ email: normalizedEmail }).exec()
    if (!recipient) {
      throw new Error('Recipient account was not found')
    }

    recipientUserId = toId(recipient._id)
    recipientEmail = recipient.email
  }

  const artifact = await buildShareArtifact(file, input.deliveryMode, input.password)
  const artifactPath = writeSharedArtifact(buildArtifactFilename(artifact.downloadFileName), artifact.content)
  const token = input.shareType === 'link' ? crypto.randomUUID().replace(/-/g, '') : undefined
  const code = input.shareType === 'code' ? randomCode(8) : undefined

  const share = new shareModel({
    ownerUserId,
    ownerEmail,
    recipientUserId,
    recipientEmail,
    fileId: toId(file._id),
    fileName: file.name,
    carrierOriginalName: file.carrierOriginalName,
    shareType: input.shareType,
    deliveryMode: input.deliveryMode,
    token,
    code,
    artifactPath,
    mimeType: artifact.mimeType,
    downloadFileName: artifact.downloadFileName,
    sourceStorageMode: file.storageMode,
    sourceSteganographyMethod: file.steganographyMethod,
    accessCount: 0,
  })

  const savedShare = await share.save()

  writeAuditLog({
    action: 'file.shared',
    userId: ownerUserId,
    fileId: toId(file._id),
    fileName: artifact.downloadFileName,
    shareType: input.shareType,
    deliveryMode: input.deliveryMode,
  })

  return serializeShare(savedShare)
}

export async function listReceivedShares(
  userId: string,
  deps: { shareModel?: ShareModelContract } = {},
) {
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const shares = await shareModel.find({ recipientUserId: userId, shareType: 'account' }).sort({ createdAt: -1 }).exec()
  return shares.map(serializeShare)
}

export async function listSentShares(
  userId: string,
  deps: { shareModel?: ShareModelContract } = {},
) {
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const shares = await shareModel.find({ ownerUserId: userId }).sort({ createdAt: -1 }).exec()
  return shares.map(serializeShare)
}

async function readDownloadableShare(
  query: Record<string, unknown>,
  deps: { shareModel?: ShareModelContract } = {},
) {
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const share = await shareModel.findOne(query).exec()

  if (!share) {
    throw new Error('Share not found')
  }

  const content = readSharedArtifact(share.artifactPath)
  share.accessCount += 1
  share.lastAccessedAt = new Date()
  await share.save()

  return {
    summary: serializeShare(share),
    content,
    mimeType: share.mimeType,
    downloadFileName: share.downloadFileName,
  }
}

export async function getReceivedShareDownload(
  userId: string,
  shareId: string,
  deps: { shareModel?: ShareModelContract } = {},
) {
  return readDownloadableShare({ _id: shareId, recipientUserId: userId, shareType: 'account' }, deps)
}

export async function getPublicLinkShare(token: string, deps: { shareModel?: ShareModelContract } = {}) {
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const share = await shareModel.findOne({ token, shareType: 'link' }).exec()
  if (!share) {
    throw new Error('Share not found')
  }
  return serializeShare(share)
}

export async function getPublicCodeShare(code: string, deps: { shareModel?: ShareModelContract } = {}) {
  const shareModel = deps.shareModel || (Share as unknown as ShareModelContract)
  const share = await shareModel.findOne({ code: code.toUpperCase(), shareType: 'code' }).exec()
  if (!share) {
    throw new Error('Share not found')
  }
  return serializeShare(share)
}

export async function getPublicLinkDownload(token: string, deps: { shareModel?: ShareModelContract } = {}) {
  return readDownloadableShare({ token, shareType: 'link' }, deps)
}

export async function getPublicCodeDownload(code: string, deps: { shareModel?: ShareModelContract } = {}) {
  return readDownloadableShare({ code: code.toUpperCase(), shareType: 'code' }, deps)
}
