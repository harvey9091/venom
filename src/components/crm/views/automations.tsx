'use client'

/**
 * Pulse CRM — Automations view (no-code builder).
 *
 * Layout: two-pane.
 *   ┌── Left pane (280px) ───┐  ┌── Right pane (fills) ───────────────────┐
 *   │ + New Automation       │  │ Empty state + template cards             │
 *   │ list of automations    │  │      OR                                  │
 *   │  • name + Switch       │  │ Editor: TopBar │ Canvas + Sidebar │ RunLog│
 *   │  • trigger label       │  └──────────────────────────────────────────┘
 *   │  • runs + relTime      │
 *   └────────────────────────┘
 *
 * Editor canvas: pannable + zoomable SVG-based node graph.
 *  - Trigger / Condition / Action node types
 *  - Ports (in/out/out-true/out-false) → click-to-connect edges (bezier)
 *  - Drag nodes by header, undo/redo (Ctrl+Z / Ctrl+Shift+Z), Delete key
 *  - Mini-map + zoom controls + run log
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAutomations, useAutomationMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { relTime, EmptyState } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AppContentContainer } from '@/components/crm/shell/app-content-container'
import { toast } from 'sonner'
import { ThinkingState } from '@/components/crm/thinking'
import { simulateAIThinking } from '@/lib/ai-sim'
import {
  Plus, Pencil, Trash2, ChevronLeft, Save, Play, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize2, Workflow, Zap, Split, Copy, X,
  UserPlus, RefreshCw, Trophy, XCircle, CheckSquare, UserCheck,
  GitBranch, ArrowRightLeft, FileSpreadsheet, Upload, Building2,
  Bell, ListTodo, KanbanSquare, Tag, StickyNote, Activity, Clock,
  Mail, Hourglass, Repeat, Webhook, Filter, Equal, AlignLeft,
  ChevronRight, Circle, Sparkles, PanelBottomOpen, PanelBottomClose,
  Flame, PartyPopper, Clock3,
} from 'lucide-react'
import type {
  Automation, AutomationNode, AutomationEdge, AutomationGraph,
} from '@/lib/types'

// ============================================================
// Constants
// ============================================================

const NODE_W = 220
const NODE_H = 84
const COND_W = 240
const COND_H = 100
const CANVAS_W = 4000
const CANVAS_H = 3000
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2

type NodeType = 'trigger' | 'condition' | 'action'
type PortName = 'in' | 'out' | 'out-true' | 'out-false'

interface IconProps { size?: number; className?: string }
type IconType = React.ComponentType<IconProps>

// ============================================================
// Catalogs
// ============================================================

interface TriggerDef { value: string; label: string; icon: IconType }
const TRIGGERS: TriggerDef[] = [
  { value: 'lead_created', label: 'Lead Created', icon: UserPlus },
  { value: 'lead_updated', label: 'Lead Updated', icon: RefreshCw },
  { value: 'deal_won', label: 'Deal Won', icon: Trophy },
  { value: 'deal_lost', label: 'Deal Lost', icon: XCircle },
  { value: 'task_completed', label: 'Task Completed', icon: CheckSquare },
  { value: 'task_assigned', label: 'Task Assigned', icon: UserCheck },
  { value: 'pipeline_changed', label: 'Pipeline Changed', icon: KanbanSquare },
  { value: 'status_changed', label: 'Status Changed', icon: ArrowRightLeft },
  { value: 'user_joined', label: 'User Joined', icon: UserPlus },
  { value: 'csv_imported', label: 'CSV Imported', icon: FileSpreadsheet },
  { value: 'contact_added', label: 'Contact Added', icon: UserPlus },
  { value: 'file_uploaded', label: 'File Uploaded', icon: Upload },
  { value: 'workspace_created', label: 'Workspace Created', icon: Building2 },
]

interface ActionDef { value: string; label: string; icon: IconType }
const ACTIONS: ActionDef[] = [
  { value: 'assign_user', label: 'Assign User', icon: UserCheck },
  { value: 'send_notification', label: 'Send Notification', icon: Bell },
  { value: 'create_task', label: 'Create Task', icon: ListTodo },
  { value: 'update_status', label: 'Update Status', icon: ArrowRightLeft },
  { value: 'move_pipeline', label: 'Move Pipeline', icon: KanbanSquare },
  { value: 'add_tag', label: 'Add Tag', icon: Tag },
  { value: 'remove_tag', label: 'Remove Tag', icon: Tag },
  { value: 'generate_note', label: 'Generate Note', icon: StickyNote },
  { value: 'create_activity', label: 'Create Activity', icon: Activity },
  { value: 'create_reminder', label: 'Create Reminder', icon: Clock },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'delay', label: 'Delay', icon: Hourglass },
  { value: 'loop', label: 'Loop', icon: Repeat },
  { value: 'branch', label: 'Branch', icon: GitBranch },
]

interface CondDef { value: string; label: string; icon: IconType }
const CONDITIONS: CondDef[] = [
  { value: 'if', label: 'If', icon: GitBranch },
  { value: 'contains', label: 'Contains', icon: Filter },
  { value: 'equals', label: 'Equals', icon: Equal },
  { value: 'starts_with', label: 'Starts With', icon: AlignLeft },
  { value: 'greater_than', label: 'Greater Than', icon: ChevronRight },
  { value: 'less_than', label: 'Less Than', icon: ChevronRight },
  { value: 'empty', label: 'Empty', icon: Circle },
]

function triggerDef(v?: string) { return TRIGGERS.find((t) => t.value === v) }
function actionDef(v?: string) { return ACTIONS.find((a) => a.value === v) }
function condDef(v?: string) { return CONDITIONS.find((c) => c.value === v) }
function triggerLabel(v?: string) { return triggerDef(v)?.label || (v ? v.replace(/_/g, ' ') : 'Trigger') }
function actionLabel(v?: string) { return actionDef(v)?.label || (v ? v.replace(/_/g, ' ') : 'Action') }
function condLabel(v?: string) { return condDef(v)?.label || 'Condition' }

function pickNodeIcon(node: AutomationNode): IconType {
  if (node.type === 'trigger') return triggerDef(node.data.triggerType)?.icon || Workflow
  if (node.type === 'condition') return condDef(node.data.op)?.icon || Split
  return actionDef(node.data.actionType)?.icon || Zap
}

// Returns the rendered icon element directly (avoids the React Compiler
// static-components rule which fires on `const Icon = fn(); <Icon />`).
function renderNodeIcon(node: AutomationNode, size: number, className?: string) {
  return React.createElement(pickNodeIcon(node), { size, className })
}

// ============================================================
// Geometry helpers
// ============================================================

function nodeSize(node: AutomationNode) {
  if (node.type === 'condition') return { w: COND_W, h: COND_H }
  return { w: NODE_W, h: NODE_H }
}

function portPos(node: AutomationNode, port: PortName): { x: number; y: number } {
  const { w, h } = nodeSize(node)
  switch (port) {
    case 'in': return { x: node.position.x, y: node.position.y + h / 2 }
    case 'out': return { x: node.position.x + w, y: node.position.y + h / 2 }
    case 'out-true': return { x: node.position.x + w, y: node.position.y + h * 0.32 }
    case 'out-false': return { x: node.position.x + w, y: node.position.y + h * 0.68 }
  }
}

interface PortInfo { name: PortName; x: number; y: number; kind: 'in' | 'out' }
function portsFor(node: AutomationNode): PortInfo[] {
  if (node.type === 'trigger') {
    return [{ name: 'out', ...portPos(node, 'out'), kind: 'out' }]
  }
  if (node.type === 'condition') {
    return [
      { name: 'in', ...portPos(node, 'in'), kind: 'in' },
      { name: 'out-true', ...portPos(node, 'out-true'), kind: 'out' },
      { name: 'out-false', ...portPos(node, 'out-false'), kind: 'out' },
    ]
  }
  return [{ name: 'in', ...portPos(node, 'in'), kind: 'in' }]
}

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5)
  return `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================
// History hook (undo / redo)
// ============================================================

function useGraphHistory(initial: AutomationGraph) {
  const [graph, setGraph] = React.useState<AutomationGraph>(initial)
  const [past, setPast] = React.useState<AutomationGraph[]>([])
  const [future, setFuture] = React.useState<AutomationGraph[]>([])
  const lastCommitted = React.useRef<AutomationGraph>(initial)

  const live = React.useCallback((next: AutomationGraph) => {
    setGraph(next)
  }, [])

  const commit = React.useCallback((next: AutomationGraph) => {
    if (next === lastCommitted.current) return
    setPast((p) => [...p, lastCommitted.current].slice(-100))
    setFuture([])
    lastCommitted.current = next
    setGraph(next)
  }, [])

  const undo = React.useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prev = p[p.length - 1]
      setFuture((f) => [lastCommitted.current, ...f])
      lastCommitted.current = prev
      setGraph(prev)
      return p.slice(0, -1)
    })
  }, [])

  const redo = React.useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const next = f[0]
      setPast((p) => [...p, lastCommitted.current])
      lastCommitted.current = next
      setGraph(next)
      return f.slice(1)
    })
  }, [])

  const reset = React.useCallback((value: AutomationGraph) => {
    lastCommitted.current = value
    setPast([])
    setFuture([])
    setGraph(value)
  }, [])

  return {
    graph, live, commit, undo, redo, reset,
    canUndo: past.length > 0, canRedo: future.length > 0,
  }
}

// ============================================================
// Templates
// ============================================================

interface Template {
  key: string
  name: string
  desc: string
  icon: IconType
  accent: string
  triggerType: string
  graph: AutomationGraph
}

const TEMPLATES: Template[] = [
  {
    key: 'hot-lead',
    name: 'Hot lead routing',
    desc: 'When a lead with score > 70 is created, assign to a senior rep and ping the team.',
    icon: Flame,
    accent: 'bg-rose-500/10 text-rose-600',
    triggerType: 'lead_created',
    graph: {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'lead_created' }, position: { x: 80, y: 180 } },
        { id: 'c1', type: 'condition', data: { op: 'greater_than', field: 'score', value: 70 }, position: { x: 380, y: 170 } },
        { id: 'a1', type: 'action', data: { actionType: 'assign_user', target: 'senior-rep' }, position: { x: 740, y: 90 } },
        { id: 'a2', type: 'action', data: { actionType: 'send_notification', value: 'Hot lead routed' }, position: { x: 740, y: 240 } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1', label: 'true' },
        { id: 'e3', source: 'c1', target: 'a2', label: 'true' },
      ],
    },
  },
  {
    key: 'welcome',
    name: 'Welcome email',
    desc: 'Send a welcome email whenever a new lead is created in the workspace.',
    icon: Mail,
    accent: 'bg-emerald-500/10 text-emerald-600',
    triggerType: 'lead_created',
    graph: {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'lead_created' }, position: { x: 80, y: 200 } },
        { id: 'a1', type: 'action', data: { actionType: 'email', target: 'welcome' }, position: { x: 420, y: 200 } },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    },
  },
  {
    key: 'stale',
    name: 'Stale lead nudge',
    desc: 'If a lead has no activity for 7+ days, notify the owner to follow up.',
    icon: Clock3,
    accent: 'bg-amber-500/10 text-amber-600',
    triggerType: 'lead_updated',
    graph: {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'lead_updated' }, position: { x: 80, y: 180 } },
        { id: 'c1', type: 'condition', data: { op: 'greater_than', field: 'lastActivityDays', value: 7 }, position: { x: 380, y: 170 } },
        { id: 'a1', type: 'action', data: { actionType: 'send_notification', value: 'Stale lead — follow up' }, position: { x: 740, y: 170 } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', target: 'a1', label: 'true' },
      ],
    },
  },
  {
    key: 'won',
    name: 'Won deal celebration',
    desc: 'When a deal is won, post a celebration activity and notify the team channel.',
    icon: PartyPopper,
    accent: 'bg-violet-500/10 text-violet-600',
    triggerType: 'deal_won',
    graph: {
      nodes: [
        { id: 't1', type: 'trigger', data: { triggerType: 'deal_won' }, position: { x: 80, y: 180 } },
        { id: 'a1', type: 'action', data: { actionType: 'create_activity', value: 'Deal won 🎉' }, position: { x: 420, y: 100 } },
        { id: 'a2', type: 'action', data: { actionType: 'send_notification', value: 'Deal won!' }, position: { x: 420, y: 260 } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
        { id: 'e2', source: 't1', target: 'a2' },
      ],
    },
  },
]

// ============================================================
// Mock run log
// ============================================================

interface RunLogRow {
  id: string
  ts: string
  status: 'success' | 'failed'
  durationMs: number
  detail: string
}

const MOCK_RUNS: RunLogRow[] = [
  { id: 'r1', ts: new Date(Date.now() - 1000 * 60 * 14).toISOString(), status: 'success', durationMs: 234, detail: 'Triggered by lead_created → routed to owner' },
  { id: 'r2', ts: new Date(Date.now() - 1000 * 60 * 90).toISOString(), status: 'success', durationMs: 187, detail: 'Triggered by lead_created → routed to owner' },
  { id: 'r3', ts: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), status: 'failed', durationMs: 89, detail: 'Action send_notification failed: recipient not found' },
  { id: 'r4', ts: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), status: 'success', durationMs: 312, detail: 'Triggered by lead_created → routed to owner' },
  { id: 'r5', ts: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), status: 'success', durationMs: 145, detail: 'Triggered by lead_created → routed to owner' },
]

// ============================================================
// Left pane: automation list
// ============================================================

function AutomationListItem({
  automation,
  active,
  onSelect,
}: {
  automation: Automation
  active: boolean
  onSelect: () => void
}) {
  const { update, remove } = useAutomationMutations()
  const [hover, setHover] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(automation.name)
  React.useEffect(() => setName(automation.name), [automation.name])
  const TriggerIcon = triggerDef(automation.triggerType)?.icon || Workflow

  function commitName() {
    setEditing(false)
    const v = name.trim()
    if (v && v !== automation.name) {
      update.mutate({ id: automation.id, name: v })
    } else {
      setName(automation.name)
    }
  }

  function toggleEnabled(v: boolean) {
    update.mutate({ id: automation.id, enabled: v })
  }

  function onDelete(e: React.MouseEvent) {
    e.stopPropagation()
    remove.mutate(automation.id)
    toast.success('Automation deleted')
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      className={cn(
        'group relative rounded-xl border px-3 py-2.5 cursor-pointer transition-all',
        active
          ? 'border-primary/40 bg-primary/5 shadow-soft'
          : 'border-border/60 bg-card hover:border-border hover:bg-muted/40',
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'shrink-0 size-7 rounded-lg grid place-items-center',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}>
          <TriggerIcon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') { setEditing(false); setName(automation.name) }
              }}
              className="w-full bg-transparent text-[13px] font-semibold outline-none border-b border-primary"
            />
          ) : (
            <div className="text-[13px] font-semibold truncate leading-tight">
              {automation.name}
            </div>
          )}
          <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
            When {triggerLabel(automation.triggerType).toLowerCase()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/80">
            <span className="inline-flex items-center gap-0.5">
              <Play size={9} /> {automation.runsCount || 0} runs
            </span>
            {automation.lastRunAt && (
              <>
                <span>·</span>
                <span>{relTime(automation.lastRunAt)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch
            checked={automation.enabled}
            onCheckedChange={toggleEnabled}
            onClick={(e) => e.stopPropagation()}
            aria-label="Toggle automation"
          />
          {hover && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true) }}
                className="size-5 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Rename"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={onDelete}
                className="size-5 grid place-items-center rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AutomationList({
  automations,
  selectedId,
  onSelect,
  onNew,
}: {
  automations: Automation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={onNew} size="sm" className="w-full justify-center">
        <Plus size={14} /> New Automation
      </Button>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 pt-2">
        All automations · {automations.length}
      </div>
      <div className="flex flex-col gap-1.5 max-h-[calc(100vh-220px)] overflow-y-auto scroll-area pr-1">
        {automations.length === 0 ? (
          <div className="text-[11px] text-muted-foreground px-2 py-4 text-center">
            No automations yet.
          </div>
        ) : (
          automations.map((a) => (
            <AutomationListItem
              key={a.id}
              automation={a}
              active={a.id === selectedId}
              onSelect={() => onSelect(a.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================
// Empty state with templates
// ============================================================

function TemplateCard({ t, onUse }: { t: Template; onUse: () => void }) {
  const Icon = t.icon
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onUse}
      className="text-left card-premium bg-card border border-border/60 rounded-xl p-4 shadow-soft hover:shadow-glow hover:-translate-y-0.5 transition-all w-full"
    >
      <div className="flex items-start gap-3">
        <div className={cn('size-9 rounded-lg grid place-items-center shrink-0', t.accent)}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold tracking-tight">{t.name}</div>
          <div className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{t.desc}</div>
          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            Use template <ChevronRight size={11} />
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function AutomationsEmptyState({ onNew, onUseTemplate }: {
  onNew: () => void
  onUseTemplate: (t: Template) => void
}) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <EmptyState
          icon={<Workflow className="size-5" />}
          title="No automations"
          hint="Automations run automatically when triggers fire — route hot leads, send welcome emails, nudge stale deals, and more. Start from scratch or pick a template below."
          action={
            <Button onClick={onNew}>
              <Plus size={14} /> Create from scratch
            </Button>
          }
        />
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Sparkles size={13} className="text-primary" />
            <span className="text-[12px] font-semibold">Start from a template</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <TemplateCard key={t.key} t={t} onUse={() => onUseTemplate(t)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Edge path
// ============================================================

function EdgePath({
  edge,
  nodes,
  selected,
  onSelect,
}: {
  edge: AutomationEdge
  nodes: AutomationNode[]
  selected: boolean
  onSelect: () => void
}) {
  const src = nodes.find((n) => n.id === edge.source)
  const tgt = nodes.find((n) => n.id === edge.target)
  if (!src || !tgt) return null

  // Choose source port: prefer 'out' for trigger/action, or 'out-true'/'out-false' if condition
  let srcPort: PortName = 'out'
  if (src.type === 'condition') {
    srcPort = edge.label === 'false' ? 'out-false' : 'out-true'
  }
  const tgtPort: PortName = 'in'
  const a = portPos(src, srcPort)
  const b = portPos(tgt, tgtPort)
  const d = bezierPath(a.x, a.y, b.x, b.y)
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2

  return (
    <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect() }}>
      {/* Wider invisible hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path
        d={d}
        fill="none"
        stroke={selected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)'}
        strokeWidth={selected ? 2.5 : 2}
        markerEnd="url(#arrowhead)"
        className="transition-all"
      />
      {edge.label && (
        <g>
          <rect
            x={midX - 22} y={midY - 9}
            width={44} height={18} rx={4}
            fill="hsl(var(--popover))"
            stroke={edge.label === 'false' ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--primary) / 0.4)'}
            strokeWidth={1}
          />
          <text
            x={midX} y={midY + 3}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 10, fontWeight: 600 }}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  )
}

// ============================================================
// Node card
// ============================================================

interface NodeCardProps {
  node: AutomationNode
  selected: boolean
  pendingConnSource: boolean
  onHeaderMouseDown: (e: React.MouseEvent) => void
  onPortClick: (port: PortName, kind: 'in' | 'out') => void
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
}

function NodeCard({
  node, selected, pendingConnSource,
  onHeaderMouseDown, onPortClick, onSelect, onDelete, onDuplicate,
}: NodeCardProps) {
  const { w, h } = nodeSize(node)
  const ports = portsFor(node)
  const [hover, setHover] = React.useState(false)

  const isTrigger = node.type === 'trigger'
  const isCondition = node.type === 'condition'
  const isAction = node.type === 'action'

  const headerBg = isTrigger
    ? 'bg-primary/10 text-primary'
    : isCondition
      ? 'bg-amber-500/10 text-amber-600'
      : 'bg-emerald-500/10 text-emerald-600'
  const borderColor = isTrigger
    ? 'border-primary/40'
    : isCondition
      ? 'border-amber-500/40'
      : 'border-emerald-500/40'

  const titleText = isTrigger
    ? triggerLabel(node.data.triggerType)
    : isCondition
      ? condLabel(node.data.op)
      : actionLabel(node.data.actionType)

  const bodyText = isTrigger
    ? `When ${triggerLabel(node.data.triggerType).toLowerCase()}`
    : isCondition
      ? (node.data.field ? `${node.data.field} ${node.data.op || ''} ${node.data.value ?? ''}` : 'Configure condition')
      : (node.data.target || node.data.value || node.data.tag || actionLabel(node.data.actionType))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => { e.stopPropagation(); onSelect() }}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: w,
        height: h,
        ...(isCondition
          ? { clipPath: 'polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%)' }
          : {}),
      }}
      className={cn(
        'card-premium bg-card shadow-soft border-2 rounded-xl flex flex-col overflow-hidden',
        borderColor,
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {/* Header (drag handle) */}
      <div
        onMouseDown={onHeaderMouseDown}
        className={cn(
          'flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none',
          headerBg,
          isCondition && 'pl-8 pr-8',
        )}
        style={{ height: 36 }}
      >
        {renderNodeIcon(node, 13)}
        <span className="text-[11px] font-semibold tracking-tight uppercase truncate flex-1">
          {titleText}
        </span>
      </div>

      {/* Body */}
      <div className={cn(
        'flex-1 px-3 py-2 flex items-center min-w-0',
        isCondition && 'pl-8 pr-8',
      )}>
        <span className="text-[12px] text-foreground/80 truncate block">
          {bodyText}
        </span>
      </div>

      {/* Hover toolbar */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-border/60 bg-popover shadow-soft p-0.5"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate() }}
              className="size-6 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Duplicate"
            >
              <Copy size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="size-6 grid place-items-center rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
              title="Delete"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ports */}
      {ports.map((p) => (
        <button
          key={p.name}
          onMouseDown={(e) => { e.stopPropagation(); onPortClick(p.name, p.kind) }}
          title={`${p.kind === 'in' ? 'Input' : 'Output'} port`}
          className={cn(
            'absolute size-3 rounded-full border-2 bg-background z-10 transition-all hover:scale-125',
            p.kind === 'in'
              ? 'border-foreground/50 hover:border-primary'
              : 'border-primary hover:border-primary',
            pendingConnSource && p.kind === 'out' && 'animate-pulse ring-2 ring-primary/40',
          )}
          style={{
            left: p.x - node.position.x - 6,
            top: p.y - node.position.y - 6,
          }}
        />
      ))}

      {/* Port labels for condition */}
      {isCondition && (
        <>
          <span className="absolute right-1 top-[22%] text-[8px] font-bold uppercase text-emerald-600 pointer-events-none">T</span>
          <span className="absolute right-1 bottom-[22%] text-[8px] font-bold uppercase text-rose-500 pointer-events-none">F</span>
        </>
      )}
    </motion.div>
  )
}

