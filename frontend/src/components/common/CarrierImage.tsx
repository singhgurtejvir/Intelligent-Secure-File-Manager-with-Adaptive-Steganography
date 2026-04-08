import { useEffect, useState } from 'react'
import { getCarrierFile } from '@/utils/api'

export default function CarrierImage({
  fileId,
  alt,
  mimeType,
  className,
}: {
  fileId: string
  alt: string
  mimeType?: string
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  const isImage = !mimeType || mimeType.startsWith('image/')

  useEffect(() => {
    if (!isImage) {
      setSrc(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    const load = async () => {
      try {
        const blob = await getCarrierFile(fileId)
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) {
          setSrc(objectUrl)
        }
      } catch {
        if (!cancelled) {
          setSrc(null)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [fileId, isImage])

  if (!isImage || !src) {
    return <div className={className ? `${className} carrier-image-fallback` : 'carrier-image-fallback'} />
  }

  return <img src={src} alt={alt} className={className} loading="lazy" />
}
