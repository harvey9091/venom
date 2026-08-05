'use client'

import { useAppStore } from '@/lib/store'
import { Avatar } from '@/components/crm/shared'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, KanbanSquare, ListTodo,
  StickyNote, Workflow, Settings, Sparkles, Search,
  UserPlus, Target, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useKeyboardShortcuts } from '@/lib/shortcuts'
import { CommandPalette } from './command-palette'
import { NotificationsInbox } from './notifications'
import { ThemeSwitcher } from './theme-switcher'
import { ThinkingIndicator, AIAssistant } from '@/components/crm/thinking'
import { useEffect, useState } from 'react'
import { useRealtime } from '@/lib/realtime'

interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  view: any
  group: string
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard', group: 'Workspace' },
  { key: 'automations', label: 'Automations', icon: Workflow, view: 'automations', group: 'Workspace' },
  { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare, view: 'pipeline', group: 'Sales' },
  { key: 'leads', label: 'Leads', icon: UserPlus, view: 'leads', group: 'Sales' },
  { key: 'deals', label: 'Deals', icon: Target, view: 'deals', group: 'Sales' },
  { key: 'tasks', label: 'Tasks', icon: ListTodo, view: 'tasks', group: 'Productivity' },
  { key: 'notes', label: 'Notes', icon: StickyNote, view: 'notes', group: 'Productivity' },
  { key: 'settings', label: 'Settings', icon: Settings, view: 'settings', group: 'Workspace' },
]

function NavGroup({ group, items }: { group: string; items: NavItem[] }) {
  const route = useAppStore((s) => s.route)
  const navigate = useAppStore((s) => s.navigate)
  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group}</div>
      {items.map((item) => {
        const Icon = item.icon
        const active = route.view === item.view
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.view)}
            className={cn(
              'w-full group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200',
              active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <Icon size={15} className={cn('transition-transform', active ? '' : 'group-hover:scale-110')} />
            <span className="flex-1 text-left">{item.label}</span>
            {active && <span className="w-1 h-4 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}

function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const workspace = useAppStore((s) => s.workspace)
  const navigate = useAppStore((s) => s.navigate)
  const sidebarStyle = useAppStore.getState() // not used here, but referenced

  const groups = Array.from(new Set(NAV.map((n) => n.group)))
  return (
    <aside
      className={cn(
        'relative h-screen sticky top-0 shrink-0 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-300',
        collapsed ? 'w-[60px]' : 'w-[244px]'
      )}
      style={{ borderRadius: 'var(--sidebar-radius, 0)', margin: collapsed ? '0' : 'var(--sidebar-margin, 0)' }}
    >
      {/* Workspace selector */}
      <button
        onClick={() => navigate('settings')}
        className="mx-2 mt-3 mb-2 flex items-center gap-2.5 p-2 rounded-xl hover:bg-sidebar-accent/60 transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-items-center font-bold text-sm shrink-0 shadow-soft">
          {workspace?.name?.[0]?.toUpperCase() || 'V'}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-semibold truncate">{workspace?.name || 'Venom CRM'}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{workspace?.plan} plan</div>
          </div>
        )}
      </button>

      {/* Quick search */}
      {!collapsed && (
        <button
          onClick={() => useAppStore.getState().setCommandOpen(true)}
          className="mx-2 mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground text-[12px] border border-border/40 transition-colors"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded bg-background border border-border">⌘K</kbd>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-area no-scrollbar pb-4">
        {collapsed ? (
          <div className="px-2 mt-2 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = useAppStore.getState().route.view === item.view
              return (
                <button
                  key={item.key}
                  onClick={() => useAppStore.getState().navigate(item.view)}
                  className={cn(
                    'w-full p-2 rounded-lg flex justify-center transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'
                  )}
                  title={item.label}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
        ) : (
          groups.map((g) => <NavGroup key={g} group={g} items={NAV.filter((n) => n.group === g)} />)
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-2 pt-1 border-t border-sidebar-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : (<><ChevronLeft size={14} /><span>Collapse</span></>)}
        </button>
      </div>
    </aside>
  )
}

function TopBar() {
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)
  const route = useAppStore((s) => s.route)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const setNotifOpen = useAppStore((s) => s.setNotifOpen)
  const connected = useAppStore((s) => s.realtimeConnected)
  const notifications = useAppStore((s) => s.notifications)
  const unread = notifications.filter((n) => !n.read).length

  const title = NAV.find((n) => n.view === route.view)?.label || 'Dashboard'

  return (
    <header className="h-14 shrink-0 sticky top-0 z-30 flex items-center gap-3 px-4 border-b border-border/60 glass">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-[15px] font-semibold tracking-tight truncate">{title}</h1>
        <span className="text-[11px] text-muted-foreground hidden md:inline">/ {workspace?.name}</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={() => setCommandOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground text-[12px] border border-border/40 transition-colors min-w-[200px]"
      >
        <Search size={13} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="text-[10px] px-1 py-0.5 rounded bg-background border border-border">⌘K</kbd>
      </button>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]" title={connected ? 'Realtime connected' : 'Connecting…'}>
          <span className={cn('w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
          <span className="text-muted-foreground hidden sm:inline">{connected ? 'Live' : 'Syncing'}</span>
        </div>
        <ThemeSwitcher />
        <ThinkingIndicator />
        <button
          onClick={() => setNotifOpen(true)}
          className="relative p-2 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="sr-only">Notifications</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 grid place-items-center text-[9px] font-bold rounded-full bg-rose-500 text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {user && <Avatar name={user.name} url={user.avatarUrl} size={28} className="ring-2 ring-background" />}
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts()
  useRealtime()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 min-w-0 overflow-x-hidden view-enter" key={useAppStore.getState().route.view}>
          {children}
        </main>
      </div>
      <CommandPalette />
      <NotificationsInbox />
      <AIAssistant />
    </div>
  )
}
