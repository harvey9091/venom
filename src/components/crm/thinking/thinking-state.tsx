/**
 * <ThinkingState /> — the public, reusable component for every AI/system
 * activity indicator across the CRM.
 *
 * Props:
 *   state        The label text ("Searching…")
 *   size         xs | sm | md | lg | xl       (default md)
 *   variant      single | trio | orbit | pulse (default trio)
 *   theme        primary | rainbow | mono      (default primary — inherits theme)
 *   label        Alias for `state`
 *   animated     Toggle motion (default true; auto-disabled for reduced-motion users)
 *   fullscreen   Render as a centered fullscreen overlay (with backdrop blur)
 *   compact      Inline layout — no label below; useful inside inputs/buttons
 *   overlay      Render with a translucent backdrop (lighter than fullscreen)
 *   progress     0-100, shows a progress ring around a `single` variant orb
 *   className    Custom class for the wrapper
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so screen readers announce state changes
 *   - aria-label includes the label text
 *   - Respects prefers-reduced-motion (orb becomes static)
 *   - Never blocks pointer events unless `fullscreen` or `overlay` is set
 *
 * Theme support:
 *   - All colors come from CSS variables (var(--primary), var(--chart-1..5))
 *   - Automatically adapts to every theme + dark mode
 *   - No hardcoded colors anywhere
 */
'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Orb, type OrbSize, type OrbTheme, type OrbVariant } from './orb'
import { cn } from '@/lib/utils'

const LABEL_SIZE: Record<OrbSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-[11px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
}

const LABEL_WEIGHT: Record<OrbSize, string> = {
  xs: 'font-normal',
  sm: 'font-medium',
  md: 'font-medium',
  lg: 'font-semibold',
  xl: 'font-semibold',
}

const LABEL_OPACITY: Record<OrbSize, string> = {
  xs: 'text-muted-foreground/80',
  sm: 'text-muted-foreground',
  md: 'text-muted-foreground',
  lg: 'text-foreground/80',
  xl: 'text-foreground',
}

const COMPACT_SIZE_MAP: Record<OrbSize, OrbSize> = {
  xs: 'xs',
  sm: 'sm',
  md: 'sm',
  lg: 'md',
  xl: 'lg',
}

export interface ThinkingStateProps {
  state?: string
  label?: string
  size?: OrbSize
  variant?: OrbVariant
  theme?: OrbTheme
  animated?: boolean
  fullscreen?: boolean
  compact?: boolean
  overlay?: boolean
  progress?: number
  className?: string
  children?: React.ReactNode
}

export function ThinkingState({
  state,
  label,
  size = 'md',
  variant = 'trio',
  theme = 'primary',
  animated = true,
  fullscreen = false,
  compact = false,
  overlay = false,
  progress,
  className,
  children,
}: ThinkingStateProps) {
  const prefersReduced = useReducedMotion()
  const shouldAnimate = animated && !prefersReduced
  const labelText = state ?? label
  const hasLabel = !!labelText && !compact

  // Compact: render orb + label inline on one row. Used inside search inputs,
  // buttons, table cells, etc.
  if (compact) {
    const orbSize: OrbSize = COMPACT_SIZE_MAP[size]
    return (
      <span
        className={cn('inline-flex items-center gap-1.5', className)}
        role="status"
        aria-live="polite"
        aria-label={labelText || 'Working'}
      >
        <Orb size={orbSize} variant={variant === 'single' ? 'trio' : variant} theme={theme} animated={shouldAnimate} progress={progress} />
        {labelText && <span className={cn(LABEL_SIZE[orbSize], LABEL_WEIGHT[orbSize], LABEL_OPACITY[orbSize])}>{labelText}</span>}
      </span>
    )
  }

  // Inline (default): orb centered above label, fades in.
  const content = (
    <motion.div
      className={cn('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
      aria-label={labelText || 'Working'}
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Orb size={size} variant={variant} theme={theme} animated={shouldAnimate} progress={progress} />
      {hasLabel && (
        <motion.div
          className={cn('text-center', LABEL_SIZE[size], LABEL_WEIGHT[size], LABEL_OPACITY[size])}
          key={labelText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          {labelText}
        </motion.div>
      )}
      {children}
    </motion.div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
        <div className="flex flex-col items-center">{content}</div>
      </div>
    )
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-inherit">
        {content}
      </div>
    )
  }

  return content
}

/**
 * Animated wrapper that mounts/unmounts its child with a thinking-state
 * transition. Use this to swap between "content" and "thinking" states.
 *
 * <ThinkingSwap isThinking={isLoading} label="Loading…">
 *   <RealContent />
 * </ThinkingSwap>
 */
export function ThinkingSwap({
  isThinking,
  label,
  size = 'md',
  variant = 'trio',
  theme = 'primary',
  children,
  className,
}: {
  isThinking: boolean
  label?: string
  size?: OrbSize
  variant?: OrbVariant
  theme?: OrbTheme
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait">
        {isThinking ? (
          <motion.div
            key="thinking"
            className="flex items-center justify-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ThinkingState label={label} size={size} variant={variant} theme={theme} />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
