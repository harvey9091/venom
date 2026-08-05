'use client'

/**
 * Pulse CRM — DealDrawer
 *
 * Rendered inside the global Sheet slide-over (see
 * `src/components/crm/shell/entity-drawer.tsx`). We render the inner
 * content: header (editable title + stage badge), Tabs (Overview |
 * Activity | Tasks | Notes), and a sticky footer (Delete + Save).
 *
 * In `mode="create"` the form starts empty and Save creates a new deal
 * then calls `onClose()`. In edit mode the form is pre-filled from the
 * fetched deal and Save updates + toasts but keeps the drawer open.
 *
 * The Sheet already provides a built-in X button at `top-4 right-4`,
 * so the header uses `pr-12` to leave room for it (per convention
 * established by LeadDrawer / ContactDrawer / CompanyDrawer).
 */

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import {
  useDeals,
  useDealMutations,
  usePipelines,
  useContacts,
  useCompanies,
  useActivities,
  useTasks,
  useTaskMutations,
  useNotes,
  useNoteMutations,
  useSettings,
} from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  Avatar,
  StatusDot,
  money,
  relTime,
  EmptyState,
} from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Deal, Membership, Pipeline, Stage } from '@/lib/types'
import {
  Trash2,
  Save,
  Plus,
  StickyNote,
  CheckSquare,
  CalendarClock,
  Calendar as CalendarIcon,
  Pencil,
  Activity as ActivityIcon,
  User as UserIcon,
  CircleDollarSign,
  ListChecks,
  Mail,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { ThinkingState } from '@/components/crm/thinking'
import { simulateAIThinking, mockAIResponse } from '@/lib/ai-sim'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

// ----------------------------------------------------------------
// Form schema
// ----------------------------------------------------------------

const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().min(0),
  currency: z.string(),
  probability: z.number().min(0).max(100),
  stageId: z.string().optional().nullable(),
  pipelineId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  expectedClose: z.string().optional().nullable(),
  closeReason: z.string().optional().nullable(),
})

