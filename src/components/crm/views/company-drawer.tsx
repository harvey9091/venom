'use client'

/**
 * Pulse CRM — CompanyDrawer
 *
 * Rendered inside the global Sheet slide-over. We render the inner
 * content: header (Avatar + name + subtitle), Tabs (Overview | Activity
 * | Notes | Files), and a sticky footer (Delete + Save).
 *
 * In `mode="create"` the form starts empty and Save creates a new company
 * then calls `onClose()`. In edit mode the form is pre-filled from the
 * fetched company and Save updates + toasts but keeps the drawer open.
 */

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCompanies,
  useCompanyMutations,
  useActivities,
  useNotes,
  useNoteMutations,
  useFiles,
  useFileMutations,
  useContacts,
} from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  StatusDot,
  money,
  relTime,
  EmptyState,
  Avatar,
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
import type { Company, Contact } from '@/lib/types'
import {
  X,
  Trash2,
  Save,
  StickyNote,
  Paperclip,
  Upload,
  Activity as ActivityIcon,
  User as UserIcon,
  Globe,
  MapPin,
  Users,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const SIZES = ['1-10', '11-50', '50-200', '200-500', '500-1000', '1000+']

const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'E-commerce',
  'Education',
  'Manufacturing',
  'Media',
  'Real Estate',
  'Other',
]

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'churned', label: 'Churned' },
]

interface CompanyWithContacts extends Company {
  contacts?: Contact[]
}

// ----------------------------------------------------------------
// Form schema
// ----------------------------------------------------------------

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  revenue: z.number().optional().nullable(),
  website: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  status: z.string(),
  description: z.string().optional(),
})

