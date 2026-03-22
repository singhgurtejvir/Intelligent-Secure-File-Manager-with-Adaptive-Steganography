import { Schema, model } from 'mongoose'

interface IFile {
  _id?: string
  userId: string
  name: string
  type: 'image' | 'document'
  carrierOriginalName: string
  carrierPath: string
  carrierShardPaths?: string[]
  carrierMimeType: string
  carrierSize: number
  encryptedPayloadPath?: string
  encryptedPayloadSize: number
  storageMode: 'embedded' | 'encrypted-file'
  steganographyMethod: 'lsb' | 'dct' | 'multi-file'
  metadata: {
    originalPayloadName: string
    originalPayloadSize: number
    originalPayloadMimeType: string
    encryptionAlgorithm: string
    capacityUsedPercent?: number
    analysisCapacityBytes?: number
    visualMetrics?: {
      mse: number
      psnr?: number | null
      ssim: number
    }
    distribution?: {
      shardCount: number
      shardMethod: 'lsb' | 'dct'
    }
  }
  context?: {
    deviceFingerprint: string
    timezone?: string
    language?: string
    userAgentHash?: string
  }
  decoyContent?: string
  createdAt: Date
  updatedAt: Date
}

const FileSchema = new Schema<IFile>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['image', 'document'], required: true },
    carrierOriginalName: { type: String, required: true },
    carrierPath: { type: String, required: true },
    carrierShardPaths: [{ type: String }],
    carrierMimeType: { type: String, required: true },
    carrierSize: { type: Number, required: true },
    encryptedPayloadPath: { type: String, required: false },
    encryptedPayloadSize: { type: Number, required: true },
    storageMode: {
      type: String,
      enum: ['embedded', 'encrypted-file'],
      required: true,
      default: 'embedded',
    },
    steganographyMethod: {
      type: String,
      enum: ['lsb', 'dct', 'multi-file'],
      required: true,
    },
    metadata: {
      originalPayloadName: String,
      originalPayloadSize: Number,
      originalPayloadMimeType: String,
      encryptionAlgorithm: String,
      capacityUsedPercent: Number,
      analysisCapacityBytes: Number,
      visualMetrics: {
        mse: Number,
        psnr: Number,
        ssim: Number,
      },
      distribution: {
        shardCount: Number,
        shardMethod: {
          type: String,
          enum: ['lsb', 'dct'],
        },
      },
    },
    context: {
      deviceFingerprint: String,
      timezone: String,
      language: String,
      userAgentHash: String,
    },
    decoyContent: String,
  },
  {
    timestamps: true,
  },
)

export const File = model<IFile>('File', FileSchema)
