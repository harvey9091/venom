/**
 * VenomFloatingDock — wraps the Aceternity Floating Dock with Venom CRM's
 * nav items + theme-aware styling + SPA router integration.
 *
 * - Desktop: bottom-center floating glassmorphism dock with magnification
 * - Mobile: full-width bottom navigation bar
 * - Icons only; hover expands a label tooltip (desktop)
 * - Respects theme, accent color, glass intensity, radius, animation speed
 * - Active item highlighted with primary tint
 */
'use client'

import { FloatingDock, type FloatingDockItem } from '@/components/ui/floating-dock'
import { useAppStore } from '@/lib/store'
import {
  LayoutDashboard, Workflow, KanbanSquare, UserPlus, Target, ListTodo, StickyNote, Settings,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

const NAV_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' as const },
  { title: 'Automations', icon: Workflow, view: 'automations' as const },
  { title: 'Pipeline', icon: KanbanSquare, view: 'pipeline' as const },
  { title: 'Leads', icon: UserPlus, view: 'leads' as const },
  { title: 'Deals', icon: Target, view: 'deals' as const },
  { title: 'Tasks', icon: ListTodo, view: 'tasks' as const },
  { title: 'Notes', icon: StickyNote, view: 'notes' as const },
  { title: 'Settings', icon: Settings, view: 'settings' as const },
]

export function VenomFloatingDock() {
  const navigate = useAppStore((s) => s.navigate)
  const currentView = useAppStore((s) => s.route.view)
  const prefersReduced = useReducedMotion()

  const items: FloatingDockItem[] = NAV_ITEMS.map((item) => ({
    title: item.title,
    icon: <item.icon size={18} strokeWidth={2} />,
    onClick: () => navigate(item.view),
    active: currentView === item.view,
  }))

  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <FloatingDock items={items} />
    </motion.div>
  )
}
