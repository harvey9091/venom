'use client'

/**
 * Pulse CRM — Pipeline Kanban view
 *
 * Layout:
 *   ┌─ Header ──────────────────────────────────────────────────┐
 *   │  Pipeline selector │ title │ Add stage │ + New deal        │
 *   ├─ Kanban board (horizontal scroll) ─────────────────────────┤
 *   │  ┌─ Stage column ─┐  ┌─ Stage column ─┐  …  ┌─ Add stage ─┐│
 *   │  │ • Name • count │  │ • Name • count │     │ + button    ││
 *   │  │ • total value  │  │ • total value  │     │  (expands)  ││
 *   │  │ ┌─ Deal card ─┐│  │ ┌─ Deal card ─┐│     └─────────────┘│
 *   │  │ │ title       ││  │ │ title       ││                     │
 *   │  │ │ $amount     ││  │ │ $amount     ││                     │
 *   │  │ │ prob bar    ││  │ │ prob bar    ││                     │
 *   │  │ └─────────────┘│  │ └─────────────┘│                     │
 *   │  └────────────────┘  └────────────────┘                     │
 *   ├─ Forecasting panel ────────────────────────────────────────┤
 *   │  Total pipeline value │ Weighted │ Win rate │ Stages bar    │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Drag-and-drop uses @dnd-kit/core + @dnd-kit/sortable.
 *   • Cross-column drop → update deal.stageId (+ probability from stage)
 *   • Same-column drop → visual reorder only (local state, no API call)
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePipelines, usePipelineMutations, useDeals, useDealMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, money, relTime, EmptyState } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { Deal, Pipeline, Stage } from '@/lib/types'
import {
  Plus,
  CalendarClock,
  TrendingUp,
  PieChart,
  Target,
  X,
  Check,
  GripVertical,
  KanbanSquare,
  ArrowLeftRight,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Preset color palette for the new-stage picker. */
const STAGE_COLORS = [
  '#64748b', // slate
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#14b8a6', // teal
]

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Sum of deal amounts (only open deals — stage not won/lost). */
function totalOpenValue(deals: Deal[]): number {
  return deals
    .filter((d) => !d.stage?.isWon && !d.stage?.isLost)
    .reduce((sum, d) => sum + (d.amount || 0), 0)
}

/** Weighted pipeline = sum(amount × probability / 100) for open deals. */
function weightedValue(deals: Deal[]): number {
  return deals
    .filter((d) => !d.stage?.isWon && !d.stage?.isLost)
    .reduce((sum, d) => sum + (d.amount || 0) * ((d.probability || 0) / 100), 0)
}

/** Win rate = won / (won + lost) × 100. */
function winRate(deals: Deal[]): number {
  const won = deals.filter((d) => d.closeReason === 'won' || d.stage?.isWon).length
  const lost = deals.filter((d) => d.closeReason === 'lost' || d.stage?.isLost).length
  const closed = won + lost
  if (closed === 0) return 0
  return Math.round((won / closed) * 100)
}

/** Group deals by stageId, preserving stage order. */
function groupDealsByStage(deals: Deal[], stages: Stage[]): Record<string, Deal[]> {
  const map: Record<string, Deal[]> = {}
  stages.forEach((s) => (map[s.id] = []))
  deals.forEach((d) => {
    if (map[d.stageId]) map[d.stageId].push(d)
    else if (d.stage) {
      // stage exists in deal but not in pipeline.stages — bucket under stage.id
      map[d.stage.id] = map[d.stage.id] || []
      map[d.stage.id].push(d)
    }
  })
  return map
}

// ----------------------------------------------------------------
// Draggable deal card (board)
// ----------------------------------------------------------------

