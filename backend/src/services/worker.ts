import fs from 'fs'
import path from 'path'

export interface BinaryAsset {
  bytes: Buffer
  filename: string
  mimeType?: string
}

interface WorkerMetrics {
  mse: number
  psnr: number | null
  ssim: number
}

interface WorkerEmbedResponse {
  status: 'success'
  method: 'lsb' | 'dct'
  carrier_base64: string
  encrypted_payload_size: number
  capacity_used_percent: number
  visual_metrics: WorkerMetrics
}

interface WorkerExtractResponse {
  status: 'success'
  method: 'lsb' | 'dct'
  payload_base64: string
  payload_size: number
}

function getWorkerBaseUrl(): string {
  const host = process.env.WORKER_HOST || 'localhost'
  const port = process.env.WORKER_PORT || '5000'
  const protocol = process.env.WORKER_PROTOCOL || 'http'
  return `${protocol}://${host}:${port}`
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T

  if (!response.ok) {
    const errorPayload = payload as { error?: string }
    const message = typeof errorPayload.error === 'string'
      ? errorPayload.error
      : 'Worker request failed'
    throw new Error(message)
  }

  return payload
}

function toWorkerError(error: unknown, operation: string): Error {
  if (error instanceof Error) {
    if (error.message === 'fetch failed') {
      return new Error(
        `Steganography worker is unavailable during ${operation}. Start the worker with "npm run dev" or "npm run worker:dev".`,
      )
    }

    return error
  }

  return new Error(`Steganography worker failed during ${operation}`)
}

function toBlob(asset: BinaryAsset): Blob {
  return new Blob([asset.bytes], { type: asset.mimeType || 'application/octet-stream' })
}

export function readBinaryAsset(filepath: string, mimeType?: string): BinaryAsset {
  return {
    bytes: fs.readFileSync(filepath),
    filename: path.basename(filepath),
    mimeType,
  }
}

export async function analyzeCarrier(asset: BinaryAsset, payloadSize: number) {
  const formData = new FormData()
  formData.append('carrier', toBlob(asset), asset.filename)
  formData.append('payload_size', payloadSize.toString())

  try {
    const response = await fetch(`${getWorkerBaseUrl()}/analyze`, {
      method: 'POST',
      body: formData,
    })

    return parseJson<{
      estimated_capacity_bytes: number
      payload_size_bytes: number
      capacity_used_percent: number
      recommended_method: 'lsb' | 'dct'
    }>(response)
  } catch (error) {
    throw toWorkerError(error, 'capacity analysis')
  }
}

export async function embedIntoCarrier(options: {
  carrier: BinaryAsset
  payload: BinaryAsset
  password: string
  method: 'lsb' | 'dct'
}) {
  const formData = new FormData()
  formData.append('carrier', toBlob(options.carrier), options.carrier.filename)
  formData.append('payload', toBlob(options.payload), options.payload.filename)
  formData.append('password', options.password)

  try {
    const response = await fetch(`${getWorkerBaseUrl()}/embed/${options.method}`, {
      method: 'POST',
      body: formData,
    })

    const payload = await parseJson<WorkerEmbedResponse>(response)
    return {
      carrierBytes: Buffer.from(payload.carrier_base64, 'base64'),
      encryptedPayloadSize: payload.encrypted_payload_size,
      capacityUsedPercent: payload.capacity_used_percent,
      visualMetrics: payload.visual_metrics,
    }
  } catch (error) {
    throw toWorkerError(error, `${options.method.toUpperCase()} embedding`)
  }
}

export async function extractFromCarrier(options: {
  carrier: BinaryAsset
  password: string
  method: 'lsb' | 'dct'
}) {
  const formData = new FormData()
  formData.append('carrier', toBlob(options.carrier), options.carrier.filename)
  formData.append('password', options.password)
  formData.append('method', options.method)

  try {
    const response = await fetch(`${getWorkerBaseUrl()}/extract`, {
      method: 'POST',
      body: formData,
    })

    const payload = await parseJson<WorkerExtractResponse>(response)
    return Buffer.from(payload.payload_base64, 'base64')
  } catch (error) {
    throw toWorkerError(error, `${options.method.toUpperCase()} extraction`)
  }
}
