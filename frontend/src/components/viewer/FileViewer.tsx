import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import CarrierImage from '@/components/common/CarrierImage'
import type { FileMeta } from '@/store/fileStore'
import type { VaultFile } from '@/utils/api'

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export default function FileViewer({
  file,
  meta,
  isVaultActive,
  onClose,
  onDecrypt,
  onOpenMetadata,
  onDelete,
}: {
  file: VaultFile | null
  meta: FileMeta | undefined
  isVaultActive: boolean
  onClose: () => void
  onDecrypt: (file: VaultFile) => void
  onOpenMetadata: (fileId: string) => void
  onDelete: (fileId: string) => void
}) {
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    setZoom(100)
  }, [file?.id])

  useEffect(() => {
    if (!file) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
      if (event.key === '+' || event.key === '=') {
        setZoom((value) => clamp(value + 10, 50, 300))
      }
      if (event.key === '-') {
        setZoom((value) => clamp(value - 10, 50, 300))
      }
      if (event.key === '0') {
        setZoom(100)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [file, onClose])

  const fileInfo = useMemo(() => {
    if (!file) {
      return null
    }

    return {
      dimensions: file.carrierMimeType.includes('jpeg') ? 'Auto-detected in viewer' : 'Inline preview ready',
      size: `${(file.carrierSize / (1024 * 1024)).toFixed(1)} MB`,
    }
  }, [file])

  return (
    <AnimatePresence>
      {file ? (
        <motion.div className="viewer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="viewer-topbar">
            <button type="button" className="button-ghost" onClick={onClose}>
              Back
            </button>
            <div className="viewer-meta">
              <strong>{meta?.aliasName || file.carrierOriginalName}</strong>
              <span>{fileInfo?.size} | {file.carrierMimeType}</span>
            </div>
            <div className="viewer-topbar-actions">
              {isVaultActive ? (
                <button type="button" className="button-ghost" onClick={() => onOpenMetadata(file.id)}>
                  Edit
                </button>
              ) : null}
              <button type="button" className="button-ghost" onClick={() => onDelete(file.id)}>
                Delete
              </button>
            </div>
          </div>

          <div className="viewer-stage">
            <motion.div layoutId={`carrier-${file.id}`} className="viewer-image-shell">
              <div className="viewer-image-canvas" style={{ transform: `scale(${zoom / 100})` }}>
                <CarrierImage
                  fileId={file.id}
                  alt={meta?.aliasName || file.carrierOriginalName}
                  className="viewer-image"
                />
              </div>
            </motion.div>

            {isVaultActive ? (
              <aside className="viewer-info-panel">
                <div className="viewer-info-section">
                  <span className="eyebrow">Embedded payload</span>
                  <strong>{file.originalPayloadName}</strong>
                  <span>{(file.originalPayloadSize / 1024).toFixed(0)} KB</span>
                  <span>{(file.steganographyMethod || 'lsb').toUpperCase()} | AES-256-GCM</span>
                </div>

                <div className="viewer-info-section">
                  <span className="eyebrow">Carrier info</span>
                  <strong>{file.carrierOriginalName}</strong>
                  <span>{fileInfo?.dimensions}</span>
                  <span>Capacity {file.capacityUsedPercent?.toFixed(1) || '0.0'}%</span>
                  <div className="fm-status-pill">
                    <div
                      className="fm-status-pill-fill"
                      style={{ width: `${Math.min(file.capacityUsedPercent || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="viewer-info-section">
                  <span className="eyebrow">Access control</span>
                  <span>Device lock {isVaultActive ? 'enabled' : 'hidden'}</span>
                  <span>Storage {file.storageMode || 'embedded'}</span>
                </div>

                <div className="viewer-info-actions">
                  <button type="button" className="button-primary" onClick={() => onDecrypt(file)}>
                    Decrypt File
                  </button>
                  <button type="button" className="button-secondary" onClick={() => onOpenMetadata(file.id)}>
                    Edit Metadata
                  </button>
                </div>
              </aside>
            ) : null}
          </div>

          <div className="viewer-bottombar">
            <button type="button" className="button-ghost" onClick={() => setZoom((value) => clamp(value - 10, 50, 300))} disabled={zoom <= 50}>
              Zoom -
            </button>
            <span className="viewer-zoom">{zoom}%</span>
            <button type="button" className="button-ghost" onClick={() => setZoom(100)}>
              Reset
            </button>
            <button type="button" className="button-ghost" onClick={() => setZoom((value) => clamp(value + 10, 50, 300))} disabled={zoom >= 300}>
              Zoom +
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
