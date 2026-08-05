'use client'

/**
 * Pulse CRM — LeadDrawer
 *
 * Rendered inside the global Sheet slide-over (see
 * `src/components/crm/shell/entity-drawer.tsx`). We render the inner
 * content: header (Avatar + name + subtitle), Tabs (Overview | Activity
 * | Notes | Files), and a sticky footer (Delete + Save).
 *
 * In `mode="create"` the form starts empty and Save creates a new lead
 * then calls `onClose()`. In edit mode the form is pre-filled from the
 * fetched lead and Save updates + toasts but keeps the drawer open.
 */

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLeads, useLeadMutations, useActivities, useNotes, useNoteMutations, useFiles, useFileMutations, useCompanies, useSettings } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, ScoreBar, StatusDot, money, relTime, EmptyState, TagChip } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus, Membership } from '@/lib/types'
import {
  X,
  Trash2,
  Save,
  Plus,
  Mail,
  Phone,
  Building2,
  Clock,
  StickyNote,
  Paperclip,
  Upload,
  Activity as ActivityIcon,
  User as UserIcon,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'converted', label: 'Converted' },
]

const SOURCES = ['website', 'referral', 'ads', 'cold-outreach', 'event', 'other']

// ----------------------------------------------------------------
// Form schema
// ----------------------------------------------------------------

const leadSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string(),
  score: z.number().min(0).max(100),
  estimatedValue: z.number().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
})

