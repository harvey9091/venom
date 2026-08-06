/**
 * Global keyboard shortcuts.
 *   ⌘K / Ctrl+K  — open command palette
 *   ⌘J / Ctrl+J  — open AI Assistant
 *   g d / g c / g l / g p / g t / g a  — go to dashboard / companies / leads / pipeline / tasks / automations
 *   ⌘\          — toggle sidebar
 *   ⌘/          — show shortcuts help
 */
'use client'

import { useEffect } from 'react'
import { useAppStore } from './store'

export function useKeyboardShortcuts() {
  const navigate = useAppStore((s) => s.navigate)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const commandOpen = useAppStore((s) => s.commandOpen)
  const openAssistant = useAppStore((s) => s.openAssistant)
  const assistantOpen = useAppStore((s) => s.assistantOpen)

  useEffect(() => {
    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      // ⌘K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(!commandOpen)
        return
      }

      // ⌘J / Ctrl+J — AI Assistant
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        useAppStore.getState().setAssistantOpen(!useAppStore.getState().assistantOpen)
        return
      }

      // ⌘\ — toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      if (isTyping) return

      // g + key navigation (Linear/Vim style)
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPressed = true
        if (gTimer) clearTimeout(gTimer)
        gTimer = setTimeout(() => { gPressed = false }, 800)
        return
      }
      if (gPressed) {
        const map: Record<string, () => void> = {
          d: () => navigate('dashboard'),
          a: () => navigate('automations'),
          p: () => navigate('pipeline'),
          l: () => navigate('leads'),
          e: () => navigate('deals'),
          t: () => navigate('tasks'),
          n: () => navigate('notes'),
          s: () => navigate('settings'),
        }
        if (map[e.key]) {
          e.preventDefault()
          map[e.key]()
        }
        gPressed = false
        if (gTimer) clearTimeout(gTimer)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setCommandOpen, toggleSidebar, commandOpen, openAssistant, assistantOpen])
}

