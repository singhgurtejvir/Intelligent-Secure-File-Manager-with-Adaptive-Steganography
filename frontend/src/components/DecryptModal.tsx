import { FormEvent, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { modalVariants } from '@/animations/variants'
import { VaultFile } from '@/utils/api'
import { formatFileSize } from '@/utils/steganography'

export default function DecryptModal({
  file,
  password,
  onPasswordChange,
  onClose,
  onSubmit,
  decrypting,
  contextStatus,
}: {
  file: VaultFile | null
  password: string
  onPasswordChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  decrypting: boolean
  contextStatus: {
    tone: 'success' | 'warning' | 'checking' | 'neutral'
    label: string
    detail: string
  }
}) {
  const reduceMotion = useReducedMotion()
  const method = useMemo(
    () => (file?.carrierMimeType === 'image/jpeg' ? 'DCT' : 'LSB'),
    [file],
  )

  return (
    <AnimatePresence>
      {file ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="decrypt-sheet"
            initial={reduceMotion ? { opacity: 0 } : 'initial'}
            animate={reduceMotion ? { opacity: 1 } : 'animate'}
            exit={reduceMotion ? { opacity: 0 } : 'exit'}
            variants={reduceMotion ? undefined : modalVariants}
          >
            <div className="decrypt-sheet-header">
              <div>
                <span className="eyebrow">Decrypt file</span>
                <h2>{file.originalPayloadName}</h2>
              </div>
              <button className="button-ghost" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="decrypt-sheet-grid">
              <div className="info-card">
                <span className="info-label">Carrier</span>
                <strong>{file.carrierOriginalName}</strong>
                <span className="info-subtle">{formatFileSize(file.originalPayloadSize)}</span>
              </div>
              <div className="info-card">
                <span className="info-label">Context check</span>
                <strong
                  className={
                    contextStatus.tone === 'success'
                      ? 'match-yes'
                      : contextStatus.tone === 'warning'
                        ? 'match-no'
                        : ''
                  }
                >
                  {contextStatus.label}
                </strong>
                <span className="info-subtle">
                  {contextStatus.detail || `${method} method`}
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="decrypt-form">
              <label className="field">
                <span>Passphrase</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  placeholder="Enter your vault passphrase"
                  className="field-input"
                />
              </label>

              <div className="decrypt-form-actions">
                <button type="button" className="button-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="button-primary" disabled={decrypting}>
                  {decrypting ? 'Decrypting...' : 'Decrypt & Download'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
