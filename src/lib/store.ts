/**
 * App store — current user, workspace, navigation, command palette,
 * notifications, drawers.
 */
'use client'

import { create } from 'zustand'
import type {
  User, Workspace, RouteState, ViewKey, Notification, Tag,
} from './types'

interface AppState {
  // Identity
  user: User | null
  workspace: Workspace | null
  setUser: (u: User | null) => void
  setWorkspace: (w: Workspace | null) => void

  // Navigation (client-side router)
  route: RouteState
  navigate: (view: ViewKey, params?: Record<string, unknown>) => void
  back: () => void
  history: RouteState[]
  forwardStack: RouteState[]

  // Command palette
  commandOpen: boolean
  setCommandOpen: (v: boolean) => void

  // Notifications inbox
  notifOpen: boolean
  setNotifOpen: (v: boolean) => void
  notifications: Notification[]
  setNotifications: (n: Notification[]) => void
  addNotification: (n: Notification) => void
  markAllRead: () => void
  markRead: (id: string) => void

  // Slide-over drawer for entity details
  drawer: { type: string; id?: string } | null
  openDrawer: (type: string, id?: string) => void
  closeDrawer: () => void

  // Global toast queue (using sonner directly elsewhere, but keep for app-level)
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void

  // Tags cache (workspace-wide)
  tags: Tag[]
  setTags: (t: Tag[]) => void

  // Realtime
  realtimeConnected: boolean
  setRealtimeConnected: (v: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  workspace: null,
  setUser: (u) => set({ user: u }),
  setWorkspace: (w) => set({ workspace: w }),

  route: { view: 'dashboard' },
  history: [{ view: 'dashboard' }],
  forwardStack: [],
  navigate: (view, params) => {
    const current = get().route
    if (current.view === view && JSON.stringify(current.params) === JSON.stringify(params)) return
    set((s) => ({
      route: { view, params },
      history: [...s.history, { view, params }].slice(-50),
      forwardStack: [],
    }))
  },
  back: () => {
    const { history, forwardStack } = get()
    if (history.length < 2) return
    const newHistory = history.slice(0, -1)
    const current = history[history.length - 1]
    set({
      history: newHistory,
      route: newHistory[newHistory.length - 1],
      forwardStack: [...forwardStack, current],
    })
  },

  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  notifOpen: false,
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications] })),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  drawer: null,
  openDrawer: (type, id) => set({ drawer: { type, id } }),
  closeDrawer: () => set({ drawer: null }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  tags: [],
  setTags: (tags) => set({ tags }),

  realtimeConnected: false,
  setRealtimeConnected: (realtimeConnected) => set({ realtimeConnected }),
}))
