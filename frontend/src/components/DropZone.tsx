import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '@/animations/variants'
import { formatFileSize } from '@/utils/steganography'

interface DropZoneProps {
  label: string
  description: string
  accept?: string
  file: File | null
  previewUrl?: string | null
  onSelect: (file: File | null) => void
  compact?: boolean
  dataRole?: string
}

export default function DropZone({
  label,
  description,
  accept,
  file,
  previewUrl,
  onSelect,
  compact = false,
  dataRole,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : 'initial'}
      animate={reduceMotion ? { opacity: 1 } : 'animate'}
      variants={reduceMotion ? undefined : fadeInUp}
      className={`dropzone-card ${compact ? 'dropzone-compact' : ''} ${file ? 'dropzone-filled' : ''}`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        data-role={dataRole}
        className="sr-only"
        onChange={(event) => onSelect(event.target.files?.[0] || null)}
      />

      {previewUrl ? (
        <div className="dropzone-preview">
          <img src={previewUrl} alt={file?.name || label} className="dropzone-preview-image" />
          <div className="dropzone-overlay">
            <span className="dropzone-eyebrow">{label}</span>
            <strong>{file?.name}</strong>
          </div>
        </div>
      ) : (
        <div className="dropzone-empty">
          <span className="dropzone-eyebrow">{label}</span>
          <strong className="dropzone-title">{description}</strong>
          <p className="dropzone-help">
            {accept ? 'Drop a supported image or click to browse.' : 'Attach any file type.'}
          </p>
        </div>
      )}

      {file ? (
        <div className="dropzone-meta">
          <span>{file.name}</span>
          <span>{formatFileSize(file.size)}</span>
        </div>
      ) : null}
    </motion.div>
  )
}
