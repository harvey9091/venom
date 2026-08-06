'use client'

/**
 * Pulse CRM — Notes view
 *
 * Layout (Notion/Linear-inspired):
 *   ┌─ Header strip ──────────────────────────────────────┐
 *   │  Title + count │ search │ Pinned only toggle │ + New │
 *   ├─ Notes grid ─────────────────────────────────────────┤
 *   │  2-col masonry of note cards                          │
 *   │   • title (or first 60 chars of body)                 │
 *   │   • body preview (line-clamp-3)                       │
 *   │   • footer: author avatar + relTime + entity badge    │
 *   │   • hover: lift + edit icon                           │
 *   │   • click → openDrawer('note', id)                    │
 *   └──────────────────────────────────────────────────────┘
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { useNotes } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, relTime, EmptyState } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { AppContentContainer } from '@/components/crm/shell/app-content-container'
import type { Note } from '@/lib/types'
import {
  Plus,
  Search,
  Star,
  Pencil,
  StickyNote,
  Link2,
} from 'lucide-react'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * Returns the human label + drawer target for a note's linked entity.
 * Resolves the linked lead / contact / deal / company by id from the
 * cached query data.
 */
function useLinkedEntity(note: Note) {
  // We don't import all four hooks here to avoid extra requests; the
  // existing contact/lead/deal/company drawers fetch their own data,
  // so we just need a label. The backend includes the nested entity
  // shape on notes? We'll do a best-effort lookup via store + hooks.
  // For simplicity, derive a label from the note's relational id.
  if (note.leadId) {
    return {
      kind: 'Lead' as const,
      id: note.leadId,
      drawerType: 'lead' as const,
      label: `Lead`,
    }
  }
  if (note.contactId) {
    return {
      kind: 'Contact' as const,
      id: note.contactId,
      drawerType: 'contact' as const,
      label: `Contact`,
    }
  }
  if (note.dealId) {
    return {
      kind: 'Deal' as const,
      id: note.dealId,
      drawerType: 'deal' as const,
      label: `Deal`,
    }
  }
  if (note.companyId) {
    return {
      kind: 'Company' as const,
      id: note.companyId,
      drawerType: 'company' as const,
      label: `Company`,
    }
  }
  return null
}

function noteTitle(n: Note) {
  const t = (n.title || '').trim()
  if (t) return t
  // First 60 chars of body, single-line
  const b = (n.body || '').replace(/\s+/g, ' ').trim()
  return b.slice(0, 60) + (b.length > 60 ? '…' : '') || 'Untitled'
}

// ----------------------------------------------------------------
// Note card
// ----------------------------------------------------------------

function NoteCard({ note, index }: { note: Note; index: number }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const linked = useLinkedEntity(note)
  const title = noteTitle(note)

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.4) }}
      onClick={() => openDrawer('note', note.id)}
      className="text-left card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft hover:-translate-y-0.5 hover:shadow-glow transition-all w-full break-inside-avoid mb-3 group relative"
    >
      {/* Pinned star (top-right) */}
      {note.pinned && (
        <span
          className="absolute top-3 right-3 inline-flex items-center justify-center size-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300"
          title="Pinned"
        >
          <Star className="size-3.5 fill-current" />
        </span>
      )}

      {/* Edit icon — appears on hover */}
      <span className="absolute top-3 right-3 inline-flex items-center justify-center size-6 rounded-md bg-background/80 border border-border/60 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
        <Pencil className="size-3.5" />
      </span>

      {/* Title */}
      <div
        className={cn(
          'text-[13px] font-semibold tracking-tight pr-7 leading-snug',
          note.pinned && 'pr-14',
        )}
      >
        {title}
      </div>

      {/* Body preview */}
      {note.body && (
        <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">
          {note.body}
        </p>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2">
        {note.author ? (
          <Avatar name={note.author.name} url={note.author.avatarUrl} size={20} />
        ) : (
          <span className="size-5 rounded-full bg-muted grid place-items-center">
            <StickyNote className="size-3 text-muted-foreground" />
          </span>
        )}
        <span className="text-[11px] text-muted-foreground truncate">
          {note.author?.name || 'Unknown'}
        </span>
        <span className="text-[10px] text-muted-foreground/70">·</span>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {relTime(note.updatedAt)}
        </span>
      </div>

      {/* Linked entity badge */}
      {linked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openDrawer(linked.drawerType, linked.id)
          }}
          className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Link2 className="size-2.5" />
          on {linked.kind}
        </button>
      )}
    </motion.button>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function NotesSkeleton() {
  return (
    <div className="columns-1 md:columns-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="break-inside-avoid mb-3 rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-3"
          style={{ minHeight: 120 + (i % 3) * 40 }}
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="size-5 rounded" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-full rounded" />
            <Skeleton className="h-2.5 w-5/6 rounded" />
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-2.5 w-10 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Header strip
// ----------------------------------------------------------------

function HeaderStrip({
  count,
  q,
  setQ,
  pinnedOnly,
  setPinnedOnly,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  pinnedOnly: boolean
  setPinnedOnly: (v: boolean) => void
}) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Notes</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search notes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[240px] text-[13px]"
          />
        </div>
        <label className="inline-flex items-center gap-2 px-2.5 h-9 rounded-md border border-border/60 bg-card text-[12px] text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
          <Star className={cn('size-3.5', pinnedOnly && 'fill-amber-400 text-amber-500')} />
          <span>Pinned only</span>
          <Switch checked={pinnedOnly} onCheckedChange={setPinnedOnly} aria-label="Pinned only" />
        </label>
        <Button size="default" className="h-9" onClick={() => openDrawer('note-new')}>
          <Plus className="size-4" /> New note
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function NotesView() {
  const [q, setQ] = React.useState('')
  const [pinnedOnly, setPinnedOnly] = React.useState(false)
  const debouncedQ = useDebounced(q, 300)

  const { data: notes = [], isLoading } = useNotes()

  const filtered = React.useMemo(() => {
    let out = notes
    if (pinnedOnly) out = out.filter((n) => n.pinned)
    if (debouncedQ.trim()) {
      const needle = debouncedQ.toLowerCase()
      out = out.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(needle) ||
          (n.body || '').toLowerCase().includes(needle),
      )
    }
    // Pinned first, then by updatedAt desc
    return [...out].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [notes, pinnedOnly, debouncedQ])

  return (
    <AppContentContainer preset="compact">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        pinnedOnly={pinnedOnly}
        setPinnedOnly={setPinnedOnly}
      />

      {isLoading ? (
        <NotesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<StickyNote className="size-5" />}
            title={pinnedOnly || debouncedQ ? 'No notes match your filters' : 'No notes'}
            hint={
              pinnedOnly || debouncedQ
                ? 'Try adjusting the search query or pinned filter.'
                : 'Capture meeting notes, discovery call summaries, and context for your deals.'
            }
            action={
              !pinnedOnly && !debouncedQ ? (
                <Button onClick={() => useAppStore.getState().openDrawer('note-new')}>
                  <Plus className="size-4" /> Create Note
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="columns-1 md:columns-2 gap-3">
          {filtered.map((n, i) => (
            <NoteCard key={n.id} note={n} index={i} />
          ))}
        </div>
      )}
    </AppContentContainer>
  )
}