type DealFormValues = z.infer<typeof dealSchema>

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function DealDrawer({
  id,
  mode,
  onClose,
}: {
  id?: string
  mode?: 'create'
  onClose: () => void
}) {
  const isCreate = mode === 'create' || !id
  const { data: deals = [] } = useDeals()
  const deal = id ? deals.find((d) => d.id === id) : undefined

  const [tab, setTab] = React.useState('overview')
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState('')

  const { data: pipelines = [] } = usePipelines() as { data: Pipeline[] }
  const { data: contacts = [] } = useContacts()
  const { data: companies = [] } = useCompanies()
  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []

  // Resolve current pipeline + stages for the deal.
  const currentPipelineId = deal?.pipelineId || deal?.pipeline?.id || pipelines[0]?.id || ''
  const currentPipeline = pipelines.find((p) => p.id === currentPipelineId) || deal?.pipeline
  const stages: Stage[] = currentPipeline?.stages || deal?.pipeline?.stages || []

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: '',
      amount: 0,
      currency: 'USD',
      probability: 20,
      stageId: stages[0]?.id || null,
      pipelineId: currentPipelineId || null,
      ownerId: null,
      contactId: null,
      companyId: null,
      expectedClose: null,
      closeReason: null,
    },
    values: deal
      ? {
          title: deal.title,
          amount: deal.amount || 0,
          currency: deal.currency || 'USD',
          probability: deal.probability ?? 0,
          stageId: deal.stageId || deal.stage?.id || null,
          pipelineId: deal.pipelineId || deal.pipeline?.id || null,
          ownerId: deal.ownerId ?? null,
          contactId: deal.contactId ?? null,
          companyId: deal.companyId ?? null,
          expectedClose: deal.expectedClose ?? null,
          closeReason: (deal.closeReason as string | null) ?? null,
        }
      : undefined,
  })

  const { create, update, remove } = useDealMutations()

  const watchedStageId = form.watch('stageId')
  const watchedPipelineId = form.watch('pipelineId')
  const activePipeline =
    pipelines.find((p) => p.id === watchedPipelineId) || currentPipeline
  const activeStages: Stage[] = activePipeline?.stages || stages
  const selectedStage = activeStages.find((s) => s.id === watchedStageId)
  const canCloseDeal = !!selectedStage?.isWon || !!selectedStage?.isLost

  // When the pipeline select changes, reset stageId to the first stage of that pipeline.
  React.useEffect(() => {
    if (!watchedPipelineId) return
    const p = pipelines.find((x) => x.id === watchedPipelineId)
    if (!p) return
    if (!p.stages.find((s) => s.id === watchedStageId)) {
      form.setValue('stageId', p.stages[0]?.id || null)
      form.setValue('probability', p.stages[0]?.probability ?? form.getValues('probability'))
    }
  }, [watchedPipelineId, pipelines, form, watchedStageId])

  // When the stage changes, auto-update probability to the stage's default
  // (only in create mode, so we don't override user-set probability on existing deals).
  React.useEffect(() => {
    if (!isCreate || !selectedStage) return
    form.setValue('probability', selectedStage.probability)
  }, [selectedStage, isCreate, form])

  // If the chosen stage is no longer won/lost, clear closeReason.
  React.useEffect(() => {
    if (!canCloseDeal && form.getValues('closeReason')) {
      form.setValue('closeReason', null)
    }
  }, [canCloseDeal, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    // Auto-set closeReason if user picked a won/lost stage without choosing one.
    let closeReason = values.closeReason
    if (selectedStage?.isWon && !closeReason) closeReason = 'won'
    if (selectedStage?.isLost && !closeReason) closeReason = 'lost'

    const payload = {
      ...values,
      amount: Number(values.amount) || 0,
      probability: Number(values.probability) || 0,
      closeReason: closeReason as 'won' | 'lost' | null,
    }
    if (isCreate) {
      create.mutate(payload as any, {
        onSuccess: () => {
          toast.success('Deal created')
          onClose()
        },
        onError: () => toast.error('Could not create deal'),
      })
    } else if (id) {
      update.mutate({ id, ...payload } as any, {
        onSuccess: () => toast.success('Deal updated'),
        onError: () => toast.error('Could not update deal'),
      })
    }
  })

  const handleDelete = () => {
    if (!id) return
    remove.mutate(id, {
      onSuccess: () => {
        toast.success('Deal deleted')
        onClose()
      },
    })
  }

  // Inline-editable title handlers.
  const startEditTitle = () => {
    if (isCreate) return // create mode uses the form input directly
    setTitleDraft(deal?.title || '')
    setIsEditingTitle(true)
  }
  const commitTitle = () => {
    const v = titleDraft.trim()
    setIsEditingTitle(false)
    if (!v || !id) return
    if (v === deal?.title) return
    form.setValue('title', v)
    update.mutate({ id, title: v }, {
      onSuccess: () => toast.success('Title updated'),
      onError: () => toast.error('Could not update title'),
    })
  }

  const titleDisplay = isCreate
    ? form.watch('title') || 'New deal'
    : deal?.title || 'Deal'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <CircleDollarSign className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Editable title (edit mode only). */}
            {isEditingTitle && !isCreate ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                className="h-8 text-[15px] font-semibold tracking-tight px-1.5"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTitle}
                className="group inline-flex items-center gap-1.5 max-w-full"
              >
                <span className="text-[15px] font-semibold tracking-tight truncate">
                  {titleDisplay}
                </span>
                {!isCreate && (
                  <Pencil className="size-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                )}
              </button>
            )}
            <div className="text-[12px] text-muted-foreground truncate mt-0.5">
              {isCreate
                ? 'Create a new deal'
                : deal?.company?.name || deal?.contact?.firstName + ' ' + deal?.contact?.lastName || 'Deal details'}
            </div>
            {/* Stage badge + amount + probability chips */}
            {deal && !isCreate && (
              <div className="mt-1.5 flex items-center gap-3 text-[11px] flex-wrap">
                {selectedStage ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${selectedStage.color}22`, color: selectedStage.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: selectedStage.color }} />
                    {selectedStage.name}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <StatusDot status="todo" /> No stage
                  </span>
                )}
                <span className="tabular-nums text-muted-foreground">
                  {money(deal.amount || 0, deal.currency || 'USD')}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {deal.probability || 0}% likely
                </span>
                {deal.closeReason && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] font-semibold capitalize',
                    deal.closeReason === 'won' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  )}>
                    {deal.closeReason}
                  </Badge>
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
            <TabsTrigger value="tasks" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-[12px] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 py-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
              Notes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5">
        {tab === 'overview' && (
          <OverviewTab
            form={form}
            pipelines={pipelines}
            stages={activeStages}
            contacts={contacts}
            companies={companies}
            members={members}
            canCloseDeal={canCloseDeal}
            deal={deal}
          />
        )}
        {tab === 'activity' && <ActivityTab dealId={id} />}
        {tab === 'tasks' && <TasksTab dealId={id} />}
        {tab === 'notes' && <NotesTab dealId={id} />}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
        {!isCreate && id ? (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={remove.isPending}
          >
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
  pipelines,
  stages,
  contacts,
  companies,
  members,
  canCloseDeal,
  deal,
}: {
  form: ReturnType<typeof useForm<DealFormValues>>
  pipelines: Pipeline[]
  stages: Stage[]
  contacts: any[]
  companies: any[]
  members: Membership[]
  canCloseDeal: boolean
  deal?: Deal
}) {
  const { register, control, formState: { errors } } = form
  const probability = form.watch('probability') || 0
  const amount = form.watch('amount') || 0
  const currency = form.watch('currency') || 'USD'

  // AI email generator state — visual-only thinking orb while the mock
  // outreach email is "written".
  const { create: createNote } = useNoteMutations()
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)

  const [isGenerating, setIsGenerating] = React.useState(false)
  const [genLabel, setGenLabel] = React.useState('Writing…')
  const [emailDialogOpen, setEmailDialogOpen] = React.useState(false)
  const [emailBody, setEmailBody] = React.useState('')

  const runGenerate = async () => {
    setIsGenerating(true)
    setGenLabel('Writing…')
    try {
      await simulateAIThinking('email', {
        duration: 1200,
        onLabel: (label) => setGenLabel(label),
      })
      const contactName = deal?.contact?.firstName || 'the lead'
      const body = mockAIResponse('Write outreach email to ' + contactName)
      setEmailBody(body)
      setEmailDialogOpen(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  const handleInsertAsNote = () => {
    if (!deal?.id) {
      toast.error('Save the deal first to insert a note')
      return
    }
    createNote.mutate(
      {
        workspaceId: workspace?.id,
        authorId: user?.id,
        dealId: deal.id,
        title: 'AI outreach email',
        body: emailBody,
      } as any,
      {
        onSuccess: () => {
          toast.success('Email inserted as note')
          setEmailDialogOpen(false)
        },
        onError: () => toast.error('Could not save note'),
      },
    )
  }

  return (
    <div className="space-y-4">
      {/* Deal basics */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deal details
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-[12px]">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input id="title" placeholder="Q4 enterprise renewal" {...register('title')} />
          {errors.title && <p className="text-[11px] text-destructive">{errors.title.message}</p>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="amount" className="text-[12px]">Amount</Label>
            <Input
              id="amount"
              type="number"
              min={0}
              step="any"
              placeholder="5000"
              {...register('amount', {
                setValueAs: (v) => (v === '' || v == null ? 0 : Number(v)),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Currency</Label>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value || 'USD'} onValueChange={field.onChange}>
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="USD" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          Preview: <span className="font-medium text-foreground">{money(amount, currency)}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[12px]">Probability</Label>
            <span className="text-[11px] tabular-nums font-medium text-muted-foreground">
              {probability}%
            </span>
          </div>
          <Controller
            control={control}
            name="probability"
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
            <span>Unlikely</span>
            <span>50/50</span>
            <span>Certain</span>
          </div>
        </div>
      </div>

      {/* Pipeline & stage */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline &amp; stage
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Pipeline</Label>
            <Controller
              control={control}
              name="pipelineId"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="Choose pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.length === 0 && <SelectItem value="none" disabled>No pipelines</SelectItem>}
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Stage</Label>
            <Controller
              control={control}
              name="stageId"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="Choose stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.length === 0 && <SelectItem value="none" disabled>No stages</SelectItem>}
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Expected close</Label>
            <Controller
              control={control}
              name="expectedClose"
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-9 w-full justify-start text-[12px] font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="size-3.5 mr-1.5" />
                      {field.value ? format(new Date(field.value), 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(d) => field.onChange(d ? d.toISOString() : null)}
                      initialFocus
                    />
                    {field.value && (
                      <div className="border-t border-border p-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-destructive hover:text-destructive"
                          onClick={() => field.onChange(null)}
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Close reason</Label>
            <Controller
              control={control}
              name="closeReason"
              render={({ field }) => (
                <Select
                  value={field.value || 'none'}
                  onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                  disabled={!canCloseDeal}
                >
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder={canCloseDeal ? 'Open' : '—'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Open</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {!canCloseDeal && (
              <p className="text-[10px] text-muted-foreground">
                Move to a Won/Lost stage to close this deal.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Ownership & links */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft space-y-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ownership &amp; links
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Owner</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Select value={field.value || 'unassigned'} onValueChange={(v) => field.onChange(v === 'unassigned' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="Assign to…" />
                  </SelectTrigger>
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
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="Link to company…" />
                  </SelectTrigger>
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
          <div className="col-span-2 space-y-1.5">
            <Label className="text-[12px]">Contact</Label>
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <Select value={field.value || 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger className="h-9 text-[12px] w-full">
                    <SelectValue placeholder="Link to contact…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}{c.jobTitle ? ` · ${c.jobTitle}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* AI outreach */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              AI outreach
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Draft a personalized first-touch email to this deal’s contact.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={runGenerate}
            disabled={isGenerating}
            aria-label="Generate outreach email"
          >
            {isGenerating ? (
              <ThinkingState
                compact
                size="xs"
                label={genLabel}
                variant="trio"
                theme="rainbow"
              />
            ) : (
              <>
                <Mail className="size-3.5" />
                Generate outreach email
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              AI outreach email
            </DialogTitle>
            <DialogDescription>
              Edit, copy, or save this draft as a note on the deal.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            className="min-h-[260px] text-[12px] resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ThinkingState
                  compact
                  size="xs"
                  label={genLabel}
                  variant="trio"
                  theme="rainbow"
                />
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </>
              )}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="size-3.5" /> Copy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleInsertAsNote}
              disabled={createNote.isPending || !deal?.id}
            >
              <StickyNote className="size-3.5" /> Insert as note
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ----------------------------------------------------------------
// Activity tab — timeline filtered by dealId
// ----------------------------------------------------------------

function ActivityTab({ dealId }: { dealId?: string }) {
  const { data: activities = [], isLoading } = useActivities()
  const filtered = dealId ? activities.filter((a: any) => a.dealId === dealId) : []

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
        hint="Stage changes, notes, and edits on this deal will appear here in chronological order."
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
              {a.actor ? (
                <Avatar name={a.actor.name} url={a.actor.avatarUrl} size={20} />
              ) : (
                <ActivityIcon className="size-4 text-muted-foreground" />
              )}
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
// Tasks tab — list filtered by dealId + Add task button
// ----------------------------------------------------------------

function TasksTab({ dealId }: { dealId?: string }) {
  const { data: tasks = [], isLoading } = useTasks()
  const { create } = useTaskMutations()
  const openDrawer = useAppStore((s) => s.openDrawer)
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)

  const filtered = dealId ? tasks.filter((t) => t.dealId === dealId) : []

  const handleAddTask = () => {
    if (!dealId) {
      toast.error('Save the deal first to add tasks')
      return
    }
    create.mutate(
      {
        workspaceId: workspace?.id,
        dealId,
        title: 'New task',
        status: 'todo',
        priority: 'medium',
        ownerId: user?.id,
        creatorId: user?.id,
      } as any,
      {
        onSuccess: (task: any) => {
          toast.success('Task created')
          if (task?.id) openDrawer('task', task.id)
        },
        onError: () => toast.error('Could not create task'),
      }
    )
  }

  if (!dealId) {
    return (
      <EmptyState
        icon={<ListChecks className="size-5" />}
        title="Save the deal first"
        hint="Tasks can be attached once this deal has been created."
        action={
          <Button size="sm" onClick={handleAddTask} disabled>
            <Plus className="size-3.5" /> Add task
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {filtered.length} task{filtered.length === 1 ? '' : 's'}
        </div>
        <Button size="sm" variant="outline" onClick={handleAddTask} disabled={create.isPending}>
          <Plus className="size-3.5" /> Add task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-5" />}
          title="No tasks yet"
          hint="Add follow-ups, demos, or contract reviews to keep this deal on track."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => openDrawer('task', t.id)}
                className="card-premium w-full text-left bg-card border border-border/60 rounded-lg p-3 shadow-soft hover:-translate-y-px hover:shadow-glow transition-all flex items-center gap-3"
              >
                <StatusDot status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[13px] font-medium truncate', t.status === 'done' && 'line-through text-muted-foreground')}>
                    {t.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="capitalize">{t.status.replace('_', ' ')}</span>
                    <span>·</span>
                    <span className="capitalize">{t.priority}</span>
                    {t.dueDate && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3" />
                          {relTime(t.dueDate)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {t.assignee ? (
                  <Avatar name={t.assignee.name} url={t.assignee.avatarUrl} size={22} />
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Notes tab — composer + list filtered by dealId
// ----------------------------------------------------------------

function NotesTab({ dealId }: { dealId?: string }) {
  const { data: notes = [], isLoading } = useNotes()
  const { create } = useNoteMutations()
  const [body, setBody] = React.useState('')

  const filtered = dealId ? notes.filter((n) => n.dealId === dealId) : []

  const handleSave = () => {
    const v = body.trim()
    if (!v) return
    if (!dealId) {
      toast.error('Save the deal first to add notes')
      return
    }
    create.mutate(
      { dealId, body: v, pinned: false } as any,
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
          placeholder={dealId ? 'Write a note about this deal…' : 'Save the deal first to add notes.'}
          disabled={!dealId}
          className="min-h-[80px] border-0 shadow-none focus-visible:ring-0 text-[13px] resize-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <Button size="sm" onClick={handleSave} disabled={!body.trim() || create.isPending || !dealId}>
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
          hint="Capture context from conversations, proposals, or negotiation details here."
        />
      ) : (
        <ol className="space-y-2">
          {filtered.map((n) => (
            <li key={n.id} className="card-premium bg-card border border-border/60 rounded-lg p-3 shadow-soft">
              <div className="flex items-center gap-2">
                {n.author ? (
                  <Avatar name={n.author.name} url={n.author.avatarUrl} size={20} />
                ) : (
                  <UserIcon className="size-4 text-muted-foreground" />
                )}
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
