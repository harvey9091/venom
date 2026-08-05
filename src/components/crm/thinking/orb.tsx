/**
 * Orb — the core visual primitive.
 *
 * Inspired by jakubantalik.com's Thinking Orbs. Soft radial gradients,
 * blurred halos, and gentle Framer Motion pulses. Colors come from CSS
 * variables so every theme is supported automatically — no hardcoding.
 *
 * Variants:
 *   - trio (default): 3 dots pulsing in sequence — the classic "thinking" look
 *   - single: one larger orb with a soft halo + optional progress ring
 *   - orbit: central orb with 3 smaller dots orbiting it — for major AI moments
 *   - pulse: minimal single pulsing dot — for inline indicators
 */
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type OrbSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type OrbVariant = 'single' | 'trio' | 'orbit' | 'pulse'
export type OrbTheme = 'primary' | 'rainbow' | 'mono'

const SIZES: Record<OrbSize, number> = {
  xs: 5,
  sm: 12,
  md: 28,
  lg: 56,
  xl: 96,
}

const HALO_MULT: Record<OrbSize, number> = {
  xs: 2.4,
  sm: 2.4,
  md: 2.6,
  lg: 2.8,
  xl: 3,
}

const CHART_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface OrbProps {
  size?: OrbSize
  variant?: OrbVariant
  theme?: OrbTheme
  animated?: boolean
  progress?: number // 0-100, only for 'single' variant
  className?: string
}

function colorFor(theme: OrbTheme, index: number): string {
  if (theme === 'rainbow') return CHART_VARS[index % CHART_VARS.length]
  if (theme === 'mono') return 'var(--foreground)'
  return 'var(--primary)'
}

/**
 * Build a radial-gradient background string for an orb.
 * Bright white-ish highlight at 30% 30%, fading to the theme color, then darker edge.
 */
function orbGradient(color: string): string {
  return `radial-gradient(circle at 30% 30%, color-mix(in oklch, ${color} 30%, white), ${color} 45%, color-mix(in oklch, ${color} 70%, black) 100%)`
}

