import { useEffect, useState } from 'react'
import { getCarrierFile } from '@/utils/api'

export default function CarrierImage({
  fileId,
  alt,
  className,
}: {
  fileId: string
  alt: string
  className?: string
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
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
  }, [fileId])

  if (!src) {
    return <div className={className ? `${className} carrier-image-fallback` : 'carrier-image-fallback'} />
  }

  return <img src={src} alt={alt} className={className} loading="lazy" />
}
