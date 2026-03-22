import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { modalVariants } from '@/animations/variants'
import type { VaultFile } from '@/utils/api'
import type { FileMeta } from '@/store/fileStore'

export default function MetadataEditor({
  file,
  meta,
  open,
  onClose,
  onSave,
}: {
  file: VaultFile | null
  meta: FileMeta | undefined
  open: boolean
  onClose: () => void
  onSave: (updates: Pick<FileMeta, 'aliasName' | 'caption' | 'tags'>) => void
}) {
  const [aliasName, setAliasName] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    setAliasName(meta?.aliasName || file?.carrierOriginalName.replace(/\.[^/.]+$/, '') || '')
    setCaption(meta?.caption || '')
    setTags(meta?.tags?.join(', ') || '')
  }, [file, meta])

  return (
    <AnimatePresence>
      {open && file ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="metadata-sheet" variants={modalVariants} initial="initial" animate="animate" exit="exit">
            <div className="decrypt-sheet-header">
              <div>
                <span className="eyebrow">Metadata editor</span>
                <h2>{file.carrierOriginalName}</h2>
              </div>
              <button type="button" className="button-ghost" onClick={onClose}>
                Close
              </button>
            </div>

            <div className="metadata-sheet-grid">
              <label className="field">
                <span>Public display name</span>
                <input
                  className="field-input"
                  value={aliasName}
                  onChange={(event) => setAliasName(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Caption</span>
                <input
                  className="field-input"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </label>

              <label className="field metadata-sheet-field-wide">
                <span>Tags</span>
                <input
                  className="field-input"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="travel, contract, private"
                />
              </label>
            </div>

            <div className="decrypt-form-actions">
              <button type="button" className="button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  onSave({
                    aliasName: aliasName.trim(),
                    caption: caption.trim(),
                    tags: tags
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                  onClose()
                }}
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