type CompanyFormValues = z.infer<typeof companySchema>

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function CompanyDrawer({ id, mode, onClose }: { id?: string; mode?: 'create'; onClose: () => void }) {
  const isCreate = mode === 'create' || !id
  const { data: companies = [] } = useCompanies()
  const company = (id ? companies.find((c) => c.id === id) : undefined) as CompanyWithContacts | undefined

  const [tab, setTab] = React.useState('overview')

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      domain: '',
      industry: '',
      size: '',
      revenue: null,
      website: '',
      city: '',
      country: '',
      status: 'active',
      description: '',
    },
    values: company ? {
      name: company.name,
      domain: company.domain || '',
      industry: company.industry || '',
      size: company.size || '',
      revenue: company.revenue ?? null,
      website: company.website || '',
      city: company.city || '',
      country: company.country || '',
      status: company.status,
      description: '',
    } : undefined,
  })

  const { create, update, remove } = useCompanyMutations()
  const { data: contacts = [] } = useContacts()
  const linkedContacts = company ? contacts.filter((c) => c.companyId === company.id) : []

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...values,
      revenue: values.revenue ? Number(values.revenue) : null,
    }
    if (isCreate) {
      create.mutate(payload as any, {
        onSuccess: () => {
          toast.success('Company created')
          onClose()
        },
        onError: () => toast.error('Could not create company'),
      })
    } else if (id) {
      update.mutate({ id, ...payload } as any, {
        onSuccess: () => toast.success('Company updated'),
        onError: () => toast.error('Could not update company'),
      })
    }
  })

  const handleDelete = () => {
    if (!id) return
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Company deleted')
        onClose()
      },
    })
  }

  const openDrawer = useAppStore((s) => s.openDrawer)

  const titleName = isCreate ? 'New Company' : (company?.name || 'Company')
  const subtitle = isCreate
    ? 'Add a new company to your CRM'
    : company?.domain || company?.industry || 'Company details'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <CompanyLogo name={titleName} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight truncate">{titleName}</div>
            <div className="text-[12px] text-muted-foreground truncate">{subtitle}</div>
            {company && !isCreate && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot status={company.status} />
                  <span className="capitalize">{company.status}</span>
                </span>
                {company.size && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Users className="size-3" /> {company.size}
                  </span>
                )}
                {typeof company.revenue === 'number' && (
                  <span className="tabular-nums text-muted-foreground">{money(company.revenue)}</span>
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
        {tab === 'overview' && <OverviewTab form={form} linkedContacts={linkedContacts} onOpenContact={(cid) => openDrawer('contact', cid)} />}
        {tab === 'activity' && <ActivityTab companyId={id} />}
        {tab === 'notes' && <NotesTab companyId={id} />}
        {tab === 'files' && <FilesTab companyId={id} companyName={company?.name} />}
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
// Logo
// ----------------------------------------------------------------

function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  const initial = name?.[0]?.toUpperCase() || 'C'
  return (
    <div
      className="rounded-lg grid place-items-center bg-primary/10 text-primary font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  )
}

// ----------------------------------------------------------------
// Overview tab — form
// ----------------------------------------------------------------

function OverviewTab({
  form,
  linkedContacts,
  onOpenContact,
}: {
  form: ReturnType<typeof useForm<CompanyFormValues>>
  linkedContacts: Contact[]
  onOpenContact: (id: string) => void
}) {
  const { register, control, formState: { errors } } = form
  return (
    <div className="space-y-4">
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identity</div>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-[12px]">Company name <span className="text-destructive">*</span></Label>
          <Input id="name" placeholder="Acme Inc." {...register('name')} />
          {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="domain" className="text-[12px]">Domain</Label>
            <Input id="domain" placeholder="acme.com" {...register('domain')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website" className="text-[12px]">Website</Label>
            <Input id="website" placeholder="https://acme.com" {...register('website')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Industry</Label>
          <Controller
            control={control}
            name="industry"
            render={({ field }) => (
              <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {INDUSTRIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Profile</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Size</Label>
            <Controller
              control={control}
              name="size"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full"><SelectValue placeholder="Employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="revenue" className="text-[12px]">Annual revenue (USD)</Label>
            <Input
              id="revenue"
              type="number"
              min={0}
              placeholder="1000000"
              {...register('revenue', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city" className="text-[12px]">City</Label>
            <Input id="city" placeholder="San Francisco" {...register('city')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country" className="text-[12px]">Country</Label>
            <Input id="country" placeholder="United States" {...register('country')} />
          </div>
          <div className="col-span-2 space-y-1.5">
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
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="description" className="text-[12px]">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this company do?"
              className="min-h-[80px]"
              {...register('description')}
            />
          </div>
        </div>
      </div>

      {linkedContacts.length > 0 && (
        <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contacts ({linkedContacts.length})
            </div>
          </div>
          <ul className="space-y-1.5">
            {linkedContacts.map((c) => {
              const fullName = `${c.firstName} ${c.lastName}`.trim()
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenContact(c.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                  >
                    <Avatar name={fullName} url={c.avatarUrl} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate">{fullName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.jobTitle || c.email || '—'}</div>
                    </div>
                    <StatusDot status={c.status} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Activity tab — timeline
// ----------------------------------------------------------------

function ActivityTab({ companyId }: { companyId?: string }) {
  const { data: activities = [], isLoading } = useActivities()
  const filtered = companyId ? activities.filter((a: any) => a.companyId === companyId) : []

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
        hint="Actions taken on this company will appear here in chronological order."
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

function NotesTab({ companyId }: { companyId?: string }) {
  const { data: notes = [], isLoading } = useNotes()
  const { create } = useNoteMutations()
  const [body, setBody] = React.useState('')

  const filtered = companyId ? notes.filter((n) => n.companyId === companyId) : []

  const handleSave = () => {
    const v = body.trim()
    if (!v) return
    create.mutate(
      { companyId, body: v, pinned: false } as any,
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
          placeholder="Write a note about this company…"
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
          hint="Capture context from deals, meetings, or account research here."
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

function FilesTab({ companyId, companyName }: { companyId?: string; companyName?: string }) {
  const { data: files = [], isLoading } = useFiles()
  const { create } = useFileMutations()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = companyId ? files.filter((f: any) => f.companyId === companyId) : []

  const handlePick = () => inputRef.current?.click()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    create.mutate(
      {
        companyId,
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
        <Button size="sm" variant="outline" onClick={handlePick} disabled={!companyId || create.isPending}>
          <Upload className="size-3.5" /> Upload file
        </Button>
      </div>

      {!companyId ? (
        <EmptyState
          icon={<Paperclip className="size-5" />}
          title="Save the company first"
          hint="Files can be attached once this company has been created."
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
          hint="Upload contracts, logos, or any document related to this company."
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
      {companyName && filtered.length > 0 && (
        <p className="sr-only">Files for {companyName}</p>
      )}
    </div>
  )
}
