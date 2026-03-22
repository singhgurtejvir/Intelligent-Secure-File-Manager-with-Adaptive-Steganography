import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { toastVariants } from '@/animations/variants'
import { useVaultStore } from '@/store/vaultStore'

function ToastCard({
  id,
  title,
  description,
  tone,
}: {
  id: string
  title: string
  description?: string
  tone: 'success' | 'warning' | 'error' | 'info'
}) {
  const removeToast = useVaultStore((state) => state.removeToast)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timeout = window.setTimeout(() => removeToast(id), 4000)
    return () => window.clearTimeout(timeout)
  }, [id, removeToast])

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : 'initial'}
      animate={reduceMotion ? { opacity: 1 } : 'animate'}
      exit={reduceMotion ? { opacity: 0 } : 'exit'}
      variants={reduceMotion ? undefined : toastVariants}
      className={`toast-card toast-${tone}`}
    >
      <div className="toast-title-row">
        <strong>{title}</strong>
        <button type="button" className="toast-dismiss" onClick={() => removeToast(id)}>
          Close
        </button>
      </div>
      {description ? <p className="toast-description">{description}</p> : null}
      <div className="toast-progress" />
    </motion.div>
  )
}

export default function Toast() {
  const toasts = useVaultStore((state) => state.toasts)

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} {...toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
