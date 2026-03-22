// Maximum payload size: 10-15% of carrier file size
const CAPACITY_RATIO = 0.10

export function calculateMaxPayloadSize(carrierSizeBytes: number): number {
  return Math.floor(carrierSizeBytes * CAPACITY_RATIO)
}

export function validatePayloadSize(
  payloadSizeBytes: number,
  carrierSizeBytes: number,
): { valid: boolean; error?: string } {
  const maxPayload = calculateMaxPayloadSize(carrierSizeBytes)
  
  if (payloadSizeBytes > maxPayload) {
    return {
      valid: false,
      error: `Payload exceeds capacity. Max: ${maxPayload} bytes, provided: ${payloadSizeBytes} bytes`,
    }
  }
  
  return { valid: true }
}

export function selectSteganographyMethod(
  payloadType: 'text' | 'image' | 'document',
  carrierType: 'png' | 'jpeg' | 'gif',
): 'lsb' | 'dct' | 'multi-file' {
  // Adaptive selection matrix
  if (payloadType === 'text' && carrierType === 'png') {
    return 'lsb'
  }
  
  if (payloadType === 'image' && carrierType === 'jpeg') {
    return 'dct'
  }
  
  // Fallback to multi-file for complex cases
  return 'multi-file'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