// ============================================================
// Mini-map
// ============================================================

function MiniMap({
  nodes, viewport, canvasW, canvasH, onJump,
}: {
  nodes: AutomationNode[]
  viewport: { x: number; y: number; zoom: number }
  canvasW: number
  canvasH: number
  onJump: (vx: number, vy: number) => void
}) {
  const W = 160
  const H = 110
  const PAD = 8

  if (nodes.length === 0) {
    return (
      <div
        className="absolute bottom-3 right-3 rounded-lg border border-border/60 bg-popover/80 backdrop-blur shadow-soft p-2 pointer-events-none"
        style={{ width: W, height: H }}
      >
        <div className="text-[9px] text-muted-foreground text-center mt-8">No nodes</div>
      </div>
    )
  }

  // Bounding box of nodes
  const xs = nodes.map((n) => n.position.x)
  const ys = nodes.map((n) => n.position.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs) + NODE_W
  const minY = Math.min(...ys), maxY = Math.max(...ys) + NODE_H
  const bw = Math.max(maxX - minX, 1)
  const bh = Math.max(maxY - minY, 1)

  const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh)
  const offX = PAD + (W - PAD * 2 - bw * scale) / 2 - minX * scale
  const offY = PAD + (H - PAD * 2 - bh * scale) / 2 - minY * scale

  // Viewport rectangle in canvas coords
  const vpX1 = -viewport.x / viewport.zoom
  const vpY1 = -viewport.y / viewport.zoom
  const vpX2 = vpX1 + canvasW / viewport.zoom
  const vpY2 = vpY1 + canvasH / viewport.zoom

  function handleClick(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - rect.left - offX) / scale
    const cy = (e.clientY - rect.top - offY) / scale
    onJump(-cx * viewport.zoom + canvasW / 2, -cy * viewport.zoom + canvasH / 2)
  }

  return (
    <div
      className="absolute bottom-3 right-3 rounded-lg border border-border/60 bg-popover/90 backdrop-blur shadow-soft overflow-hidden cursor-pointer"
      style={{ width: W, height: H }}
      onClick={handleClick}
      title="Click to jump"
    >
      <svg width={W} height={H} className="block">
        {nodes.map((n) => {
          const c = n.type === 'trigger' ? 'hsl(var(--primary))'
            : n.type === 'condition' ? 'hsl(38 92% 50%)'
              : 'hsl(152 76% 40%)'
          return (
            <rect
              key={n.id}
              x={n.position.x * scale + offX}
              y={n.position.y * scale + offY}
              width={Math.max(nodeSize(n).w * scale, 3)}
              height={Math.max(nodeSize(n).h * scale, 2)}
              rx={1}
              fill={c}
              opacity={0.85}
            />
          )
        })}
        <rect
          x={vpX1 * scale + offX}
          y={vpY1 * scale + offY}
          width={(vpX2 - vpX1) * scale}
          height={(vpY2 - vpY1) * scale}
          fill="hsl(var(--primary) / 0.1)"
          stroke="hsl(var(--primary))"
          strokeWidth={1}
        />
      </svg>
    </div>
  )
}

