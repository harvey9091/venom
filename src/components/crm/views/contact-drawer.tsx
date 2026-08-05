'use client'

/**
 * Pulse CRM — ContactDrawer
 *
 * Rendered inside the global Sheet slide-over. We render the inner
 * content: header (Avatar + name + subtitle), Tabs (Overview | Activity
 * | Notes | Files), and a sticky footer (Delete + Save).
 *
 * In `mode="create"` the form starts empty and Save creates a new contact
 * then calls `onClose()`. In edit mode the form is pre-filled from the
 * fetched contact and Save updates + toasts but keeps the drawer open.
 */

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useContacts,
  useContactMutations,
  useActivities,
  useNotes,
  useNoteMutations,
  useFiles,
  useFileMutations,
  useCompanies,
} from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  StatusDot,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import type { Contact } from '@/lib/types'
import {
  X,
  Trash2,
  Save,
  Plus,
  StickyNote,
  Paperclip,
  Upload,
  Activity as ActivityIcon,
  User as UserIcon,
  Mail,
  Phone,
  Building2,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
]

// ----------------------------------------------------------------
// Form schema
// ----------------------------------------------------------------

const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  companyId: z.string().optional().nullable(),
  status: z.string(),
})

type ContactFormValues = z.infer<typeof contactSchema>

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function ContactDrawer({ id, mode, onClose }: { id?: string; mode?: 'create'; onClose: () => void }) {
  const isCreate = mode === 'create' || !id
  const { data: contacts = [] } = useContacts()
  const contact = id ? contacts.find((c) => c.id === id) : undefined

  const [tab, setTab] = React.useState('overview')

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      companyId: null,
      status: 'active',
    },
    values: contact ? {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      jobTitle: contact.jobTitle || '',
      companyId: contact.companyId ?? null,
      status: contact.status,
    } : undefined,
  })

  const { create, update, remove } = useContactMutations()
  const { data: companies = [] } = useCompanies()

  const [tags, setTags] = React.useState<string[]>(contact?.tags?.map((t) => t.name) || [])
  const [tagDraft, setTagDraft] = React.useState('')

  React.useEffect(() => {
    if (contact?.tags) setTags(contact.tags.map((t) => t.name))
  }, [contact?.id])

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = { ...values, tags }
    if (isCreate) {
      create.mutate(payload as any, {
        onSuccess: () => {
          toast.success('Contact created')
          onClose()
        },
        onError: () => toast.error('Could not create contact'),
      })
    } else if (id) {
      update.mutate({ id, ...payload } as any, {
        onSuccess: () => toast.success('Contact updated'),
        onError: () => toast.error('Could not update contact'),
      })
    }
  })

  const handleDelete = () => {
    if (!id) return
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Contact deleted')
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

  const fullName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : ''
  const titleName = isCreate ? 'New Contact' : fullName
  const subtitle = isCreate
    ? 'Create a new contact'
    : contact?.email || contact?.jobTitle || contact?.company?.name || 'Contact details'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <Avatar name={titleName} url={contact?.avatarUrl} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight truncate">{titleName}</div>
            <div className="text-[12px] text-muted-foreground truncate">{subtitle}</div>
            {contact && !isCreate && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot status={contact.status} />
                  <span className="capitalize">{contact.status}</span>
                </span>
                {contact.company?.name && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Building2 className="size-3" /> {contact.company.name}
                  </span>
                )}
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
          />
        )}
        {tab === 'activity' && <ActivityTab contactId={id} />}
        {tab === 'notes' && <NotesTab contactId={id} />}
        {tab === 'files' && <FilesTab contactId={id} contactName={fullName} />}
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
}: {
  form: ReturnType<typeof useForm<ContactFormValues>>
  tags: string[]
  tagDraft: string
  setTagDraft: (v: string) => void
  addTag: () => void
  removeTag: (t: string) => void
  companies: any[]
}) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="space-y-4">
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personal</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-[12px]">First name <span className="text-destructive">*</span></Label>
            <Input id="firstName" placeholder="Jane" {...register('firstName')} />
            {errors.firstName && <p className="text-[11px] text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-[12px]">Last name <span className="text-destructive">*</span></Label>
            <Input id="lastName" placeholder="Cooper" {...register('lastName')} />
            {errors.lastName && <p className="text-[11px] text-destructive">{errors.lastName.message}</p>}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="jobTitle" className="text-[12px]">Job title</Label>
            <Input id="jobTitle" placeholder="Head of Sales" {...register('jobTitle')} />
          </div>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="email" className="text-[12px]">Email</Label>
            <Input id="email" type="email" placeholder="jane@company.com" {...register('email')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="phone" className="text-[12px]">Phone</Label>
            <Input id="phone" placeholder="+1 (555) 000-0000" {...register('phone')} />
          </div>
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Linked company</div>
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
        <div className="space-y-1.5">
          <Label className="text-[12px]">Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
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

// ----------------------------------------------------------------
// Activity tab — timeline
// ----------------------------------------------------------------

function ActivityTab({ contactId }: { contactId?: string }) {
  const { data: activities = [], isLoading } = useActivities()
  const filtered = contactId ? activities.filter((a: any) => a.contactId === contactId) : []

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
        hint="Actions taken on this contact will appear here in chronological order."
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

function NotesTab({ contactId }: { contactId?: string }) {
  const { data: notes = [], isLoading } = useNotes()
  const { create } = useNoteMutations()
  const [body, setBody] = React.useState('')

  const filtered = contactId ? notes.filter((n) => n.contactId === contactId) : []

  const handleSave = () => {
    const v = body.trim()
    if (!v) return
    create.mutate(
      { contactId, body: v, pinned: false } as any,
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
          placeholder="Write a note about this contact…"
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

function FilesTab({ contactId, contactName }: { contactId?: string; contactName?: string }) {
  const { data: files = [], isLoading } = useFiles()
  const { create } = useFileMutations()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = contactId ? files.filter((f: any) => f.contactId === contactId) : []

  const handlePick = () => inputRef.current?.click()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    create.mutate(
      {
        contactId,
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
        <Button size="sm" variant="outline" onClick={handlePick} disabled={!contactId || create.isPending}>
          <Upload className="size-3.5" /> Upload file
        </Button>
      </div>

      {!contactId ? (
        <EmptyState
          icon={<Paperclip className="size-5" />}
          title="Save the contact first"
          hint="Files can be attached once this contact has been created."
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
          hint="Upload contracts, headshots, or any document related to this contact."
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
      {contactName && filtered.length > 0 && (
        <p className="sr-only">Files for {contactName}</p>
      )}
    </div>
  )
}
