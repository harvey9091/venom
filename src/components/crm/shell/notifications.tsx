'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { useNotifications, useNotificationMutations } from '@/lib/hooks'
import { Avatar, relTime } from '@/components/crm/shared'
import { CheckCheck, BellOff, Bell, AtSign, Zap, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThinkingState } from '@/components/crm/thinking'

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  mention: AtSign,
  assignment: Bell,
  automation: Zap,
  system: SettingsIcon,
}

export function NotificationsInbox() {
  const open = useAppStore((s) => s.notifOpen)
  const setOpen = useAppStore((s) => s.setNotifOpen)
  const user = useAppStore((s) => s.user)
  const { data: notifications = [], isLoading } = useNotifications()
  const { markAllRead, markRead } = useNotificationMutations()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              <Bell size={16} /> Notifications
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => user && markAllRead.mutate(user.id)}
              disabled={!notifications.some((n: any) => !n.read)}
            >
              <CheckCheck size={13} className="mr-1" /> Mark all read
            </Button>
          </div>
        </SheetHeader>
        <div className="overflow-y-auto scroll-area h-[calc(100vh-60px)]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <ThinkingState label="Syncing notifications…" size="md" variant="trio" theme="rainbow" />
            </div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOff size={28} className="text-muted-foreground/60 mb-2" />
              <p className="text-sm text-muted-foreground">You&apos;re all caught up</p>
            </div>
          )}
          <div className="divide-y divide-border/60">
            {notifications.map((n: any) => {
              const Icon = ICONS[n.type] || Bell
              return (
                <button
                  key={n.id}
                  onClick={() => markRead.mutate({ id: n.id, read: true })}
                  className={cn(
                    'w-full px-4 py-3 flex gap-3 hover:bg-muted/40 transition-colors text-left',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('shrink-0 w-8 h-8 rounded-lg grid place-items-center',
                    n.type === 'mention' ? 'bg-blue-500/10 text-blue-500' :
                    n.type === 'assignment' ? 'bg-violet-500/10 text-violet-500' :
                    n.type === 'automation' ? 'bg-amber-500/10 text-amber-500' :
                    'bg-slate-500/10 text-slate-500'
                  )}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-medium">{n.title}</div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                    {n.body && <div className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{relTime(n.createdAt)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
