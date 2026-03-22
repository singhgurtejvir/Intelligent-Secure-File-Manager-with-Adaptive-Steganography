import { motion, useReducedMotion } from 'framer-motion'
import { vaultRows } from '@/animations/variants'
import { VaultFile } from '@/utils/api'
import VaultRow from '@/components/VaultRow'

export default function VaultList({
  files,
  deletingId,
  onDecrypt,
  onDelete,
}: {
  files: VaultFile[]
  deletingId: string | null
  onDecrypt: (file: VaultFile) => void
  onDelete: (id: string) => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={reduceMotion ? undefined : vaultRows}
      className="vault-list"
    >
      {files.map((file) => (
        <VaultRow
          key={file.id}
          file={file}
          onDecrypt={onDecrypt}
          onDelete={onDelete}
          deleting={deletingId === file.id}
        />
      ))}
    </motion.div>
  )
}
