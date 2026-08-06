/**
 * App store — current user, workspace, navigation, command palette,
 * notifications, drawers, auth.
 */
'use client'

import { create } from 'zustand'
import type {
  User, Workspace, RouteState, ViewKey, Notification, Tag,
  Membership,
} from './types'

interface AuthState {
  user: User | null
  setUser: (u: User | null) => void
  workspaces: Membership[]
  setWorkspaces: (w: Membership[]) => void
  addWorkspace: (w: Membership) => void
  workspace: Workspace | null
  setWorkspace: (w: Workspace | null) => void
  activeWorkspaceId: string | null
  setActiveWorkspaceId: (id: string | null) => void
  switchWorkspace: (workspaceId: string) => void
}

interface AppState extends AuthState {
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

  // AI Assistant drawer
  assistantOpen: boolean
  setAssistantOpen: (v: boolean) => void
  assistantSeedPrompt: string | null
  openAssistant: (seedPrompt?: string) => void
}

const WORKSPACE_STORAGE_KEY = 'venom-active-workspace-id'

function loadActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveActiveWorkspaceId(id: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (id) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth state
  user: null,
  setUser: (u) => set({ user: u }),

  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) => set((s) => ({ workspaces: [...s.workspaces, workspace] })),

  workspace: null,
  setWorkspace: (w) => set({ workspace: w }),

  activeWorkspaceId: loadActiveWorkspaceId(),
  setActiveWorkspaceId: (id) => {
    saveActiveWorkspaceId(id)
    set({ activeWorkspaceId: id })
  },

  switchWorkspace: (workspaceId: string) => {
    saveActiveWorkspaceId(workspaceId)
    const membership = get().workspaces.find((w) => w.workspaceId === workspaceId)
    set({
      workspace: membership?.workspace || null,
      activeWorkspaceId: workspaceId,
      route: { view: 'dashboard' },
      history: [{ view: 'dashboard' }],
      forwardStack: [],
      tags: [],
      notifications: [],
      drawer: null,
      commandOpen: false,
      notifOpen: false,
      assistantOpen: false,
      assistantSeedPrompt: null,
    })
  },

  // Navigation
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

  // Command palette
  commandOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),

  // Notifications
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

  // Drawer
  drawer: null,
  openDrawer: (type, id) => set({ drawer: { type, id } }),
  closeDrawer: () => set({ drawer: null }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  // Tags
  tags: [],
  setTags: (tags) => set({ tags }),

  // Realtime
  realtimeConnected: false,
  setRealtimeConnected: (realtimeConnected) => set({ realtimeConnected }),

  // AI Assistant
  assistantOpen: false,
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  assistantSeedPrompt: null,
  openAssistant: (assistantSeedPrompt) => set({ assistantOpen: true, assistantSeedPrompt: assistantSeedPrompt || null }),
}))
