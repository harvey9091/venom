'use client'

/**
 * Pulse CRM — NoteDrawer
 *
 * Rendered inside the global Sheet slide-over. Layout:
 *
 *   ┌─ Header ──────────────────────────────────────────────────┐
 *   │  Inline-editable title · pinned toggle · close X            │
 *   ├─ Body ──────────────────────────────────────────┬─ Sidebar ─┤
 *   │  Styled <textarea> min-h-[300px]                │ ~200px      │
 *   │  Auto-saves on blur (debounced 800ms)           │ • author    │
 *   │  Shows "Saving…" / "Saved" indicator             │ • created   │
 *   │                                                  │ • updated   │
 *   │                                                  │ • linked    │
 *   │                                                  │   entity    │
 *   ├─ Footer ──────────────────────────────────────────────────┤
 *   │  Delete (destructive ghost) · Done (primary)                │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * In `mode="create"` we render an empty form, focus the title input,
 * and on first save call `create.mutate({ workspaceId, authorId: user.id,
 * title, body })` then switch to edit mode with the returned id.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  useNotes,
  useNoteMutations,
  useLeads,
  useContacts,
  useDeals,
  useCompanies,
} from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, relTime } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Note } from '@/lib/types'
import {
  X,
  Trash2,
  Check,
  Star,
  Pencil,
  Link2,
  Search,
  User as UserIcon,
  Clock,
  History,
  Users,
  Building2,
  Target,
  UserPlus,
} from 'lucide-react'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved'

type LinkKind = 'lead' | 'contact' | 'deal' | 'company'

interface LinkChoice {
  kind: LinkKind
  id: string
  label: string
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function deriveLink(note?: Note): LinkChoice | null {
  if (!note) return null
  if (note.leadId) return { kind: 'lead', id: note.leadId, label: 'Lead' }
  if (note.contactId) return { kind: 'contact', id: note.contactId, label: 'Contact' }
  if (note.dealId) return { kind: 'deal', id: note.dealId, label: 'Deal' }
  if (note.companyId) return { kind: 'company', id: note.companyId, label: 'Company' }
  return null
}

function resolveLinkLabel(choice: LinkChoice, lookup: (c: LinkChoice) => string | undefined): string {
  const explicit = lookup(choice)
  return explicit || choice.label
}

// ----------------------------------------------------------------
// Linked entity combobox
// ----------------------------------------------------------------

function LinkedEntityCombobox({
  note,
  onAttach,
  onDetach,
}: {
  note?: Note
  onAttach: (choice: LinkChoice) => void
  onDetach: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<LinkKind>('lead')

  const { data: leads = [] } = useLeads()
  const { data: contacts = [] } = useContacts()
  const { data: deals = [] } = useDeals()
  const { data: companies = [] } = useCompanies()

  const current = deriveLink(note)

  const lists: Record<LinkKind, LinkChoice[]> = {
    lead: leads.map((l) => ({ kind: 'lead' as const, id: l.id, label: l.fullName })),
    contact: contacts.map((c) => ({
      kind: 'contact' as const,
      id: c.id,
      label: `${c.firstName} ${c.lastName}`.trim(),
    })),
    deal: deals.map((d) => ({ kind: 'deal' as const, id: d.id, label: d.title })),
    company: companies.map((c) => ({ kind: 'company' as const, id: c.id, label: c.name })),
  }

  const currentLabel = current
    ? resolveLinkLabel(current, (c) => {
        const list = lists[c.kind]
        return list.find((x) => x.id === c.id)?.label
      })
    : null

  const TABS: { kind: LinkKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { kind: 'lead', label: 'Leads', icon: UserPlus },
    { kind: 'contact', label: 'Contacts', icon: Users },
    { kind: 'deal', label: 'Deals', icon: Target },
    { kind: 'company', label: 'Companies', icon: Building2 },
  ]

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Linked entity
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 justify-start text-[12px] font-normal"
          >
            {current ? (
              <>
                <Link2 className="size-3.5" />
                <span className="truncate flex-1 text-left">{currentLabel}</span>
                <Badge variant="secondary" className="text-[9px] uppercase tracking-wide">{current.label}</Badge>
              </>
            ) : (
              <>
                <Search className="size-3.5" />
                <span className="text-muted-foreground">Attach…</span>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="flex border-b border-border/60">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.kind}
                  onClick={() => setTab(t.kind)}
                  className={cn(
                    'flex-1 px-1.5 py-2 text-[10px] font-medium uppercase tracking-wide inline-flex items-center justify-center gap-1 border-b-2 transition-colors',
                    tab === t.kind
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3" />
                  {t.label}
                </button>
              )
            })}
          </div>
          <Command>
            <CommandInput placeholder={`Search ${tab}s…`} className="text-[12px]" />
            <CommandList className="max-h-[220px]">
              <CommandEmpty>No {tab}s found.</CommandEmpty>
              <CommandGroup>
                {lists[tab].map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.label} ${c.id}`}
                    onSelect={() => {
                      onAttach(c)
                      setOpen(false)
                    }}
                    className="text-[12px]"
                  >
                    <Link2 className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{c.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {current && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-[11px] text-muted-foreground hover:text-destructive"
          onClick={onDetach}
        >
          <X className="size-3" /> Detach
        </Button>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------

function NoteSidebar({
  note,
  onAttach,
  onDetach,
}: {
  note?: Note
  onAttach: (c: LinkChoice) => void
  onDetach: () => void
}) {
  return (
    <aside className="w-full md:w-[200px] shrink-0 border-t md:border-t-0 md:border-l border-border/60 bg-muted/20 p-4 space-y-4">
      {/* Author */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Author
        </div>
        <div className="flex items-center gap-2">
          {note?.author ? (
            <Avatar name={note.author.name} url={note.author.avatarUrl} size={22} />
          ) : (
            <span className="size-[22px] rounded-full bg-muted grid place-items-center">
              <UserIcon className="size-3 text-muted-foreground" />
            </span>
          )}
          <span className="text-[12px] font-medium truncate">
            {note?.author?.name || 'You'}
          </span>
        </div>
      </div>

      {/* Timestamps */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Timestamps
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          <span>Created {note ? relTime(note.createdAt) : '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <History className="size-3" />
          <span>Updated {note ? relTime(note.updatedAt) : '—'}</span>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* Linked entity */}
      <LinkedEntityCombobox note={note} onAttach={onAttach} onDetach={onDetach} />
    </aside>
  )
}

