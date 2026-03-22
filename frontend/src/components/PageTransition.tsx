import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { pageVariants } from '@/animations/variants'

export default function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : 'initial'}
      animate={reduceMotion ? { opacity: 1 } : 'animate'}
      exit={reduceMotion ? { opacity: 0 } : 'exit'}
      variants={reduceMotion ? undefined : pageVariants}
      className="page-shell"
    >
      {children}
    </motion.div>
  )
}
