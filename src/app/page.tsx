'use client'

import { useAppStore } from '@/lib/store'
import { AppShell } from '@/components/crm/shell/app-shell'
import { EntityDrawer } from '@/components/crm/shell/entity-drawer'
import { DashboardView } from '@/components/crm/views/dashboard'
import { LeadsView } from '@/components/crm/views/leads'
import { ContactsView } from '@/components/crm/views/contacts'
import { CompaniesView } from '@/components/crm/views/companies'
import { DealsView } from '@/components/crm/views/deals'
import { PipelineView } from '@/components/crm/views/pipeline'
import { TasksView } from '@/components/crm/views/tasks'
import { CalendarView } from '@/components/crm/views/calendar'
import { NotesView } from '@/components/crm/views/notes'
import { FilesView } from '@/components/crm/views/files'
import { AutomationsView } from '@/components/crm/views/automations'
import { ImportView } from '@/components/crm/views/import'
import { SettingsView } from '@/components/crm/views/settings'

export default function Home() {
  const view = useAppStore((s) => s.route.view)

  return (
    <AppShell>
      {view === 'dashboard' && <DashboardView />}
      {view === 'leads' && <LeadsView />}
      {view === 'contacts' && <ContactsView />}
      {view === 'companies' && <CompaniesView />}
      {view === 'deals' && <DealsView />}
      {view === 'pipeline' && <PipelineView />}
      {view === 'tasks' && <TasksView />}
      {view === 'calendar' && <CalendarView />}
      {view === 'notes' && <NotesView />}
      {view === 'files' && <FilesView />}
      {view === 'automations' && <AutomationsView />}
      {view === 'import' && <ImportView />}
      {view === 'settings' && <SettingsView />}
      <EntityDrawer />
    </AppShell>
  )
}
