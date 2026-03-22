import { motion, useReducedMotion } from 'framer-motion'

interface CapacityMeterProps {
  usedPercent: number
  method: 'lsb' | 'dct' | 'multi-file'
  status: 'safe' | 'warning' | 'over'
}

const methodMeta = {
  lsb: { label: 'LSB - PNG detected', color: 'var(--accent-teal)' },
  dct: { label: 'DCT - JPEG detected', color: 'var(--accent-blue)' },
  'multi-file': { label: 'Multi - fallback', color: 'var(--accent-gold)' },
}

export default function CapacityMeter({ usedPercent, method, status }: CapacityMeterProps) {
  const reduceMotion = useReducedMotion()
  const clamped = Math.min(usedPercent, 100)
  const statusClass = status === 'over' ? 'capacity-over' : status === 'warning' ? 'capacity-warning' : 'capacity-safe'

  return (
    <div className={`capacity-card ${statusClass}`}>
      <div className="capacity-bar-shell">
        <motion.div
          className="capacity-bar-fill"
          initial={reduceMotion ? { width: `${clamped}%` } : { width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18 }}
        />
      </div>
      <div className="capacity-meta">
        <span>{usedPercent.toFixed(1)}% used</span>
        <span className="capacity-method">
          <span className="capacity-method-dot" style={{ backgroundColor: methodMeta[method].color }} />
          {methodMeta[method].label}
        </span>
      </div>
      {status === 'over' ? (
        <div className="capacity-warning-banner">
          Payload too large - visual artifacts may occur. Reduce payload or use a larger carrier.
        </div>
      ) : null}
    </div>
  )
}