// ============================================================
// Zoom controls
// ============================================================

function ZoomControls({
  zoom, onZoomIn, onZoomOut, onReset,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-border/60 bg-popover/90 backdrop-blur shadow-soft p-1">
      <button
        onClick={onZoomOut}
        className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Zoom out"
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={onReset}
        className="px-2 h-7 grid place-items-center rounded hover:bg-muted text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground transition-colors min-w-[44px]"
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Zoom in"
      >
        <ZoomIn size={14} />
      </button>
      <div className="w-px h-5 bg-border/60 mx-0.5" />
      <button
        onClick={onReset}
        className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Reset view"
      >
        <Maximize2 size={13} />
      </button>
    </div>
  )
}

// ============================================================
// Node palette (right sidebar)
// ============================================================

function PaletteItem({
  icon: Icon, label, onClick, armed,
}: {
  icon: IconType
  label: string
  onClick: () => void
  armed: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] transition-all border',
        armed
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-transparent hover:bg-muted hover:border-border/60 text-foreground',
      )}
    >
      <Icon size={13} />
      <span className="flex-1 text-left truncate">{label}</span>
      {armed && <span className="text-[9px] font-semibold uppercase text-primary">click canvas</span>}
    </button>
  )
}

function NodePalette({
  pendingPalette, onPick,
}: {
  pendingPalette: { kind: NodeType; defValue: string } | null
  onPick: (kind: NodeType, defValue: string) => void
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Workflow size={13} className="text-primary" />
        <span className="text-[12px] font-semibold">Node palette</span>
      </div>
      <Accordion type="multiple" defaultValue={['triggers', 'conditions', 'actions']} className="space-y-2">
        <AccordionItem value="triggers" className="border-b-0 rounded-lg border border-border/60 bg-card/50 overflow-hidden">
          <AccordionTrigger className="px-3 py-2.5 text-[12px] font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Workflow size={12} className="text-primary" /> Triggers
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{TRIGGERS.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1.5 pb-2 space-y-0.5">
            {TRIGGERS.map((t) => (
              <PaletteItem
                key={t.value}
                icon={t.icon}
                label={t.label}
                armed={pendingPalette?.kind === 'trigger' && pendingPalette.defValue === t.value}
                onClick={() => onPick('trigger', t.value)}
              />
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="conditions" className="border-b-0 rounded-lg border border-border/60 bg-card/50 overflow-hidden">
          <AccordionTrigger className="px-3 py-2.5 text-[12px] font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Split size={12} className="text-amber-500" /> Conditions
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{CONDITIONS.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1.5 pb-2 space-y-0.5">
            {CONDITIONS.map((c) => (
              <PaletteItem
                key={c.value}
                icon={c.icon}
                label={c.label}
                armed={pendingPalette?.kind === 'condition' && pendingPalette.defValue === c.value}
                onClick={() => onPick('condition', c.value)}
              />
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="actions" className="border-b-0 rounded-lg border border-border/60 bg-card/50 overflow-hidden">
          <AccordionTrigger className="px-3 py-2.5 text-[12px] font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              <Zap size={12} className="text-emerald-500" /> Actions
              <Badge variant="secondary" className="text-[9px] h-4 px-1">{ACTIONS.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-1.5 pb-2 space-y-0.5 max-h-72 overflow-y-auto scroll-area">
            {ACTIONS.map((a) => (
              <PaletteItem
                key={a.value}
                icon={a.icon}
                label={a.label}
                armed={pendingPalette?.kind === 'action' && pendingPalette.defValue === a.value}
                onClick={() => onPick('action', a.value)}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mt-4 px-2 py-2.5 rounded-md bg-muted/40 text-[10px] text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Tip:</strong> click a palette item, then click on the canvas to drop it. Drag nodes by their header. Click an output port, then an input port to connect.
      </div>
    </div>
  )
}

// ============================================================
// Node inspector (right sidebar)
// ============================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function NodeInspector({
  node, onChange,
}: {
  node: AutomationNode
  onChange: (patch: AutomationNode['data']) => void
}) {
  function set<K extends keyof AutomationNode['data']>(k: K, v: AutomationNode['data'][K]) {
    onChange({ ...node.data, [k]: v })
  }

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <div className={cn(
          'size-7 rounded-lg grid place-items-center',
          node.type === 'trigger' ? 'bg-primary/10 text-primary'
            : node.type === 'condition' ? 'bg-amber-500/10 text-amber-600'
              : 'bg-emerald-500/10 text-emerald-600',
        )}>
          {renderNodeIcon(node, 14)}
        </div>
        <div>
          <div className="text-[13px] font-semibold capitalize">{node.type}</div>
          <div className="text-[10px] text-muted-foreground">id: {node.id}</div>
        </div>
      </div>

      {node.type === 'trigger' && (
        <Field label="Trigger type">
          <Select value={node.data.triggerType} onValueChange={(v) => set('triggerType', v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGERS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {node.type === 'condition' && (
        <>
          <Field label="Operator">
            <Select value={node.data.op} onValueChange={(v) => set('op', v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select operator" /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Field">
            <Input
              value={(node.data.field as string) || ''}
              onChange={(e) => set('field', e.target.value)}
              placeholder="e.g. score, lastActivityDays"
            />
          </Field>
          {node.data.op !== 'empty' && (
            <Field label="Value">
              <Input
                value={String(node.data.value ?? '')}
                onChange={(e) => {
                  const raw = e.target.value
                  const num = Number(raw)
                  set('value', raw !== '' && !Number.isNaN(num) ? num : raw)
                }}
                placeholder="e.g. 70"
              />
            </Field>
          )}
          <div className="text-[10px] text-muted-foreground px-1">
            True branch (top) runs when matched, False branch (bottom) when not.
          </div>
        </>
      )}

      {node.type === 'action' && (
        <>
          <Field label="Action type">
            <Select value={node.data.actionType} onValueChange={(v) => set('actionType', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {node.data.actionType === 'assign_user' && (
            <Field label="Assign to">
              <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round-robin">Round robin</SelectItem>
                  <SelectItem value="owner">Lead owner</SelectItem>
                  <SelectItem value="senior-rep">Senior rep</SelectItem>
                  <SelectItem value="current-user">Current user</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {node.data.actionType === 'send_notification' && (
            <>
              <Field label="Message">
                <Textarea
                  value={String(node.data.value ?? '')}
                  onChange={(e) => set('value', e.target.value)}
                  placeholder="Notification message"
                  rows={3}
                />
              </Field>
              <Field label="Recipients">
                <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Lead owner</SelectItem>
                    <SelectItem value="team">Team channel</SelectItem>
                    <SelectItem value="managers">Managers</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {node.data.actionType === 'create_task' && (
            <>
              <Field label="Task title">
                <Input value={String(node.data.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="Follow up with lead" />
              </Field>
              <Field label="Assignee">
                <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Lead owner</SelectItem>
                    <SelectItem value="current-user">Current user</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Due in (days)">
                <Input
                  type="number"
                  value={String((node.data.dueOffset as number) ?? 1)}
                  onChange={(e) => set('dueOffset', Number(e.target.value) || 0)}
                />
              </Field>
            </>
          )}

          {node.data.actionType === 'add_tag' && (
            <Field label="Tag name">
              <Input value={String(node.data.tag ?? '')} onChange={(e) => set('tag', e.target.value)} placeholder="e.g. priority" />
            </Field>
          )}
          {node.data.actionType === 'remove_tag' && (
            <Field label="Tag name">
              <Input value={String(node.data.tag ?? '')} onChange={(e) => set('tag', e.target.value)} placeholder="e.g. priority" />
            </Field>
          )}

          {node.data.actionType === 'update_status' && (
            <Field label="New status">
              <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {node.data.actionType === 'move_pipeline' && (
            <Field label="Target stage">
              <Input value={String(node.data.target ?? '')} onChange={(e) => set('target', e.target.value)} placeholder="Stage name or id" />
            </Field>
          )}

          {node.data.actionType === 'generate_note' && (
            <Field label="Note body">
              <Textarea value={String(node.data.value ?? '')} onChange={(e) => set('value', e.target.value)} rows={4} placeholder="Note content" />
            </Field>
          )}

          {node.data.actionType === 'create_activity' && (
            <>
              <Field label="Activity type">
                <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Summary">
                <Input value={String(node.data.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="Activity summary" />
              </Field>
            </>
          )}

          {node.data.actionType === 'create_reminder' && (
            <>
              <Field label="Message">
                <Input value={String(node.data.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="Reminder text" />
              </Field>
              <Field label="Remind in (hours)">
                <Input type="number" value={String((node.data.dueOffset as number) ?? 24)} onChange={(e) => set('dueOffset', Number(e.target.value) || 0)} />
              </Field>
            </>
          )}

          {node.data.actionType === 'webhook' && (
            <Field label="URL">
              <Input value={String(node.data.target ?? '')} onChange={(e) => set('target', e.target.value)} placeholder="https://example.com/hook" />
            </Field>
          )}

          {node.data.actionType === 'email' && (
            <>
              <Field label="Template">
                <Select value={(node.data.target as string) || ''} onValueChange={(v) => set('target', v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="nurture">Nurture sequence</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subject">
                <Input value={String(node.data.value ?? '')} onChange={(e) => set('value', e.target.value)} placeholder="Email subject" />
              </Field>
            </>
          )}

          {node.data.actionType === 'delay' && (
            <Field label="Delay (minutes)">
              <Input type="number" value={String((node.data.dueOffset as number) ?? 60)} onChange={(e) => set('dueOffset', Number(e.target.value) || 0)} />
            </Field>
          )}

          {node.data.actionType === 'loop' && (
            <Field label="Iterations">
              <Input type="number" value={String((node.data.dueOffset as number) ?? 3)} onChange={(e) => set('dueOffset', Number(e.target.value) || 0)} />
            </Field>
          )}

          {node.data.actionType === 'branch' && (
            <Field label="Branch key">
              <Input value={String(node.data.target ?? '')} onChange={(e) => set('target', e.target.value)} placeholder="e.g. region" />
            </Field>
          )}
        </>
      )}

      <div className="pt-2 border-t border-border/60">
        <div className="text-[10px] text-muted-foreground">
          Position: ({Math.round(node.position.x)}, {Math.round(node.position.y)})
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Run log
// ============================================================

function RunLog({ runs, open, onToggle }: {
  runs: RunLogRow[]
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn(
      'border-t border-border/60 bg-card transition-all overflow-hidden',
      open ? 'h-56' : 'h-9',
    )}>
      <button
        onClick={onToggle}
        className="w-full h-9 px-4 flex items-center gap-2 hover:bg-muted/40 transition-colors"
      >
        {open ? <PanelBottomClose size={13} /> : <PanelBottomOpen size={13} />}
        <span className="text-[12px] font-semibold">Run log</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{runs.length}</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Last {runs.length} runs
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 max-h-[200px] overflow-y-auto scroll-area">
          {runs.length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center py-6">
              No runs yet. Click “Run now” to test this automation.
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/40">
                  <th className="py-1.5 px-2 font-medium">When</th>
                  <th className="py-1.5 px-2 font-medium">Status</th>
                  <th className="py-1.5 px-2 font-medium">Duration</th>
                  <th className="py-1.5 px-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 last:border-b-0">
                    <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{relTime(r.ts)}</td>
                    <td className="py-1.5 px-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                        r.status === 'success'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-rose-500/15 text-rose-600',
                      )}>
                        <span className={cn(
                          'size-1.5 rounded-full',
                          r.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500',
                        )} />
                        {r.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-muted-foreground whitespace-nowrap">{r.durationMs}ms</td>
                    <td className="py-1.5 px-2 text-foreground/80">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Editor top bar
// ============================================================

function EditorTopBar({
  name, description, enabled, canUndo, canRedo,
  onName, onDescription, onEnabled, onUndo, onRedo, onSave, onRunNow, onBack,
  isSaving, isRunning, saveLabel, runLabel,
}: {
  name: string
  description: string
  enabled: boolean
  canUndo: boolean
  canRedo: boolean
  onName: (v: string) => void
  onDescription: (v: string) => void
  onEnabled: (v: boolean) => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onRunNow: () => void
  onBack: () => void
  isSaving?: boolean
  isRunning?: boolean
  saveLabel?: string
  runLabel?: string
}) {
  return (
    <div className="h-14 shrink-0 border-b border-border/60 bg-card/50 backdrop-blur flex items-center gap-2 px-3">
      <Button variant="ghost" size="icon" onClick={onBack} className="size-8 shrink-0">
        <ChevronLeft size={16} />
      </Button>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Untitled automation"
          className="bg-transparent text-[14px] font-semibold tracking-tight outline-none border-b border-transparent focus:border-primary min-w-0 flex-1 max-w-[280px]"
        />
        <input
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="Add a description…"
          className="bg-transparent text-[12px] text-muted-foreground outline-none border-b border-transparent focus:border-primary min-w-0 flex-1 max-w-[320px] hidden sm:block"
        />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-8" disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </Button>
        <div className="w-px h-5 bg-border/60 mx-1" />
        <label className="flex items-center gap-1.5 px-2 h-8 rounded-md hover:bg-muted/40 transition-colors cursor-pointer">
          <span className="text-[11px] text-muted-foreground">Enabled</span>
          <Switch checked={enabled} onCheckedChange={onEnabled} />
        </label>
        <Button
          variant="outline"
          size="sm"
          className="h-8 min-w-[104px]"
          onClick={onRunNow}
          disabled={isRunning}
        >
          {isRunning ? (
            <ThinkingState
              compact
              size="xs"
              label={runLabel || 'Checking…'}
              variant="trio"
              theme="rainbow"
            />
          ) : (
            <>
              <Play size={13} /> Run now
            </>
          )}
        </Button>
        <Button
          size="sm"
          className="h-8 min-w-[88px]"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ThinkingState
              compact
              size="xs"
              label={saveLabel || 'Saving…'}
              variant="trio"
              theme="primary"
            />
          ) : (
            <>
              <Save size={13} /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Editor (right pane)
// ============================================================

function AutomationEditor({
  automation, onBack,
}: {
  automation: Automation
  onBack: () => void
}) {
  const { update } = useAutomationMutations()
  const [name, setName] = React.useState(automation.name)
  const [description, setDescription] = React.useState(automation.description || '')
  const [enabled, setEnabled] = React.useState(automation.enabled)
  const history = useGraphHistory(automation.graph)
  const [viewport, setViewport] = React.useState({ x: 40, y: 30, zoom: 1 })
  const [selection, setSelection] = React.useState<{ type: 'node' | 'edge'; id: string } | null>(null)
  const [pendingConn, setPendingConn] = React.useState<{ nodeId: string; port: PortName } | null>(null)
  const [pendingCursor, setPendingCursor] = React.useState<{ x: number; y: number } | null>(null)
  const [pendingPalette, setPendingPalette] = React.useState<{ kind: NodeType; defValue: string } | null>(null)
  const [runLogOpen, setRunLogOpen] = React.useState(true)
  const canvasRef = React.useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = React.useState({ w: 800, h: 600 })

  // Thinking-orb state — visual-only indicators on the Save + Run now buttons.
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRunning, setIsRunning] = React.useState(false)
  const [saveLabel, setSaveLabel] = React.useState('Saving…')
  const [runLabel, setRunLabel] = React.useState('Checking…')

  // Track canvas size for the mini-map viewport indicator
  React.useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Refs for use inside window listeners (kept in sync after every render)
  const stateRef = React.useRef({ viewport, graph: history.graph })
  React.useEffect(() => {
    stateRef.current = { viewport, graph: history.graph }
  })

  // Reset state when switching automation
  React.useEffect(() => {
    setName(automation.name)
    setDescription(automation.description || '')
    setEnabled(automation.enabled)
    history.reset(automation.graph)
    setSelection(null)
    setPendingConn(null)
    setPendingPalette(null)
    setViewport({ x: 40, y: 30, zoom: 1 })
  }, [automation.id])

  // ----- Drag state (pan or node) -----
  const dragRef = React.useRef<
    | { kind: 'pan'; startX: number; startY: number; origX: number; origY: number }
    | { kind: 'node'; nodeId: string; offsetX: number; offsetY: number }
    | null
  >(null)

  React.useEffect(() => {
    const drag = dragRef.current
    if (!drag) return
    function onMove(e: MouseEvent) {
      const { viewport: vp, graph } = stateRef.current
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'pan') {
        setViewport((v) => ({
          ...v,
          x: d.origX + (e.clientX - d.startX),
          y: d.origY + (e.clientY - d.startY),
        }))
      } else if (d.kind === 'node' && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left - vp.x) / vp.zoom - d.offsetX
        const y = (e.clientY - rect.top - vp.y) / vp.zoom - d.offsetY
        const clampedX = Math.max(0, Math.min(CANVAS_W - 60, x))
        const clampedY = Math.max(0, Math.min(CANVAS_H - 60, y))
        history.live({
          ...graph,
          nodes: graph.nodes.map((n) =>
            n.id === d.nodeId ? { ...n, position: { x: clampedX, y: clampedY } } : n,
          ),
        })
      }
    }
    function onUp() {
      const d = dragRef.current
      if (d?.kind === 'node') {
        // commit the live-updated graph
        history.commit(stateRef.current.graph)
      }
      dragRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [history])

  // ----- Canvas coordinate helpers -----
  function toCanvasCoords(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    }
  }

  // ----- Handlers -----
  function onCanvasMouseDown(e: React.MouseEvent) {
    // Background click clears selection / pending
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === '1') {
      setSelection(null)
      setPendingConn(null)
      // Start panning
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origX: viewport.x,
        origY: viewport.y,
      }
      document.body.style.cursor = 'grabbing'
    }
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (pendingConn) {
      const p = toCanvasCoords(e.clientX, e.clientY)
      setPendingCursor(p)
    }
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (!pendingPalette) return
    const p = toCanvasCoords(e.clientX, e.clientY)
    const node = makeNode(pendingPalette.kind, pendingPalette.defValue, p)
    history.commit({
      ...history.graph,
      nodes: [...history.graph.nodes, node],
    })
    setPendingPalette(null)
    setSelection({ type: 'node', id: node.id })
    e.stopPropagation()
  }

  function onWheel(e: React.WheelEvent) {
    if (!canvasRef.current) return
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = -e.deltaY * 0.0015
    setViewport((v) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * (1 + delta)))
      const ratio = newZoom / v.zoom
      // zoom toward cursor
      return {
        zoom: newZoom,
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
      }
    })
  }

  function onNodeHeaderMouseDown(node: AutomationNode) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelection({ type: 'node', id: node.id })
      dragRef.current = {
        kind: 'node',
        nodeId: node.id,
        offsetX: (e.clientX - canvasRef.current!.getBoundingClientRect().left - viewport.x) / viewport.zoom - node.position.x,
        offsetY: (e.clientY - canvasRef.current!.getBoundingClientRect().top - viewport.y) / viewport.zoom - node.position.y,
      }
    }
  }

  function onPortClick(node: AutomationNode, port: PortName, kind: 'in' | 'out') {
    return () => {
      if (pendingConn) {
        if (kind === 'in' && pendingConn.nodeId !== node.id) {
          // create edge
          const existing = history.graph.edges.find(
            (ed) => ed.source === pendingConn.nodeId && ed.target === node.id,
          )
          if (!existing) {
            const srcNode = history.graph.nodes.find((n) => n.id === pendingConn.nodeId)
            const label = srcNode?.type === 'condition'
              ? (pendingConn.port === 'out-false' ? 'false' : 'true')
              : undefined
            const newEdge: AutomationEdge = {
              id: uid('e'),
              source: pendingConn.nodeId,
              target: node.id,
              label,
            }
            history.commit({ ...history.graph, edges: [...history.graph.edges, newEdge] })
            toast.success('Edge connected')
          }
        }
        setPendingConn(null)
        setPendingCursor(null)
      } else if (kind === 'out') {
        setPendingConn({ nodeId: node.id, port })
      }
    }
  }

  function deleteNode(id: string) {
    const next = {
      nodes: history.graph.nodes.filter((n) => n.id !== id),
      edges: history.graph.edges.filter((e) => e.source !== id && e.target !== id),
    }
    history.commit(next)
    if (selection?.id === id) setSelection(null)
  }

  function deleteEdge(id: string) {
    history.commit({
      ...history.graph,
      edges: history.graph.edges.filter((e) => e.id !== id),
    })
    if (selection?.id === id) setSelection(null)
  }

  function duplicateNode(id: string) {
    const node = history.graph.nodes.find((n) => n.id === id)
    if (!node) return
    const copy: AutomationNode = {
      ...node,
      id: uid(node.type === 'trigger' ? 't' : node.type === 'condition' ? 'c' : 'a'),
      position: { x: node.position.x + 32, y: node.position.y + 32 },
      data: { ...node.data },
    }
    history.commit({ ...history.graph, nodes: [...history.graph.nodes, copy] })
    setSelection({ type: 'node', id: copy.id })
  }

  function updateNodeData(id: string, patch: AutomationNode['data']) {
    history.commit({
      ...history.graph,
      nodes: history.graph.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    })
  }

  async function handleSave() {
    if (isSaving) return
    setIsSaving(true)
    setSaveLabel('Saving…')
    const startedAt = Date.now()
    try {
      await update.mutateAsync({
        id: automation.id,
        name,
        description,
        enabled,
        triggerType: history.graph.nodes.find((n) => n.type === 'trigger')?.data.triggerType || automation.triggerType,
        graph: history.graph,
      })
      // Hold the orb for at least 600ms total so the affordance reads as
      // intentional rather than a flash.
      const elapsed = Date.now() - startedAt
      if (elapsed < 600) {
        await new Promise((r) => setTimeout(r, 600 - elapsed))
      }
      toast.success('Automation saved')
    } catch {
      toast.error('Could not save automation')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRunNow() {
    if (isRunning) return
    setIsRunning(true)
    setRunLabel('Checking…')
    try {
      await simulateAIThinking('automation', {
        duration: 1000,
        onLabel: (label) => setRunLabel(label),
      })
      toast.success('Test run completed')
    } finally {
      setIsRunning(false)
    }
  }

  function zoomIn() {
    setViewport((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, v.zoom * 1.2) }))
  }
  function zoomOut() {
    setViewport((v) => ({ ...v, zoom: Math.max(MIN_ZOOM, v.zoom / 1.2) }))
  }
  function zoomReset() {
    setViewport({ x: 40, y: 30, zoom: 1 })
  }

  function jumpTo(vx: number, vy: number) {
    setViewport((v) => ({
      ...v,
      x: Math.max(-CANVAS_W, Math.min(CANVAS_W, vx)),
      y: Math.max(-CANVAS_H, Math.min(CANVAS_H, vy)),
    }))
  }

  // ----- Keyboard shortcuts (declared AFTER deleteNode/deleteEdge) -----
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) history.redo()
        else history.undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        history.redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) {
          e.preventDefault()
          if (selection.type === 'node') deleteNode(selection.id)
          else deleteEdge(selection.id)
        }
      } else if (e.key === 'Escape') {
        setPendingConn(null)
        setPendingPalette(null)
        setSelection(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, history.graph])

  const selectedNode = selection?.type === 'node'
    ? history.graph.nodes.find((n) => n.id === selection.id) || null
    : null

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <EditorTopBar
        name={name}
        description={description}
        enabled={enabled}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onName={setName}
        onDescription={setDescription}
        onEnabled={setEnabled}
        onUndo={history.undo}
        onRedo={history.redo}
        onSave={handleSave}
        onRunNow={handleRunNow}
        onBack={onBack}
        isSaving={isSaving}
        isRunning={isRunning}
        saveLabel={saveLabel}
        runLabel={runLabel}
      />

      <div className="flex-1 flex min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative min-w-0 overflow-hidden bg-background">
          {/* Aceternity Dot Background — theme-aware, pans/zooms with viewport */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              backgroundImage:
                'radial-gradient(color-mix(in oklch, var(--muted-foreground) 20%, transparent) 1px, transparent 1px)',
              backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
              // Slightly blur in Glass theme for a frosted feel
              filter: 'var(--dot-blur, none)',
              opacity: 0.7,
            }}
          />
          {/* Radial mask for a faded look at the edges */}
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
            style={{
              background: 'var(--background)',
              WebkitMaskImage:
                'radial-gradient(ellipse at center, transparent 30%, black 90%)',
              maskImage:
                'radial-gradient(ellipse at center, transparent 30%, black 90%)',
            }}
          />
          <div
            ref={canvasRef}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onClick={onCanvasClick}
            onWheel={onWheel}
            className={cn(
              'absolute inset-0 overflow-hidden select-none',
              pendingPalette ? 'cursor-crosshair' : 'cursor-default',
            )}
          >
            {/* Transformed viewport */}
            <div
              data-bg="1"
              className="absolute top-0 left-0"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* SVG edge layer */}
              <svg
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute top-0 left-0 pointer-events-none"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="hsl(var(--muted-foreground) / 0.7)" />
                  </marker>
                </defs>
                {/* Edges */}
                <g className="pointer-events-auto">
                  {history.graph.edges.map((edge) => (
                    <EdgePath
                      key={edge.id}
                      edge={edge}
                      nodes={history.graph.nodes}
                      selected={selection?.type === 'edge' && selection.id === edge.id}
                      onSelect={() => setSelection({ type: 'edge', id: edge.id })}
                    />
                  ))}
                </g>
                {/* Pending connection line */}
                {pendingConn && pendingCursor && (() => {
                  const srcNode = history.graph.nodes.find((n) => n.id === pendingConn.nodeId)
                  if (!srcNode) return null
                  const a = portPos(srcNode, pendingConn.port)
                  const d = bezierPath(a.x, a.y, pendingCursor.x, pendingCursor.y)
                  return (
                    <path
                      d={d}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      className="pointer-events-none"
                    />
                  )
                })()}
              </svg>

              {/* Node layer */}
              {history.graph.nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={selection?.type === 'node' && selection.id === node.id}
                  pendingConnSource={pendingConn?.nodeId === node.id}
                  onHeaderMouseDown={onNodeHeaderMouseDown(node)}
                  onPortClick={(port, kind) => onPortClick(node, port, kind)()}
                  onSelect={() => setSelection({ type: 'node', id: node.id })}
                  onDelete={() => deleteNode(node.id)}
                  onDuplicate={() => duplicateNode(node.id)}
                />
              ))}
            </div>

            {/* Pending palette banner */}
            {pendingPalette && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground shadow-glow text-[12px] font-medium flex items-center gap-2">
                <Zap size={12} />
                Click on the canvas to drop a {pendingPalette.kind} node
                <button
                  onClick={() => setPendingPalette(null)}
                  className="ml-1 hover:bg-primary-foreground/20 rounded size-5 grid place-items-center"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Pending connection banner */}
            {pendingConn && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg bg-popover border border-border/60 shadow-soft text-[12px] font-medium flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                Click an input port to connect (Esc to cancel)
              </div>
            )}

            {/* Zoom controls */}
            <ZoomControls
              zoom={viewport.zoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={zoomReset}
            />

            {/* Mini-map */}
            <MiniMap
              nodes={history.graph.nodes}
              viewport={viewport}
              canvasW={canvasSize.w}
              canvasH={canvasSize.h}
              onJump={jumpTo}
            />
          </div>
        </div>

        {/* Right sidebar: palette / inspector */}
        <aside className="w-[280px] shrink-0 border-l border-border/60 bg-card/40 overflow-y-auto scroll-area hidden lg:block">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              onChange={(patch) => updateNodeData(selectedNode.id, patch)}
            />
          ) : (
            <NodePalette
              pendingPalette={pendingPalette}
              onPick={(kind, defValue) => {
                setPendingPalette({ kind, defValue })
                setPendingConn(null)
              }}
            />
          )}
        </aside>
      </div>

      {/* Bottom run log */}
      <RunLog
        runs={MOCK_RUNS}
        open={runLogOpen}
        onToggle={() => setRunLogOpen((v) => !v)}
      />
    </div>
  )
}

// ============================================================
// Node factory
// ============================================================

function makeNode(kind: NodeType, defValue: string, pos: { x: number; y: number }): AutomationNode {
  const id = uid(kind === 'trigger' ? 't' : kind === 'condition' ? 'c' : 'a')
  const base = {
    id,
    type: kind,
    position: { x: Math.max(0, pos.x - NODE_W / 2), y: Math.max(0, pos.y - NODE_H / 2) },
  }
  if (kind === 'trigger') {
    return { ...base, data: { triggerType: defValue } }
  }
  if (kind === 'condition') {
    return { ...base, data: { op: defValue, field: '', value: '' } }
  }
  return { ...base, data: { actionType: defValue } }
}

// ============================================================
// Loading skeleton
// ============================================================

function AutomationsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-[280px] shrink-0 border-r border-border/60 p-3 space-y-2">
        <Skeleton className="h-8 w-full rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex-1 grid place-items-center">
        <Skeleton className="h-40 w-80 rounded-xl" />
      </div>
    </div>
  )
}

// ============================================================
// Main view
// ============================================================

export function AutomationsView() {
  const { data: automations = [], isLoading } = useAutomations()
  const { create } = useAutomationMutations()
  const workspace = useAppStore((s) => s.workspace)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const selected = automations.find((a) => a.id === selectedId) || null

  function handleNew() {
    if (!workspace?.id) return
    create.mutate({
      workspaceId: workspace.id,
      name: 'Untitled Automation',
      triggerType: 'lead_created',
      graph: {
        nodes: [
          { id: 't1', type: 'trigger', data: { triggerType: 'lead_created' }, position: { x: 80, y: 200 } },
        ],
        edges: [],
      },
    }, {
      onSuccess: (a: Automation) => {
        setSelectedId(a.id)
        toast.success('Automation created')
      },
    })
  }

  function handleUseTemplate(t: Template) {
    if (!workspace?.id) return
    // Deep clone the template graph with fresh ids
    const cloned: AutomationGraph = {
      nodes: t.graph.nodes.map((n) => ({ ...n, id: uid(n.type === 'trigger' ? 't' : n.type === 'condition' ? 'c' : 'a'), data: { ...n.data }, position: { ...n.position } })),
      edges: t.graph.edges.map((e, i) => {
        const srcNode = t.graph.nodes[i] // not used; rebuild below
        void srcNode
        return { ...e, id: uid('e') }
      }),
    }
    // Rebuild edge source/target by index since we changed node ids
    cloned.edges = t.graph.edges.map((e) => {
      const srcIdx = t.graph.nodes.findIndex((n) => n.id === e.source)
      const tgtIdx = t.graph.nodes.findIndex((n) => n.id === e.target)
      return {
        id: uid('e'),
        source: cloned.nodes[srcIdx]?.id || e.source,
        target: cloned.nodes[tgtIdx]?.id || e.target,
        label: e.label,
      }
    })

    create.mutate({
      workspaceId: workspace.id,
      name: t.name,
      description: t.desc,
      triggerType: t.triggerType,
      graph: cloned,
    }, {
      onSuccess: (a: Automation) => {
        setSelectedId(a.id)
        toast.success(`Created from template: ${t.name}`)
      },
    })
  }

  if (isLoading) {
    return (
      <AppContentContainer preset="extrawide" flushVertical flushHorizontal>
        <div className="h-[calc(100vh-3.5rem)]">
          <AutomationsSkeleton />
        </div>
      </AppContentContainer>
    )
  }

  return (
    <AppContentContainer preset="extrawide" flushVertical flushHorizontal>
      <div className="h-[calc(100vh-3.5rem)] flex">
        {/* Left pane */}
        <aside className="w-[280px] shrink-0 border-r border-border/60 bg-card/30 p-3 overflow-y-auto scroll-area">
        <AutomationList
          automations={automations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={handleNew}
        />
      </aside>

      {/* Right pane */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        {selected ? (
          <AutomationEditor automation={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <AutomationsEmptyState onNew={handleNew} onUseTemplate={handleUseTemplate} />
        )}
        </div>
      </div>
    </AppContentContainer>
  )
}
