import { motion } from 'framer-motion'
import { vaultRowItem } from '@/animations/variants'
import { VaultFile } from '@/utils/api'
import { formatFileSize } from '@/utils/steganography'

function getMethod(file: VaultFile) {
  return file.carrierMimeType === 'image/jpeg' ? 'DCT' : 'LSB'
}

export default function VaultRow({
  file,
  onDecrypt,
  onDelete,
  deleting,
}: {
  file: VaultFile
  onDecrypt: (file: VaultFile) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const method = getMethod(file)
  const methodClass = method === 'DCT' ? 'method-dct' : 'method-lsb'

  return (
    <motion.article variants={vaultRowItem} className="vault-row">
      <div className={`vault-row-icon ${methodClass}`}>{method}</div>
      <div className="vault-row-main">
        <strong>{file.originalPayloadName}</strong>
        <span>{file.carrierOriginalName}</span>
      </div>
      <div className="vault-row-meta">
        <span className={`method-badge ${methodClass}`}>{method}</span>
        <span>{formatFileSize(file.originalPayloadSize)}</span>
      </div>
      <div className="vault-row-actions">
        <button className="button-secondary" onClick={() => onDecrypt(file)}>
          Decrypt
        </button>
        <button className="button-danger" onClick={() => onDelete(file.id)} disabled={deleting}>
          {deleting ? 'Removing...' : 'Delete'}
        </button>
      </div>
    </motion.article>
  )
}
