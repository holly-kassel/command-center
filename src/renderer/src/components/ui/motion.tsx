/* eslint-disable react-refresh/only-export-components */

import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react'
import { motion, type HTMLMotionProps, type Transition } from 'framer-motion'

/** Snappy spring for micro-interactions (buttons, hovers) */
export const springSnap: Transition = { type: 'spring', stiffness: 500, damping: 30 }

/** Gentle spring for layout animations (panels moving) */
export const springGentle: Transition = { type: 'spring', stiffness: 300, damping: 30 }

/** Smooth spring for overlays */
export const springOverlay: Transition = { type: 'spring', stiffness: 400, damping: 35 }

export interface MotionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Skip hover/tap animations (for when the button is inside another animated element) */
  noAnimation?: boolean
}

export function MotionButton({ noAnimation, children, ...props }: MotionButtonProps): ReactElement {
  if (noAnimation || props.disabled) {
    return <button {...props}>{children}</button>
  }

  const motionProps = props as HTMLMotionProps<'button'>

  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={springSnap}
      {...motionProps}
    >
      {children}
    </motion.button>
  )
}

export interface MotionCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Skip hover animation */
  noHover?: boolean
}

export function MotionCard({
  noHover,
  children,
  className,
  ...props
}: MotionCardProps): ReactElement {
  const motionProps = props as HTMLMotionProps<'div'>

  return (
    <motion.div
      whileHover={noHover ? undefined : { y: -1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      transition={springSnap}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}

export interface AnimatedOverlayProps {
  children: ReactNode
  onClose?: () => void
  /** Backdrop click closes overlay */
  closeOnBackdrop?: boolean
  /** Overlay content max width class (default: 'max-w-lg') */
  maxWidth?: string
  /** Entry animation style */
  animation?: 'scale' | 'slide-right' | 'slide-up'
}

export function AnimatedOverlay({
  children,
  onClose,
  closeOnBackdrop = true,
  maxWidth = 'max-w-lg',
  animation = 'scale'
}: AnimatedOverlayProps): ReactElement {
  const contentVariants = {
    scale: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 }
    },
    'slide-right': {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' }
    },
    'slide-up': {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 }
    }
  }

  const variant = contentVariants[animation]
  const containerClassName =
    animation === 'slide-right'
      ? 'fixed inset-0 z-50 flex items-stretch justify-end'
      : animation === 'slide-up'
        ? 'fixed inset-0 z-50 flex items-end justify-center'
        : 'fixed inset-0 z-50 flex items-center justify-center'
  const contentClassName =
    animation === 'slide-right'
      ? `relative h-full w-full ${maxWidth}`
      : `relative w-full ${maxWidth}`

  return (
    <motion.div
      className={containerClassName}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div className={contentClassName} {...variant} transition={springOverlay}>
        {children}
      </motion.div>
    </motion.div>
  )
}

export interface StaggerContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Delay between each child in seconds */
  staggerDelay?: number
}

export function StaggerContainer({
  children,
  staggerDelay = 0.05,
  className,
  ...props
}: StaggerContainerProps): ReactElement {
  const motionProps = props as HTMLMotionProps<'div'>

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } }
      }}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): ReactElement {
  const motionProps = props as HTMLMotionProps<'div'>

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: springGentle }
      }}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}

export function FadeIn({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): ReactElement {
  const motionProps = props as HTMLMotionProps<'div'>

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}