type LeadFormValues = z.infer<typeof leadSchema>

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function LeadDrawer({ id, mode, onClose }: { id?: string; mode?: 'create'; onClose: () => void }) {
  const isCreate = mode === 'create' || !id
  const { data: leads = [] } = useLeads()
  const lead = id ? leads.find((l) => l.id === id) : undefined

  const [tab, setTab] = React.useState('overview')

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      source: 'website',
      status: 'new',
      score: 50,
      estimatedValue: null,
      ownerId: null,
      companyId: null,
    },
    values: lead ? {
      fullName: lead.fullName,
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || 'website',
      status: lead.status,
      score: lead.score,
      estimatedValue: lead.estimatedValue ?? null,
      ownerId: lead.ownerId ?? null,
      companyId: lead.companyId ?? null,
    } : undefined,
  })

  const { create, update, remove } = useLeadMutations()
  const { data: companies = [] } = useCompanies()
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []

  const [tags, setTags] = React.useState<string[]>(lead?.tags?.map((t) => t.name) || [])
  const [tagDraft, setTagDraft] = React.useState('')

  // Sync tags if lead changes
  React.useEffect(() => {
    if (lead?.tags) setTags(lead.tags.map((t) => t.name))
  }, [lead?.id])

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...values,
      estimatedValue: values.estimatedValue ? Number(values.estimatedValue) : null,
      tags: tags,
    }
    if (isCreate) {
      create.mutate(payload as any, {
        onSuccess: () => {
          toast.success('Lead created')
          onClose()
        },
        onError: () => toast.error('Could not create lead'),
      })
    } else if (id) {
      update.mutate({ id, ...payload } as any, {
        onSuccess: () => toast.success('Lead updated'),
        onError: () => toast.error('Could not update lead'),
      })
    }
  })

  const handleDelete = () => {
    if (!id) return
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Lead deleted')
        onClose()
      },
    })
  }

  const addTag = () => {
    const v = tagDraft.trim()
    if (!v) return
    if (!tags.includes(v)) setTags([...tags, v])
    setTagDraft('')
  }

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const subtitle = isCreate
    ? 'Create a new lead'
    : lead?.email || lead?.company?.name || 'Lead details'

  const titleName = isCreate ? 'New Lead' : (lead?.fullName || 'Lead')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <Avatar name={titleName} url={lead?.owner?.avatarUrl} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight truncate">{titleName}</div>
            <div className="text-[12px] text-muted-foreground truncate">{subtitle}</div>
            {lead && !isCreate && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot status={lead.status} />
                  <span className="capitalize">{lead.status}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <ScoreBar score={lead.score} />
                </span>
                {lead.estimatedValue ? (
                  <span className="tabular-nums text-muted-foreground">{money(lead.estimatedValue)}</span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-border/60 bg-background sticky top-0 z-10">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-transparent p-0 h-9 gap-4">
            <TabsTrigger value="overview" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Activity
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Notes
            </TabsTrigger>
            <TabsTrigger value="files" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Files
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5">
        {tab === 'overview' && (
          <OverviewTab
            form={form}
            tags={tags}
            tagDraft={tagDraft}
            setTagDraft={setTagDraft}
            addTag={addTag}
            removeTag={removeTag}
            companies={companies}
            members={members}
          />
        )}
        {tab === 'activity' && <ActivityTab leadId={id} />}
        {tab === 'notes' && <NotesTab leadId={id} />}
        {tab === 'files' && <FilesTab leadId={id} leadName={lead?.fullName} />}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
        {!isCreate && id ? (
          <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={remove.isPending}>
            <Trash2 className="size-4" /> Delete
          </Button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            <Save className="size-4" />
            {isCreate ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Overview tab — form
// ----------------------------------------------------------------

function OverviewTab({
  form,
  tags,
  tagDraft,
  setTagDraft,
  addTag,
  removeTag,
  companies,
  members,
}: {
  form: ReturnType<typeof useForm<LeadFormValues>>
  tags: string[]
  tagDraft: string
  setTagDraft: (v: string) => void
  addTag: () => void
  removeTag: (t: string) => void
  companies: any[]
  members: Membership[]
}) {
  const { register, control, formState: { errors } } = form
  const score = useWatchScore(form)

  return (
    <div className="space-y-4">
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="fullName" className="text-[12px]">Full name <span className="text-destructive">*</span></Label>
            <Input id="fullName" placeholder="Jane Cooper" {...register('fullName')} />
            {errors.fullName && <p className="text-[11px] text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[12px]">Email</Label>
            <Input id="email" type="email" placeholder="jane@company.com" {...register('email')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[12px]">Phone</Label>
            <Input id="phone" placeholder="+1 (555) 000-0000" {...register('phone')} />
          </div>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead details</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Source</Label>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value || 'website'} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[12px]">Lead score</Label>
              <span className="text-[11px] tabular-nums font-medium text-muted-foreground">{score}/100</span>
            </div>
            <Controller
              control={control}
              name="score"
              render={({ field }) => (
                <Slider
                  value={[field.value || 0]}
                  onValueChange={([v]) => field.onChange(v)}
                  min={0}
                  max={100}
                  step={1}
                />
              )}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Cold</span>
              <span>Warm</span>
              <span>Hot</span>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="estimatedValue" className="text-[12px]">Estimated value (USD)</Label>
            <Input
              id="estimatedValue"
              type="number"
              min={0}
              placeholder="5000"
              {...register('estimatedValue', {
                setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
              })}
            />
          </div>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ownership</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Owner</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Select value={field.value || 'unassigned'} onValueChange={(v) => field.onChange(v === 'unassigned' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.userId}>{m.user?.name || m.user?.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Company</Label>
            <Controller
              control={control}
              name="companyId"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Link to company…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Tags</Label>
          <div className="flex gap-2">
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Type a tag and press Enter"
              className="h-9 text-[12px]"
            />
            <Button type="button" variant="outline" size="icon" onClick={addTag} className="size-9 shrink-0">
              <Plus className="size-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-primary/10 text-primary"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="hover:text-destructive transition-colors"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function useWatchScore(form: ReturnType<typeof useForm<LeadFormValues>>): number {
  const v = form.watch('score')
  return typeof v === 'number' ? v : 50
}

// ----------------------------------------------------------------
// Activity tab — timeline
// ----------------------------------------------------------------

function ActivityTab({ leadId }: { leadId?: string }) {
  const { data: activities = [], isLoading } = useActivities()
  const filtered = leadId ? activities.filter((a: any) => a.leadId === leadId) : []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<ActivityIcon className="size-5" />}
        title="No activity yet"
        hint="Actions taken on this lead — emails, calls, status changes — will appear here in chronological order."
      />
    )
  }

  return (
    <ol className="relative space-y-3 pl-5">
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
      {filtered.map((a: any) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[14px] top-2 size-3 rounded-full bg-primary ring-2 ring-background" />
          <div className="card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft">
            <div className="flex items-center gap-2">
              {a.actor ? <Avatar name={a.actor.name} url={a.actor.avatarUrl} size={20} /> : <ActivityIcon className="size-4 text-muted-foreground" />}
              <span className="text-[12px] font-medium">{a.actor?.name || 'System'}</span>
              <span className="text-[11px] text-muted-foreground">{relTime(a.createdAt)}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {a.type}
              </span>
            </div>
            <div className="mt-1.5 text-[12px] text-foreground/80">{a.summary}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// ----------------------------------------------------------------
// Notes tab — list + composer
// ----------------------------------------------------------------

function NotesTab({ leadId }: { leadId?: string }) {
  const { data: notes = [], isLoading } = useNotes()
  const { create } = useNoteMutations()
  const [body, setBody] = React.useState('')

  const filtered = leadId ? notes.filter((n) => n.leadId === leadId) : []

  const handleSave = () => {
    const v = body.trim()
    if (!v) return
    create.mutate(
      { leadId, body: v, pinned: false } as any,
      {
        onSuccess: () => {
          setBody('')
          toast.success('Note added')
        },
        onError: () => toast.error('Could not save note'),
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="card-premium bg-card border border-border/60 rounded-xl p-3 shadow-soft">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note about this lead…"
          className="min-h-[80px] border-0 shadow-none focus-visible:ring-0 text-[13px] resize-none"
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <Button size="sm" onClick={handleSave} disabled={!body.trim() || create.isPending}>
            <StickyNote className="size-3.5" /> Add note
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<StickyNote className="size-5" />}
          title="No notes yet"
          hint="Capture context from conversations, research, or follow-up reminders here."
        />
      ) : (
        <ol className="space-y-2">
          {filtered.map((n) => (
            <li key={n.id} className="card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft">
              <div className="flex items-center gap-2">
                {n.author ? <Avatar name={n.author.name} url={n.author.avatarUrl} size={20} /> : <UserIcon className="size-4 text-muted-foreground" />}
                <span className="text-[12px] font-medium">{n.author?.name || 'Someone'}</span>
                <span className="text-[11px] text-muted-foreground">{relTime(n.createdAt)}</span>
                {n.pinned && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Pinned
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[12px] text-foreground/80 whitespace-pre-wrap">{n.body}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Files tab — list + upload button
// ----------------------------------------------------------------

function FilesTab({ leadId, leadName }: { leadId?: string; leadName?: string }) {
  const { data: files = [], isLoading } = useFiles()
  const { create } = useFileMutations()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = leadId ? files.filter((f: any) => f.leadId === leadId) : []

  const handlePick = () => inputRef.current?.click()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    create.mutate(
      {
        leadId,
        name: f.name,
        mimeType: f.type || 'application/octet-stream',
        size: f.size,
        url: `https://files.pulsecrm.app/${encodeURIComponent(f.name)}`,
        version: 1,
      } as any,
      {
        onSuccess: () => toast.success(`Uploaded ${f.name}`),
        onError: () => toast.error('Upload failed'),
      }
    )
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />

      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {filtered.length} file{filtered.length === 1 ? '' : 's'}
        </div>
        <Button size="sm" variant="outline" onClick={handlePick} disabled={!leadId || create.isPending}>
          <Upload className="size-3.5" /> Upload file
        </Button>
      </div>

      {!leadId ? (
        <EmptyState
          icon={<Paperclip className="size-5" />}
          title="Save the lead first"
          hint="Files can be attached once this lead has been created."
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Paperclip className="size-5" />}
          title="No files attached"
          hint="Upload proposals, contracts, or any document related to this lead."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((f: any) => (
            <li key={f.id} className="card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Paperclip className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={f.url} target="_blank" rel="noreferrer" className="text-[12px] font-medium truncate block hover:text-primary hover:underline">
                  {f.name}
                </a>
                <div className="text-[11px] text-muted-foreground">
                  {f.size ? `${(f.size / 1024).toFixed(1)} KB · ` : ''}
                  {f.uploader?.name ? `${f.uploader.name} · ` : ''}
                  {relTime(f.createdAt)}
                </div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
      {leadName && filtered.length > 0 && (
        <p className="sr-only">Files for {leadName}</p>
      )}
    </div>
  )
}
