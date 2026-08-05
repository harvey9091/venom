'use client'

import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { useAppStore } from '@/lib/store'
import { useGlobalSearch } from '@/lib/hooks'
import {
  LayoutDashboard, KanbanSquare, UserPlus, Users, Building2, ListTodo, Calendar, StickyNote,
  Paperclip, Workflow, Upload, Settings, Search, ArrowRight, Sparkles,
} from 'lucide-react'
import { Avatar } from '@/components/crm/shared'
import { Orb } from '@/components/crm/thinking'
import { useState } from 'react'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Pipeline', icon: KanbanSquare, view: 'pipeline' },
  { label: 'Leads', icon: UserPlus, view: 'leads' },
  { label: 'Contacts', icon: Users, view: 'contacts' },
  { label: 'Companies', icon: Building2, view: 'companies' },
  { label: 'Deals', icon: KanbanSquare, view: 'deals' },
  { label: 'Tasks', icon: ListTodo, view: 'tasks' },
  { label: 'Calendar', icon: Calendar, view: 'calendar' },
  { label: 'Notes', icon: StickyNote, view: 'notes' },
  { label: 'Files', icon: Paperclip, view: 'files' },
  { label: 'Automations', icon: Workflow, view: 'automations' },
  { label: 'Import CSV', icon: Upload, view: 'import' },
  { label: 'Settings', icon: Settings, view: 'settings' },
]

export function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  const navigate = useAppStore((s) => s.navigate)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const openAssistant = useAppStore((s) => s.openAssistant)
  const [q, setQ] = useState('')

  const { data: results, isFetching } = useGlobalSearch(open ? q : '')

  // Compact orb inside the search bar while fetching
  const searchThinking = q.length > 0 && isFetching

  // Reset the search query whenever the palette closes — done via onOpenChange
  // callback rather than an effect to avoid the "setState in effect" lint error.

  const go = (view: any) => {
    navigate(view)
    setOpen(false)
  }

  const askAI = (prompt?: string) => {
    openAssistant(prompt || q)
    setOpen(false)
    setQ('')
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { if (!v) setQ(''); setOpen(v) }}>
      <div className="relative">
        <CommandInput placeholder="Search anything, jump to, or ask AI…" value={q} onValueChange={setQ} />
        {searchThinking && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Orb size="xs" variant="trio" theme="rainbow" animated />
          </div>
        )}
      </div>
      <CommandList>
        <CommandEmpty>
          {q ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">No matches for “{q}”.</p>
              <button
                onClick={() => askAI()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Sparkles size={12} /> Ask AI instead
              </button>
            </div>
          ) : (
            'No results found.'
          )}
        </CommandEmpty>

        {!q && (
          <>
            <CommandGroup heading="Ask AI">
              <CommandItem onSelect={() => askAI('Summarize my week')}>
                <Sparkles size={14} /><span>Summarize my week</span>
              </CommandItem>
              <CommandItem onSelect={() => askAI('Score my top leads')}>
                <Sparkles size={14} /><span>Score my top leads</span>
              </CommandItem>
              <CommandItem onSelect={() => askAI('Draft an outreach email')}>
                <Sparkles size={14} /><span>Draft an outreach email</span>
              </CommandItem>
              <CommandItem onSelect={() => askAI()}>
                <Sparkles size={14} /><span>Open AI Assistant…</span>
                <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded bg-background border border-border">⌘J</kbd>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => go('dashboard')}>
                <LayoutDashboard size={14} /><span>Open Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => go('pipeline')}>
                <KanbanSquare size={14} /><span>Open Pipeline</span>
              </CommandItem>
              <CommandItem onSelect={() => { openDrawer('lead-new'); setOpen(false) }}>
                <UserPlus size={14} /><span>Create new lead</span>
              </CommandItem>
              <CommandItem onSelect={() => { openDrawer('deal-new'); setOpen(false) }}>
                <Sparkles size={14} /><span>Create new deal</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {NAV_ITEMS.map((item) => (
                <CommandItem key={item.view} onSelect={() => go(item.view)}>
                  <item.icon size={14} /><span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {q && results && (
          <>
            {/* Always show "Ask AI: <query>" at the top */}
            <CommandGroup heading="Ask AI">
              <CommandItem onSelect={() => askAI()}>
                <Sparkles size={14} /><span>Ask AI: “{q}”</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {results.leads?.length > 0 && (
              <CommandGroup heading="Leads">
                {results.leads.slice(0, 5).map((l) => (
                  <CommandItem key={l.id} onSelect={() => { openDrawer('lead', l.id); setOpen(false) }}>
                    <Avatar name={l.fullName} size={18} />
                    <span>{l.fullName}</span>
                    {l.email && <span className="text-xs text-muted-foreground">{l.email}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.contacts?.length > 0 && (
              <CommandGroup heading="Contacts">
                {results.contacts.slice(0, 5).map((c) => (
                  <CommandItem key={c.id} onSelect={() => { openDrawer('contact', c.id); setOpen(false) }}>
                    <Avatar name={`${c.firstName} ${c.lastName}`} size={18} />
                    <span>{c.firstName} {c.lastName}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.companies?.length > 0 && (
              <CommandGroup heading="Companies">
                {results.companies.slice(0, 5).map((c) => (
                  <CommandItem key={c.id} onSelect={() => { openDrawer('company', c.id); setOpen(false) }}>
                    <Building2 size={14} /><span>{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.deals?.length > 0 && (
              <CommandGroup heading="Deals">
                {results.deals.slice(0, 5).map((d) => (
                  <CommandItem key={d.id} onSelect={() => { openDrawer('deal', d.id); setOpen(false) }}>
                    <KanbanSquare size={14} /><span>{d.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.tasks?.length > 0 && (
              <CommandGroup heading="Tasks">
                {results.tasks.slice(0, 5).map((t) => (
                  <CommandItem key={t.id} onSelect={() => { openDrawer('task', t.id); setOpen(false) }}>
                    <ListTodo size={14} /><span>{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.notes?.length > 0 && (
              <CommandGroup heading="Notes">
                {results.notes.slice(0, 5).map((n) => (
                  <CommandItem key={n.id} onSelect={() => { openDrawer('note', n.id); setOpen(false) }}>
                    <StickyNote size={14} /><span>{n.title || n.body.slice(0, 40)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results.files?.length > 0 && (
              <CommandGroup heading="Files">
                {results.files.slice(0, 5).map((f) => (
                  <CommandItem key={f.id} onSelect={() => { openDrawer('file', f.id); setOpen(false) }}>
                    <Paperclip size={14} /><span>{f.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