// ----------------------------------------------------------------
// Header
// ----------------------------------------------------------------

function NoteHeader({
  title,
  onTitleChange,
  onTitleCommit,
  pinned,
  onTogglePinned,
  onClose,
  saveState,
  titleRef,
}: {
  title: string
  onTitleChange: (v: string) => void
  onTitleCommit: () => void
  pinned: boolean
  onTogglePinned: () => void
  onClose: () => void
  saveState: SaveState
  titleRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
      <div className="flex items-start gap-2">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleCommit}
          placeholder="Untitled note"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[18px] font-semibold tracking-tight placeholder:text-muted-foreground/60 focus:placeholder:text-muted-foreground/30"
        />
        <button
          onClick={onTogglePinned}
          aria-label={pinned ? 'Unpin note' : 'Pin note'}
          title={pinned ? 'Unpin note' : 'Pin note'}
          className={cn(
            'inline-flex items-center justify-center size-8 rounded-md transition-colors shrink-0',
            pinned
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Star className={cn('size-4', pinned && 'fill-current')} />
        </button>
        {/* Save state indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground h-8 px-2">
          {saveState === 'saving' && (
            <>
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Saving…</span>
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check className="size-3 text-emerald-500" />
              <span>Saved</span>
            </>
          )}
          {saveState === 'idle' && (
            <>
              <Pencil className="size-3" />
              <span>Draft</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main drawer
// ----------------------------------------------------------------

export function NoteDrawer({ id, mode, onClose }: { id?: string; mode?: 'create'; onClose: () => void }) {
  const isCreate = mode === 'create' || !id
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)
  const openDrawer = useAppStore((s) => s.openDrawer)

  const { data: notes = [], isLoading } = useNotes()
  const note = id ? notes.find((n) => n.id === id) : undefined

  const { create, update, remove } = useNoteMutations()

  // Local working copy of title/body — synced from the note when it loads
  const [activeId, setActiveId] = React.useState<string | undefined>(id)
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [pinned, setPinned] = React.useState(false)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')

  const titleRef = React.useRef<HTMLInputElement | null>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null)

  // Sync local state when the note arrives / changes
  React.useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setBody(note.body || '')
      setPinned(note.pinned)
      setSaveState('idle')
    }
  }, [note?.id])

  // In create mode, focus the title input on mount
  React.useEffect(() => {
    if (isCreate) {
      const t = setTimeout(() => titleRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isCreate])

  // ---------- Save orchestration ----------

  const persist = React.useCallback(
    (next: { title: string; body: string }) => {
      if (!activeId) return
      setSaveState('saving')
      update.mutate(
        { id: activeId, title: next.title, body: next.body },
        {
          onSuccess: () => {
            setSaveState('saved')
            setTimeout(() => setSaveState('idle'), 1500)
          },
          onError: () => {
            setSaveState('idle')
            toast.error('Could not save note')
          },
        },
      )
    },
    [activeId, update],
  )

  // Debounced autosave of body — fires 800ms after the last keystroke
  const debouncedBody = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBody = React.useRef(body)
  React.useEffect(() => {
    lastBody.current = body
  }, [body])
  React.useEffect(() => {
    if (!activeId || isCreate) return
    if (body === (note?.body || '')) return
    if (debouncedBody.current) clearTimeout(debouncedBody.current)
    debouncedBody.current = setTimeout(() => {
      persist({ title, body })
    }, 800)
    return () => {
      if (debouncedBody.current) clearTimeout(debouncedBody.current)
    }
  }, [body, activeId, isCreate, note?.body, persist, title])

  // Save title on blur
  const handleTitleCommit = React.useCallback(() => {
    if (!activeId) return
    if (title === (note?.title || '')) return
    persist({ title, body: lastBody.current })
  }, [activeId, note?.title, persist, title])

  // Body blur → immediate flush
  const handleBodyBlur = React.useCallback(() => {
    if (!activeId) return
    if (body === (note?.body || '') && title === (note?.title || '')) return
    if (debouncedBody.current) clearTimeout(debouncedBody.current)
    persist({ title, body })
  }, [activeId, body, note?.body, note?.title, persist, title])

  // ---------- Create flow ----------

  const handleFirstSave = React.useCallback(() => {
    if (!workspace?.id || !user?.id) {
      toast.error('Workspace or user not available')
      return
    }
    create.mutate(
      {
        workspaceId: workspace.id,
        authorId: user.id,
        title,
        body,
        pinned,
      } as Partial<Note>,
      {
        onSuccess: (created: Note | undefined) => {
          const newId = (created as Note | undefined)?.id
          if (newId) {
            setActiveId(newId)
            setSaveState('saved')
            setTimeout(() => setSaveState('idle'), 1500)
            // Update the global drawer so subsequent edits target the new id
            openDrawer('note', newId)
            toast.success('Note created')
            // Move focus to the body
            setTimeout(() => bodyRef.current?.focus(), 80)
          } else {
            toast.success('Note created')
          }
        },
        onError: () => toast.error('Could not create note'),
      },
    )
  }, [workspace, user, create, title, body, pinned, openDrawer])

  // ---------- Pinned toggle ----------

  const handleTogglePinned = React.useCallback(() => {
    const next = !pinned
    setPinned(next)
    if (activeId) {
      update.mutate({ id: activeId, pinned: next })
    }
  }, [activeId, pinned, update])

  // ---------- Linked entity ----------

  const handleAttach = React.useCallback(
    (c: LinkChoice) => {
      if (!activeId) return
      const patch: Partial<Note> & { id: string } = { id: activeId }
      if (c.kind === 'lead') patch.leadId = c.id
      if (c.kind === 'contact') patch.contactId = c.id
      if (c.kind === 'deal') patch.dealId = c.id
      if (c.kind === 'company') patch.companyId = c.id
      update.mutate(patch, {
        onSuccess: () => toast.success(`Linked to ${c.label}`),
        onError: () => toast.error('Could not link note'),
      })
    },
    [activeId, update],
  )

  const handleDetach = React.useCallback(() => {
    if (!activeId || !note) return
    const patch: Partial<Note> & { id: string } = { id: activeId }
    if (note.leadId) patch.leadId = null
    if (note.contactId) patch.contactId = null
    if (note.dealId) patch.dealId = null
    if (note.companyId) patch.companyId = null
    update.mutate(patch, {
      onSuccess: () => toast.success('Link removed'),
      onError: () => toast.error('Could not remove link'),
    })
  }, [activeId, note, update])

  // ---------- Delete ----------

  const handleDelete = React.useCallback(() => {
    if (!activeId) return
    remove.mutate(activeId, {
      onSuccess: () => {
        toast.success('Note deleted')
        onClose()
      },
      onError: () => toast.error('Could not delete note'),
    })
  }, [activeId, remove, onClose])

  // ---------- Render ----------

  // Create mode (no id yet)
  if (isCreate) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex flex-col h-full"
      >
        <NoteHeader
          title={title}
          onTitleChange={setTitle}
          onTitleCommit={() => {
            /* no auto-create on title blur in create mode */
          }}
          pinned={pinned}
          onTogglePinned={handleTogglePinned}
          onClose={onClose}
          saveState={create.isPending ? 'saving' : 'idle'}
          titleRef={titleRef}
        />
        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          <div className="flex-1 min-w-0 p-5">
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Start writing… use the title above for a heading, then put your thoughts here. Notes auto-save once created."
              className="min-h-[300px] resize-none border-0 shadow-none focus-visible:ring-0 text-[13px] leading-relaxed"
            />
          </div>
          <NoteSidebar
            note={undefined}
            onAttach={() => toast.info('Save the note first to link it to an entity')}
            onDetach={() => {}}
          />
        </div>
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
          <div />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleFirstSave}
              disabled={create.isPending || (!title.trim() && !body.trim())}
            >
              <Check className="size-4" />
              {create.isPending ? 'Creating…' : 'Create note'}
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Edit mode — loading
  if (isLoading && !note) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-7 w-2/3 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-16 rounded" />
          <Skeleton className="h-9 w-24 rounded" />
        </div>
      </div>
    )
  }

  // Edit mode — not found
  if (id && !note) {
    return (
      <div className="p-6">
        <div className="text-[14px] font-semibold">Note not found</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          This note may have been deleted.
        </div>
        <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    )
  }

  // Edit mode — render
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
    >
      <NoteHeader
        title={title}
        onTitleChange={setTitle}
        onTitleCommit={handleTitleCommit}
        pinned={pinned}
        onTogglePinned={handleTogglePinned}
        onClose={onClose}
        saveState={saveState}
        titleRef={titleRef}
      />
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex-1 min-w-0 p-5">
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleBodyBlur}
            placeholder="Start writing…"
            className="min-h-[300px] resize-none border-0 shadow-none focus-visible:ring-0 text-[13px] leading-relaxed"
          />
        </div>
        <NoteSidebar note={note} onAttach={handleAttach} onDetach={handleDetach} />
      </div>
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={remove.isPending}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="default" onClick={onClose}>
            <Check className="size-4" /> Done
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
