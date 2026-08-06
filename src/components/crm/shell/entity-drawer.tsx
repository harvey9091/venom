'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { LeadDrawer } from '@/components/crm/views/lead-drawer'
import { DealDrawer } from '@/components/crm/views/deal-drawer'
import { TaskDrawer } from '@/components/crm/views/task-drawer'
import { NoteDrawer } from '@/components/crm/views/note-drawer'

export function EntityDrawer() {
  const drawer = useAppStore((s) => s.drawer)
  const close = useAppStore((s) => s.closeDrawer)
  const open = !!drawer
  const type = drawer?.type || ''
  const id = drawer?.id

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full h-full sm:max-w-[640px] p-0 overflow-y-auto scroll-area">
        {!id && type === 'lead-new' && <LeadDrawer mode="create" onClose={close} />}
        {id && type === 'lead' && <LeadDrawer id={id} onClose={close} />}
        {!id && type === 'deal-new' && <DealDrawer mode="create" onClose={close} />}
        {id && type === 'deal' && <DealDrawer id={id} onClose={close} />}
        {!id && type === 'task-new' && <TaskDrawer mode="create" onClose={close} />}
        {id && type === 'task' && <TaskDrawer id={id} onClose={close} />}
        {!id && type === 'note-new' && <NoteDrawer mode="create" onClose={close} />}
        {id && type === 'note' && <NoteDrawer id={id} onClose={close} />}
        {!id && type !== 'lead-new' && type !== 'deal-new' && type !== 'task-new' && type !== 'note-new' && (
          <SheetHeader className="p-6">
            <SheetTitle>Nothing selected</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  )
}