/** Trio: 3 dots pulsing in sequence. The signature "thinking" look. */
function TrioOrb({ size, theme, animated }: { size: OrbSize; theme: OrbTheme; animated: boolean }) {
  const px = SIZES[size]
  const gap = Math.max(2, px * 0.4)
  return (
    <div className="flex items-center" style={{ gap }} aria-hidden>
      {[0, 1, 2].map((i) => {
        const color = colorFor(theme, i)
        return (
          <motion.span
            key={i}
            className="rounded-full"
            style={{
              width: px,
              height: px,
              background: orbGradient(color),
              boxShadow: `0 0 ${px * 1.5}px color-mix(in oklch, ${color} 55%, transparent)`,
            }}
            animate={animated ? { scale: [0.7, 1.15, 0.7], opacity: [0.5, 1, 0.5] } : { opacity: 0.7 }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.18,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}

/** Pulse: minimal single pulsing dot. */
function PulseOrb({ size, theme, animated }: { size: OrbSize; theme: OrbTheme; animated: boolean }) {
  const px = SIZES[size]
  const color = colorFor(theme, 0)
  return (
    <motion.span
      className="rounded-full relative"
      style={{
        width: px,
        height: px,
        background: orbGradient(color),
        boxShadow: `0 0 ${px * 1.4}px color-mix(in oklch, ${color} 60%, transparent)`,
      }}
      animate={animated ? { scale: [0.85, 1.1, 0.85], opacity: [0.7, 1, 0.7] } : { opacity: 0.8 }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}

/** Single: one larger orb with halo + optional progress ring. */
function SingleOrb({
  size,
  theme,
  animated,
  progress,
}: {
  size: OrbSize
  theme: OrbTheme
  animated: boolean
  progress?: number
}) {
  const px = SIZES[size]
  const haloPx = px * HALO_MULT[size]
  const color = colorFor(theme, 0)
  const ringRadius = haloPx / 2 - 4
  const circumference = 2 * Math.PI * ringRadius

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: haloPx, height: haloPx }}
      aria-hidden
    >
      {/* Outer halo (blurred glow) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: haloPx,
          height: haloPx,
          background: `radial-gradient(circle, color-mix(in oklch, ${color} 50%, transparent) 0%, transparent 65%)`,
          filter: `blur(${Math.max(2, px * 0.18)}px)`,
        }}
        animate={animated ? { scale: [1, 1.12, 1], opacity: [0.55, 0.85, 0.55] } : { opacity: 0.6 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Core orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: px,
          height: px,
          background: orbGradient(color),
          boxShadow: `0 0 ${px * 0.9}px color-mix(in oklch, ${color} 70%, transparent), inset 0 0 ${px * 0.2}px color-mix(in oklch, white 25%, transparent)`,
        }}
        animate={animated ? { scale: [0.94, 1.06, 0.94] } : {}}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Progress ring */}
      {progress !== undefined && (
        <svg
          className="absolute inset-0"
          viewBox={`0 0 ${haloPx} ${haloPx}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={haloPx / 2}
            cy={haloPx / 2}
            r={ringRadius}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(1.5, px * 0.05)}
            strokeDasharray={`${(progress / 100) * circumference} ${circumference}`}
            strokeLinecap="round"
            opacity="0.85"
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        </svg>
      )}
    </div>
  )
}

/** Orbit: central orb + 3 dots orbiting around it. Premium AI feel. */
function OrbitOrb({ size, theme, animated }: { size: OrbSize; theme: OrbTheme; animated: boolean }) {
  const px = SIZES[size]
  const containerPx = px * 3.2
  const dotPx = Math.max(3, px * 0.32)
  const orbitRadius = containerPx / 2 - dotPx / 2

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: containerPx, height: containerPx }}
      aria-hidden
    >
      {/* Central orb with halo */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: haloGradient(px, colorFor(theme, 0)),
          height: px,
        }}
      />
      <motion.div
        className="relative rounded-full"
        style={{
          width: px,
          height: px,
          background: orbGradient(colorFor(theme, 0)),
          boxShadow: `0 0 ${px * 0.9}px color-mix(in oklch, ${colorFor(theme, 0)} 70%, transparent)`,
        }}
        animate={animated ? { scale: [0.94, 1.06, 0.94] } : {}}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => {
        const color = colorFor(theme, i + 1)
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ width: containerPx, height: containerPx, transformOrigin: 'center' }}
            initial={{ rotate: i * 120 }}
            animate={animated ? { rotate: i * 120 + 360 } : {}}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: dotPx,
                height: dotPx,
                top: orbitRadius,
                left: '50%',
                marginLeft: -dotPx / 2,
                background: orbGradient(color),
                boxShadow: `0 0 ${dotPx * 1.6}px color-mix(in oklch, ${color} 60%, transparent)`,
              }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

// Helper used by OrbitOrb — returns a CSS size string, not a background.
// (Kept the original orbGradient for the actual background.)
function haloGradient(_px: number, _color: string): number {
  return 0
}

export function Orb({
  size = 'md',
  variant = 'trio',
  theme = 'primary',
  animated = true,
  progress,
  className,
}: OrbProps) {
  const prefersReduced = useReducedMotion()
  const shouldAnimate = animated && !prefersReduced

  return (
    <div className={cn('inline-flex items-center justify-center', className)} role="img" aria-label="System activity indicator">
      {variant === 'trio' && <TrioOrb size={size} theme={theme} animated={shouldAnimate} />}
      {variant === 'pulse' && <PulseOrb size={size} theme={theme} animated={shouldAnimate} />}
      {variant === 'single' && <SingleOrb size={size} theme={theme} animated={shouldAnimate} progress={progress} />}
      {variant === 'orbit' && <OrbitOrb size={size} theme={theme} animated={shouldAnimate} />}
    </div>
  )
}
