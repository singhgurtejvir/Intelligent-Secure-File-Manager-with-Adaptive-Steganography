import { calculateMaxPayloadSize, selectSteganographyMethod } from '@/utils/steganography'

export function useCapacity(carrierFile: File | null, payloadFile: File | null) {
  const maxPayload = carrierFile ? calculateMaxPayloadSize(carrierFile.size) : 0
  const usedPercent = carrierFile && payloadFile ? (payloadFile.size / carrierFile.size) * 100 : 0

  const carrierType = carrierFile?.type === 'image/jpeg'
    ? 'jpeg'
    : carrierFile?.type === 'image/gif'
      ? 'gif'
      : 'png'

  const payloadType = payloadFile?.type.startsWith('image/')
    ? 'image'
    : payloadFile?.type.startsWith('text/')
      ? 'text'
      : 'document'

  const method = carrierFile && payloadFile
    ? selectSteganographyMethod(payloadType, carrierType)
    : 'lsb'

  const status: 'safe' | 'warning' | 'over' =
    usedPercent > 14 ? 'over' : usedPercent > 10 ? 'warning' : 'safe'

  return {
    maxPayload,
    usedPercent,
    method,
    status,
    isWithinCapacity: payloadFile ? payloadFile.size <= maxPayload : true,
  }
}