function DealCard({ deal, isOverlay }: { deal: Deal; isOverlay?: boolean }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: 'deal', stageId: deal.stageId },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // When this card is the active drag source, hide it (the DragOverlay shows the clone).
  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="rounded-xl border border-dashed border-border/40 bg-muted/20 h-[112px]"
        aria-hidden
      />
    )
  }

  const prob = Math.max(0, Math.min(100, deal.probability || 0))
  const probColor = prob >= 70 ? 'bg-emerald-500' : prob >= 40 ? 'bg-amber-500' : 'bg-slate-400'
  const companyName = deal.company?.name
  const avatarName = companyName || deal.title

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? style : undefined}
      className={cn(
        'group card-premium bg-card border border-border p-3 shadow-soft',
        'rounded-xl hover:shadow-premium hover:-translate-y-0.5 transition-all',
        'cursor-grab active:cursor-grabbing select-none',
        isOverlay && 'rotate-2 scale-105 shadow-premium ring-2 ring-primary/40'
      )}
      onClick={() => !isOverlay && openDrawer('deal', deal.id)}
      {...(!isOverlay ? attributes : {})}
      {...(!isOverlay ? listeners : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-medium leading-snug truncate flex-1">{deal.title}</div>
        <GripVertical className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors shrink-0" />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Avatar name={avatarName} url={deal.company?.logoUrl} size={18} />
        <span className="text-[11px] text-muted-foreground truncate">{companyName || '—'}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-[16px] font-semibold tabular-nums leading-none">
          {money(deal.amount || 0, deal.currency || 'INR')}
        </div>
        {deal.owner && (
          <Avatar name={deal.owner.name} url={deal.owner.avatarUrl} size={20} />
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', probColor)} style={{ width: `${prob}%` }} />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">{prob}%</span>
      </div>
      {deal.expectedClose && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarClock className="size-3" />
          <span>Closes {relTime(deal.expectedClose)}</span>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Droppable column body (so empty columns accept drops)
// ----------------------------------------------------------------

function ColumnBody({
  stageId,
  deals,
  children,
}: {
  stageId: string
  deals: Deal[]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${stageId}`,
    data: { type: 'column', stageId },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 p-2 space-y-2 overflow-y-auto scroll-area max-h-[calc(100vh-280px)] min-h-[140px] rounded-b-xl transition-colors',
        isOver && 'bg-primary/5'
      )}
    >
      {deals.length === 0 && (
        <div className="h-24 rounded-lg border border-dashed border-border/50 grid place-items-center text-[11px] text-muted-foreground">
          Drop deals here
        </div>
      )}
      {children}
    </div>
  )
}

// ----------------------------------------------------------------
// Stage column
// ----------------------------------------------------------------

function StageColumn({
  stage,
  deals,
  index,
}: {
  stage: Stage
  deals: Deal[]
  index: number
}) {
  const total = deals.reduce((sum, d) => sum + (d.amount || 0), 0)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: index * 0.04 }}
      className="w-[300px] shrink-0 bg-muted/30 rounded-xl p-2 flex flex-col border border-border/60"
    >
      <div className="px-2 pt-1.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: stage.color }}
          />
          <span className="text-[12px] font-semibold truncate">{stage.name}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground bg-background px-1.5 py-0.5 rounded shrink-0">
            {deals.length}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[11px] tabular-nums font-medium text-muted-foreground shrink-0">
            {money(total)}
          </span>
        )}
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <ColumnBody stageId={stage.id} deals={deals}>
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </ColumnBody>
      </SortableContext>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Add-stage inline form
// ----------------------------------------------------------------

function AddStageCard({
  onSave,
  onCancel,
}: {
  onSave: (s: { name: string; color: string; probability: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState(STAGE_COLORS[0])
  const [probability, setProbability] = React.useState(20)

  const handleSave = () => {
    const v = name.trim()
    if (!v) {
      toast.error('Stage name is required')
      return
    }
    onSave({ name: v, color, probability })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16 }}
      className="w-[300px] shrink-0 bg-card border border-dashed border-primary/40 rounded-xl p-3 space-y-3 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-primary">New stage</span>
        <Button variant="ghost" size="icon" className="size-6" onClick={onCancel} aria-label="Cancel">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Name</Label>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="e.g. Negotiation"
          className="h-8 text-[12px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground">Color</Label>
        <div className="flex flex-wrap gap-1.5">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'size-6 rounded-full transition-all',
                color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'hover:scale-110'
              )}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Default probability</Label>
          <span className="text-[11px] tabular-nums font-medium">{probability}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={probability}
          onChange={(e) => setProbability(Number(e.target.value))}
          className="w-full accent-primary h-1.5 cursor-pointer"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 flex-1 text-[12px]" onClick={handleSave}>
          <Check className="size-3.5" /> Add stage
        </Button>
      </div>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Kanban board (DnD)
// ----------------------------------------------------------------

function KanbanBoard({
  pipeline,
  deals,
}: {
  pipeline: Pipeline
  deals: Deal[]
}) {
  const { update } = useDealMutations()
  const [activeId, setActiveId] = React.useState<string | null>(null)
  // Local ordering — kept in sync with `deals` from the query, but reordered locally
  // on same-column drops so we don't trigger a refetch.
  const [localDeals, setLocalDeals] = React.useState<Deal[]>(deals)

  React.useEffect(() => {
    setLocalDeals(deals)
  }, [deals])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const stages = pipeline.stages
  const grouped = React.useMemo(() => groupDealsByStage(localDeals, stages), [localDeals, stages])

  const activeDeal = activeId ? localDeals.find((d) => d.id === activeId) : null

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const activeDealId = String(active.id)
    const draggedDeal = localDeals.find((d) => d.id === activeDealId)
    if (!draggedDeal) return

    // Determine the target stageId.
    // `over.data.current.stageId` is set on the column droppable; cards carry stageId too.
    let targetStageId: string | undefined =
      (over.data.current as any)?.stageId as string | undefined
    if (!targetStageId && typeof over.id === 'string' && over.id.startsWith('col-')) {
      targetStageId = over.id.slice(4)
    }
    if (!targetStageId) {
      // Dropped over another card → use that card's stage.
      const overDeal = localDeals.find((d) => d.id === String(over.id))
      if (overDeal) targetStageId = overDeal.stageId
    }
    if (!targetStageId) return

    const sameStage = targetStageId === draggedDeal.stageId

    if (sameStage) {
      // Same column → visual reorder only (no API call per task spec).
      const stageDeals = grouped[targetStageId] || []
      const oldIndex = stageDeals.findIndex((d) => d.id === activeDealId)
      const newIndex = stageDeals.findIndex((d) => d.id === String(over.id))
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
      const reordered = arrayMove(stageDeals, oldIndex, newIndex)
      // Replace that stage's slice in the full local list.
      const others = localDeals.filter((d) => d.stageId !== targetStageId)
      setLocalDeals([...others, ...reordered])
      return
    }

    // Cross-column → API call to update stageId + new stage's default probability.
    const newStage = stages.find((s) => s.id === targetStageId)
    if (!newStage) return

    // Optimistic local update.
    setLocalDeals((prev) =>
      prev.map((d) =>
        d.id === activeDealId
          ? { ...d, stageId: targetStageId, stage: newStage, probability: newStage.probability }
          : d
      )
    )

    update.mutate(
      { id: activeDealId, stageId: targetStageId, probability: newStage.probability },
      {
        onSuccess: () => toast.success(`Moved to ${newStage.name}`),
        onError: () => toast.error('Could not move deal'),
      }
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto scroll-area pb-2">
        {stages.map((s, i) => (
          <StageColumn
            key={s.id}
            stage={s}
            deals={grouped[s.id] || []}
            index={i}
          />
        ))}
        <AddStageSlot pipeline={pipeline} />
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

/** The "+" tile at the end of the row that expands into AddStageCard. */
function AddStageSlot({ pipeline }: { pipeline: Pipeline }) {
  const [adding, setAdding] = React.useState(false)
  const { update } = usePipelineMutations()

  const handleSave = (s: { name: string; color: string; probability: number }) => {
    const newStage = {
      id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pipelineId: pipeline.id,
      name: s.name,
      color: s.color,
      order: pipeline.stages.length,
      probability: s.probability,
      isWon: false,
      isLost: false,
    }
    update.mutate(
      { id: pipeline.id, stages: [...pipeline.stages, newStage] } as any,
      {
        onSuccess: () => {
          toast.success(`Stage "${s.name}" added`)
          setAdding(false)
        },
        onError: () => toast.error('Could not add stage'),
      }
    )
  }

  if (adding) {
    return (
      <AddStageCard onSave={handleSave} onCancel={() => setAdding(false)} />
    )
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="w-[300px] shrink-0 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-colors grid place-items-center text-muted-foreground hover:text-foreground min-h-[140px]"
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className="size-9 rounded-full bg-muted grid place-items-center">
          <Plus className="size-4" />
        </div>
        <span className="text-[12px] font-medium">Add stage</span>
      </div>
    </button>
  )
}

// ----------------------------------------------------------------
// Forecasting panel
// ----------------------------------------------------------------

function ForecastingPanel({ deals, stages }: { deals: Deal[]; stages: Stage[] }) {
  const total = totalOpenValue(deals)
  const weighted = weightedValue(deals)
  const rate = winRate(deals)

  // Per-stage value for the stacked breakdown bar.
  const stageStats = stages
    .map((s) => {
      const ds = deals.filter((d) => d.stageId === s.id || d.stage?.id === s.id)
      return {
        stage: s,
        value: ds.reduce((sum, d) => sum + (d.amount || 0), 0),
        count: ds.length,
      }
    })
    .filter((x) => x.value > 0)
  const totalForBar = stageStats.reduce((sum, x) => sum + x.value, 0) || 1

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
      {/* Total pipeline value */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="size-3.5" />
          Total pipeline
        </div>
        <div className="mt-1.5 text-[20px] font-semibold tabular-nums">{money(total)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {deals.filter((d) => !d.stage?.isWon && !d.stage?.isLost).length} open deals
        </div>
      </div>

      {/* Weighted pipeline */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Target className="size-3.5" />
          Weighted
        </div>
        <div className="mt-1.5 text-[20px] font-semibold tabular-nums">{money(weighted)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {total > 0 ? `${Math.round((weighted / total) * 100)}% of total` : '—'}
        </div>
      </div>

      {/* Win rate */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <PieChart className="size-3.5" />
          Win rate
        </div>
        <div className="mt-1.5 text-[20px] font-semibold tabular-nums">{rate}%</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {deals.filter((d) => d.closeReason === 'won' || d.stage?.isWon).length} won ·{' '}
          {deals.filter((d) => d.closeReason === 'lost' || d.stage?.isLost).length} lost
        </div>
      </div>

      {/* Per-stage breakdown bar */}
      <div className="card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <ArrowLeftRight className="size-3.5" />
          By stage
        </div>
        {stageStats.length === 0 ? (
          <div className="mt-3 text-[12px] text-muted-foreground">No deal value yet</div>
        ) : (
          <>
            <div className="mt-3 h-3 w-full rounded-full overflow-hidden flex bg-muted">
              {stageStats.map((x) => (
                <div
                  key={x.stage.id}
                  style={{
                    background: x.stage.color,
                    width: `${(x.value / totalForBar) * 100}%`,
                  }}
                  title={`${x.stage.name}: ${money(x.value)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {stageStats.map((x) => (
                <div key={x.stage.id} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: x.stage.color }}
                  />
                  <span className="text-muted-foreground">{x.stage.name}</span>
                  <span className="tabular-nums font-medium">{money(x.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function PipelineSkeleton() {
  return (
    <>
      <div className="flex gap-3 overflow-hidden pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-[300px] shrink-0 bg-muted/30 rounded-xl border border-border/60 p-2 space-y-2"
          >
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </>
  )
}

// ----------------------------------------------------------------
// Header
// ----------------------------------------------------------------

function PipelineHeader({
  pipelines,
  selectedId,
  onSelect,
  onAddDeal,
}: {
  pipelines: Pipeline[]
  selectedId: string
  onSelect: (id: string) => void
  onAddDeal: () => void
}) {
  const selected = pipelines.find((p) => p.id === selectedId)
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger size="sm" className="h-9 w-[200px] text-[13px] font-medium">
            <SelectValue placeholder="Select pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected?.description && (
          <span className="text-[12px] text-muted-foreground truncate hidden md:inline">
            {selected.description}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="default" className="h-9" onClick={onAddDeal}>
          <Plus className="size-4" /> New deal
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function PipelineView() {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { data: pipelines = [], isLoading: pipelinesLoading } = usePipelines() as {
    data: Pipeline[]
    isLoading: boolean
  }

  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('')

  // Default to the first pipeline once loaded.
  React.useEffect(() => {
    if (!selectedPipelineId && pipelines.length > 0) {
      // Prefer the default pipeline, else the first.
      const def = pipelines.find((p) => p.isDefault) || pipelines[0]
      setSelectedPipelineId(def.id)
    }
  }, [pipelines, selectedPipelineId])

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId)

  const { data: deals = [], isLoading: dealsLoading } = useDeals(
    selectedPipelineId || undefined
  )

  const isLoading = pipelinesLoading || dealsLoading || !selectedPipeline

  return (
    <div className="p-4 md:p-6 view-enter">
      <PipelineHeader
        pipelines={pipelines}
        selectedId={selectedPipelineId}
        onSelect={setSelectedPipelineId}
        onAddDeal={() => openDrawer('deal-new')}
      />

      {isLoading ? (
        <PipelineSkeleton />
      ) : pipelines.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<KanbanSquare className="size-5" />}
            title="No pipelines yet"
            hint="Pipelines group your deals by stage. Ask a workspace admin to create one in settings."
          />
        </div>
      ) : !selectedPipeline ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<KanbanSquare className="size-5" />}
            title="Select a pipeline"
            hint="Pick a pipeline from the dropdown to view its Kanban board."
          />
        </div>
      ) : selectedPipeline.stages.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<KanbanSquare className="size-5" />}
            title="This pipeline has no stages"
            hint='Use the "Add stage" tile at the end of the board to create your first stage.'
          />
        </div>
      ) : (
        <>
          <KanbanBoard pipeline={selectedPipeline} deals={deals} />
          <ForecastingPanel deals={deals} stages={selectedPipeline.stages} />
        </>
      )}
    </div>
  )
}
