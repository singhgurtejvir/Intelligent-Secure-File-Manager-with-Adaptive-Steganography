import { motion, useReducedMotion } from 'framer-motion'
import { VaultFile } from '@/utils/api'

function cardHeight(index: number) {
  const heights = ['tall', 'wide', 'medium', 'large']
  return heights[index % heights.length]
}

export default function PhotoCard({
  file,
  index,
}: {
  file: VaultFile
  index: number
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.article
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0.16 } : { duration: 0.36, delay: index * 0.06, ease: 'easeOut' }}
      className={`photo-card photo-card-${cardHeight(index)}`}
    >
      <div className="photo-card-media">
        <div className="photo-card-gradient" />
        <div className="photo-card-overlay">
          <span className="photo-card-name">
            {file.carrierOriginalName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}
          </span>
          <span className="photo-card-caption">{new Date(file.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.article>
  )
}
