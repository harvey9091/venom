/**
 * Theme engine — 14 handcrafted themes + deep customization.
 * Themes are applied via [data-theme="..."] on <html>.
 * Customization vars (radius, accent, density, etc.) are applied inline.
 */
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ThemePreset {
  id: string
  name: string
  swatch: string[] // 3 colors for preview chip
  dark: boolean
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'claude-dark', name: 'Claude Dark', swatch: ['#2b2723', '#d4a373', '#3a3530'], dark: true },
  { id: 'claude-light', name: 'Claude Light', swatch: ['#f5f0e8', '#c2673a', '#ebe3d6'], dark: false },
  { id: 'frosted', name: 'Glass', swatch: ['#e8ecf5', '#5b6ee8', '#d4dcf0'], dark: false },
  { id: 'silver', name: 'Monochrome Silver', swatch: ['#fafafa', '#525252', '#e5e5e5'], dark: false },
  { id: 'midnight', name: 'Midnight Black', swatch: ['#0a0a0a', '#ffffff', '#1a1a1a'], dark: true },
  { id: 'graphite', name: 'Graphite', swatch: ['#1a1a22', '#a3a3b8', '#2a2a35'], dark: true },
  { id: 'pure-white', name: 'Pure White', swatch: ['#ffffff', '#171717', '#f5f5f5'], dark: false },
]

export type Density = 'compact' | 'comfortable' | 'spacious'
export type SidebarStyle = 'floating' | 'inset' | 'compact'
export type CardStyle = 'outlined' | 'elevated' | 'filled'
export type AnimSpeed = 'instant' | 'fast' | 'normal' | 'slow'

export interface ThemeConfig {
  theme: string
  accent: string
  radius: number // px
  font: string
  sidebarStyle: SidebarStyle
  cardStyle: CardStyle
  density: Density
  glassIntensity: number // 0-100 (blur amount)
  animSpeed: AnimSpeed
}

const DEFAULT_CONFIG: ThemeConfig = {
  theme: 'claude-dark',
  accent: '#d4a373',
  radius: 8,
  font: 'geist',
  sidebarStyle: 'inset',
  cardStyle: 'outlined',
  density: 'compact',
  glassIntensity: 50,
  animSpeed: 'fast',
}

interface ThemeStore {
  config: ThemeConfig
  setTheme: (id: string) => void
  setAccent: (hex: string) => void
  setRadius: (px: number) => void
  setFont: (id: string) => void
  setSidebarStyle: (s: SidebarStyle) => void
  setCardStyle: (c: CardStyle) => void
  setDensity: (d: Density) => void
  setGlassIntensity: (n: number) => void
  setAnimSpeed: (s: AnimSpeed) => void
  reset: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      setTheme: (theme) => set((s) => ({ config: { ...s.config, theme } })),
      setAccent: (accent) => set((s) => ({ config: { ...s.config, accent } })),
      setRadius: (radius) => set((s) => ({ config: { ...s.config, radius } })),
      setFont: (font) => set((s) => ({ config: { ...s.config, font } })),
      setSidebarStyle: (sidebarStyle) => set((s) => ({ config: { ...s.config, sidebarStyle } })),
      setCardStyle: (cardStyle) => set((s) => ({ config: { ...s.config, cardStyle } })),
      setDensity: (density) => set((s) => ({ config: { ...s.config, density } })),
      setGlassIntensity: (glassIntensity) => set((s) => ({ config: { ...s.config, glassIntensity } })),
      setAnimSpeed: (animSpeed) => set((s) => ({ config: { ...s.config, animSpeed } })),
      reset: () => set({ config: DEFAULT_CONFIG }),
    }),
    { name: 'pulse-theme' }
  )
)

/**
 * Convert hex to oklch string for CSS variable overrides.
 * Lightweight conversion: hex -> rgb -> oklch via a simple matrix.
 */
export function hexToOklch(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  // Linearize
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const R = lin(r), G = lin(g), B = lin(b)
  // sRGB -> XYZ
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B
  // XYZ -> OKLab
  const l = Math.cbrt(X * 0.8189330101 + Y * 0.3618667424 + Z * -0.1288597137)
  const m = Math.cbrt(X * 0.0329845436 + Y * 0.9293118715 + Z * 0.0361456387)
  const s = Math.cbrt(X * 0.0482003018 + Y * 0.2643662691 + Z * 0.6338517070)
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  const C = Math.sqrt(a * a + b2 * b2)
  const H = (Math.atan2(b2, a) * 180) / Math.PI
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${(H < 0 ? H + 360 : H).toFixed(1)})`
}

/**
 * Apply the entire theme configuration to the document element.
 */
export function applyTheme(cfg: ThemeConfig) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // Theme
  root.setAttribute('data-theme', cfg.theme)
  // Dark mode toggle for shadcn components
  const isDark = THEME_PRESETS.find((t) => t.id === cfg.theme)?.dark ?? false
  root.classList.toggle('dark', isDark)
  // Accent
  root.style.setProperty('--primary', hexToOklch(cfg.accent))
  root.style.setProperty('--ring', hexToOklch(cfg.accent))
  root.style.setProperty('--sidebar-primary', hexToOklch(cfg.accent))
  // Radius
  root.style.setProperty('--radius', `${cfg.radius / 16}rem`)
  // Density / sidebar / card / anim
  root.setAttribute('data-density', cfg.density)
  root.setAttribute('data-sidebar-style', cfg.sidebarStyle)
  root.setAttribute('data-card-style', cfg.cardStyle)
  root.setAttribute('data-anim-speed', cfg.animSpeed)
  // Glass
  const blur = 4 + (cfg.glassIntensity / 100) * 28
  root.style.setProperty('--glass-blur', `${blur}px`)
  // Font
  const fontMap: Record<string, string> = {
    geist: 'var(--font-geist-sans)',
    inter: 'Inter, system-ui, sans-serif',
    mono: 'var(--font-geist-mono), monospace',
    serif: 'Georgia, "Times New Roman", serif',
  }
  root.style.setProperty('--font-sans', fontMap[cfg.font] || fontMap.geist)
}
