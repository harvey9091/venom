'use client'

import { useAppStore } from '@/lib/store'
import { AppShell } from '@/components/crm/shell/app-shell'
import { EntityDrawer } from '@/components/crm/shell/entity-drawer'
import { DashboardView } from '@/components/crm/views/dashboard'
import { LeadsView } from '@/components/crm/views/leads'
import { DealsView } from '@/components/crm/views/deals'
import { PipelineView } from '@/components/crm/views/pipeline'
import { TasksView } from '@/components/crm/views/tasks'
import { NotesView } from '@/components/crm/views/notes'
import { AutomationsView } from '@/components/crm/views/automations'
import { SettingsView } from '@/components/crm/views/settings'

export default function Home() {
  const view = useAppStore((s) => s.route.view)

  return (
    <AppShell>
      {view === 'dashboard' && <DashboardView />}
      {view === 'automations' && <AutomationsView />}
      {view === 'pipeline' && <PipelineView />}
      {view === 'leads' && <LeadsView />}
      {view === 'deals' && <DealsView />}
      {view === 'tasks' && <TasksView />}
      {view === 'notes' && <NotesView />}
      {view === 'settings' && <SettingsView />}
      <EntityDrawer />
    </AppShell>
  )
}
