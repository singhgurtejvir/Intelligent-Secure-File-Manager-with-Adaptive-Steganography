import { Schema, model } from 'mongoose'

interface IShare {
  _id?: string
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
  updatedAt: Date
}

const ShareSchema = new Schema<IShare>(
  {
    ownerUserId: { type: String, required: true, index: true },
    ownerEmail: { type: String, required: true },
    recipientUserId: { type: String, index: true },
    recipientEmail: { type: String },
    fileId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    carrierOriginalName: { type: String, required: true },
    shareType: {
      type: String,
      enum: ['account', 'link', 'code'],
      required: true,
      index: true,
    },
    deliveryMode: {
      type: String,
      enum: ['plain-file', 'embedded-carrier', 'payload-file'],
      required: true,
    },
    token: { type: String, unique: true, sparse: true, index: true },
    code: { type: String, unique: true, sparse: true, index: true },
    artifactPath: { type: String, required: true },
    mimeType: { type: String, required: true },
    downloadFileName: { type: String, required: true },
    sourceStorageMode: {
      type: String,
      enum: ['embedded', 'encrypted-file', 'plain'],
      required: true,
    },
    sourceSteganographyMethod: {
      type: String,
      enum: ['lsb', 'dct', 'multi-file', 'none'],
      required: true,
    },
    accessCount: { type: Number, required: true, default: 0 },
    lastAccessedAt: { type: Date },
  },
  {
    timestamps: true,
  },
)

export const Share = model<IShare>('Share', ShareSchema)
