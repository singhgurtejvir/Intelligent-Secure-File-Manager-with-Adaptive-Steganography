import { motion, useReducedMotion } from 'framer-motion'
import { staggerContainer } from '@/animations/variants'
import { VaultFile } from '@/utils/api'
import PhotoCard from '@/components/PhotoCard'

export default function GalleryGrid({ files }: { files: VaultFile[] }) {
  const reduceMotion = useReducedMotion()

  if (files.length === 0) {
    return (
      <div className="gallery-empty-state">
        <div className="gallery-empty-illustration" />
        <h2>No photographs yet</h2>
        <p>Upload your first photo to begin curating your private portfolio.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={reduceMotion ? undefined : staggerContainer}
      className="gallery-masonry"
    >
      {files.map((file, index) => (
        <PhotoCard key={file.id} file={file} index={index} />
      ))}
    </motion.div>
  )
}
