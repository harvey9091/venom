/**
 * AppContentContainer — the single reusable layout container for every page.
 *
 * Phase 5: No page is allowed to decide its own width. Every view renders
 * inside this component and picks a semantic preset.
 *
 * Presets map to CSS variables defined in globals.css:
 *   - compact   → 1320px  (Notes)
 *   - standard  → 1450px  (Dashboard, Tasks, Settings)
 *   - wide      → 1560px  (Leads, Deals, Pipeline)
 *   - extrawide → 1640px  (Automations)
 *   - full      → 100%    (full-bleed, e.g. automation canvas only)
 *
 * The container:
 *   - Centers horizontally with `mx-auto`
 *   - Applies responsive horizontal padding from `--page-horizontal-padding`
 *   - Applies vertical padding from `--page-vertical-padding`
 *   - When Floating Dock mode is active, the CSS variable for padding
 *     automatically increases (see `[data-nav-mode="dock"]` in globals.css)
 *     so the app occupies ~70-80% of the viewport with generous margins.
 *   - Animates width/padding smoothly when switching nav modes
 *     (handled by the parent motion.div in AppShell).
 */
'use client'

import { cn } from '@/lib/utils'

export type ContentPreset = 'compact' | 'standard' | 'wide' | 'extrawide' | 'full'

const PRESET_MAX_WIDTH: Record<ContentPreset, string> = {
  compact: 'var(--content-width-compact)',
  standard: 'var(--content-width-standard)',
  wide: 'var(--content-width-wide)',
  extrawide: 'var(--content-width-extrawide)',
  full: '100%',
}

interface AppContentContainerProps {
  preset?: ContentPreset
  children: React.ReactNode
  className?: string
  /** Override vertical padding (some pages want flush top) */
  flushVertical?: boolean
  /** Disable horizontal padding (canvas pages manage their own) */
  flushHorizontal?: boolean
}

export function AppContentContainer({
  preset = 'standard',
  children,
  className,
  flushVertical = false,
  flushHorizontal = false,
}: AppContentContainerProps) {
  return (
    <div
      className={cn('view-enter', className)}
      style={{
        maxWidth: PRESET_MAX_WIDTH[preset],
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: flushHorizontal ? undefined : 'var(--page-horizontal-padding)',
        paddingRight: flushHorizontal ? undefined : 'var(--page-horizontal-padding)',
        paddingTop: flushVertical ? undefined : 'var(--page-vertical-padding)',
        paddingBottom: flushVertical ? undefined : 'var(--page-vertical-padding)',
        // Smooth padding/max-width transition when switching nav modes (sidebar↔dock)
        transition: 'max-width 0.28s cubic-bezier(0.22, 1, 0.36, 1), padding-left 0.28s cubic-bezier(0.22, 1, 0.36, 1), padding-right 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  )
}

/**
 * Helper hook for pages that need to know the current content width
 * (e.g., the automation canvas needs to fill remaining space).
 * Returns the CSS var string for the given preset.
 */
export function getContentWidth(preset: ContentPreset): string {
  return PRESET_MAX_WIDTH[preset]
}
