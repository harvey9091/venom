'use client'

/**
 * Pulse CRM — Settings view
 *
 * Two-pane layout:
 *   ┌─ Left nav (220px) ────────────────────┐  ┌─ Right pane ──────────────┐
 *   │  Workspace                              │  │  SectionHeader              │
 *   │  Members                                │  │  <section content>          │
 *   │  Appearance                             │  │  …                          │
 *   │  Pipelines                              │  │                              │
 *   │  Custom Fields                          │  │                              │
 *   │  Tags                                   │  │                              │
 *   │  Notifications                          │  │                              │
 *   │  Integrations                           │  │                              │
 *   │  API Keys                               │  │                              │
 *   │  Audit Logs                             │  │                              │
 *   │  Exports                                │  │                              │
 *   │  Danger Zone                            │  │                              │
 *   └─────────────────────────────────────────┘  └──────────────────────────────┘
 *
 * Hooks used:
 *   - useSettings(section)         — fetches workspace / members / customFields / apiKeys / audit
 *   - useSettingsMutations()       — post / patch / remove generic actions
 *   - usePipelines + usePipelineMutations
 *   - useTags + useTagMutations
 *   - useThemeStore + THEME_PRESETS
 *   - useAppStore (user, workspace, setWorkspace)
 *
 * All 14 themes are surfaced in the Appearance section as a swatch grid; the
 * theme store is persisted (zustand persist middleware) so the choice sticks
 * across reloads.
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

import { useSettings, useSettingsMutations, usePipelines, usePipelineMutations, useTags, useTagMutations, useLeads, useContacts, useDeals, useActivities } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import {
  useThemeStore,
  THEME_PRESETS,
  type Density,
  type SidebarStyle,
  type CardStyle,
  type AnimSpeed,
  type ThemeConfig,
} from '@/lib/theme'
import { Avatar, EmptyState, relTime } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  Workspace,
  Membership,
  CustomField,
  ApiKey,
  AuditLog,
  Role,
  Pipeline,
  Stage,
  Tag,
} from '@/lib/types'

import {
  Building2,
  Users,
  Palette,
  KanbanSquare,
  ListPlus,
  Tags,
  Bell,
  Plug,
  KeyRound,
  ScrollText,
  Download,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  Save,
  RotateCcw,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  X,
  Upload,
  Lock,
  Sparkles,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Zap,
  Info,
  Eye,
  EyeOff,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react'

// ---------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------

type SectionKey =
  | 'workspace'
  | 'members'
  | 'appearance'
  | 'pipelines'
  | 'customFields'
  | 'tags'
  | 'notifications'
  | 'integrations'
  | 'apiKeys'
  | 'audit'
  | 'exports'
  | 'danger'

interface NavItem {
  key: SectionKey
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  hint?: string
}

const NAV: NavItem[] = [
  { key: 'workspace', label: 'Workspace', icon: Building2 },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'pipelines', label: 'Pipelines', icon: KanbanSquare },
  { key: 'customFields', label: 'Custom Fields', icon: ListPlus },
  { key: 'tags', label: 'Tags', icon: Tags },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'integrations', label: 'Integrations', icon: Plug },
  { key: 'apiKeys', label: 'API Keys', icon: KeyRound },
  { key: 'audit', label: 'Audit Logs', icon: ScrollText },
  { key: 'exports', label: 'Exports', icon: Download },
  { key: 'danger', label: 'Danger Zone', icon: AlertTriangle },
]

const PLAN_BADGE: Record<Workspace['plan'], string> = {
  free: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  pro: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  enterprise: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
}

const ROLE_OPTIONS: Role[] = ['owner', 'admin', 'member', 'viewer']

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'boolean', 'url'] as const
const ENTITY_TYPES = ['lead', 'contact', 'deal', 'company', 'task'] as const

const ACCENT_PRESETS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7',
]

const TAG_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16']

const STAGE_COLORS = ['#64748b', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']

// ---------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.info('No rows to export')
    return
  }
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success(`Exported ${rows.length} rows`)
}

function shortId(id?: string | null) {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

// ---------------------------------------------------------------
// SectionHeader (premium variant for settings)
// ---------------------------------------------------------------

function SettingsHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between mb-5">
      <div className="space-y-1">
        <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-[12.5px] text-muted-foreground max-w-xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function PremiumCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('card-premium bg-card border border-border/60 rounded-xl p-6 shadow-soft', className)}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------
// 1. Workspace section
// ---------------------------------------------------------------

function WorkspaceSection() {
  const workspace = useAppStore((s) => s.workspace)
  const setWorkspace = useAppStore((s) => s.setWorkspace)
  const { post, isPending } = useSettingsMutations()

  const [name, setName] = React.useState(workspace?.name || '')
  const [description, setDescription] = React.useState(workspace?.description || '')
  const [logoUrl, setLogoUrl] = React.useState(workspace?.logoUrl || '')
  const [accentColor, setAccentColor] = React.useState(workspace?.accentColor || '#6366f1')
  const [plan] = React.useState<Workspace['plan']>(workspace?.plan || 'free')

  React.useEffect(() => {
    if (!workspace) return
    setName(workspace.name)
    setDescription(workspace.description || '')
    setLogoUrl(workspace.logoUrl || '')
    setAccentColor(workspace.accentColor || '#6366f1')
  }, [workspace])

  if (!workspace) {
    return <PremiumCard><Skeleton className="h-32 w-full" /></PremiumCard>
  }

  const dirty =
    name !== workspace.name ||
    description !== (workspace.description || '') ||
    logoUrl !== (workspace.logoUrl || '') ||
    accentColor !== (workspace.accentColor || '#6366f1')

  function save() {
    if (!workspace) return
    post.mutate(
      {
        workspaceId: workspace.id,
        action: 'updateWorkspace',
        name,
        description: description || null,
        logoUrl: logoUrl || null,
        accentColor,
      },
      {
        onSuccess: (updated: Workspace) => {
          setWorkspace(updated)
          toast.success('Workspace updated')
        },
        onError: () => toast.error('Failed to update workspace'),
      },
    )
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Workspace"
        description="Manage your workspace identity, branding, and plan."
      />

      <PremiumCard>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-items-center font-bold text-lg shadow-soft">
              {name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div className="text-[14px] font-semibold">{workspace.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{workspace.slug}</div>
            </div>
          </div>
          <Badge className={cn('uppercase tracking-wide', PLAN_BADGE[plan])}>{plan} plan</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Venom CRM" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ws-slug">Slug</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center justify-center size-3.5 rounded-full bg-muted text-muted-foreground cursor-help">
                    <Info size={10} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Custom domains coming soon</TooltipContent>
              </Tooltip>
            </div>
            <Input id="ws-slug" value={workspace.slug} readOnly disabled className="bg-muted/40 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">Custom domains coming soon.</p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea id="ws-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this workspace about?" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="ws-logo">Logo URL</Label>
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-lg border border-border/60 bg-muted/40 overflow-hidden grid place-items-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
                ) : (
                  <Building2 size={18} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input id="ws-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'A')}`
                    setLogoUrl(url)
                    toast.success('Logo URL set')
                  }}
                >
                  <Upload size={14} /> Set demo URL
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                    accentColor.toLowerCase() === c.toLowerCase() ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ background: c }}
                  aria-label={`Accent ${c}`}
                />
              ))}
              <label className="inline-flex items-center gap-2 ml-2 px-2 h-7 rounded-md border border-border/60 cursor-pointer">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                  aria-label="Custom accent color"
                />
                <span className="text-[11.5px] tabular-nums font-mono">{accentColor}</span>
              </label>
            </div>
          </div>
        </div>

        <Separator className="my-5" />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => {
            setName(workspace.name)
            setDescription(workspace.description || '')
            setLogoUrl(workspace.logoUrl || '')
            setAccentColor(workspace.accentColor || '#6366f1')
          }} disabled={!dirty || isPending}>
            Reset
          </Button>
          <Button onClick={save} disabled={!dirty || isPending}>
            <Save size={14} /> Save changes
          </Button>
        </div>
      </PremiumCard>
    </div>
  )
}

// ---------------------------------------------------------------
// 2. Members section
// ---------------------------------------------------------------

function MembersSection() {
  const workspace = useAppStore((s) => s.workspace)
  const { data: members = [], isLoading } = useSettings('members') as { data: Membership[]; isLoading: boolean }
  const { post, patch, remove } = useSettingsMutations()
  const [inviteOpen, setInviteOpen] = React.useState(false)

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Members"
        description="Invite teammates, manage roles, and remove access."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus size={14} /> Invite member
          </Button>
        }
      />

      <PremiumCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState icon={<Users size={18} />} title="No members yet" hint="Invite teammates to join your workspace." />
        ) : (
          <div className="divide-y divide-border/60">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                onRoleChange={(role) =>
                  patch.mutate(
                    { action: 'updateMember', id: m.id, role },
                    { onSuccess: () => toast.success(`${m.user?.name || 'Member'} is now ${role}`) },
                  )
                }
                onRemove={() =>
                  remove.mutate(
                    { action: 'removeMember', id: m.id },
                    { onSuccess: () => toast.success('Member removed') },
                  )
                }
                canRemove={m.role !== 'owner'}
              />
            ))}
          </div>
        )}
      </PremiumCard>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={(payload) => {
          if (!workspace) return
          post.mutate(
            { workspaceId: workspace.id, action: 'inviteMember', ...payload },
            {
              onSuccess: () => {
                toast.success(`Invitation sent to ${payload.email}`)
                setInviteOpen(false)
              },
            },
          )
        }}
        isPending={post.isPending}
      />
    </div>
  )
}

function MemberRow({
  member,
  onRoleChange,
  onRemove,
  canRemove,
}: {
  member: Membership
  onRoleChange: (role: Role) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const user = member.user
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group">
      <Avatar name={user?.name || 'Unknown'} url={user?.avatarUrl} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{user?.name || 'Unknown'}</div>
        <div className="text-[11.5px] text-muted-foreground truncate">{user?.email}</div>
      </div>
      <div className="hidden md:block text-[11.5px] text-muted-foreground">
        Joined {relTime(member.joinedAt || (member as any).createdAt || new Date().toISOString())}
      </div>
      <Select value={member.role} onValueChange={(v) => onRoleChange(v as Role)}>
        <SelectTrigger size="sm" className="w-[110px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r} value={r} className="capitalize" disabled={r === 'owner' && member.role !== 'owner'}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              disabled={!canRemove}
            >
              <Trash2 size={14} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{canRemove ? 'Remove member' : 'Cannot remove owner'}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function InviteMemberDialog({
  open,
  onOpenChange,
  onInvite,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onInvite: (payload: { email: string; name: string; role: Role }) => void
  isPending: boolean
}) {
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<Role>('member')

  React.useEffect(() => {
    if (!open) {
      setEmail('')
      setName('')
      setRole('member')
    }
  }, [open])

  function submit() {
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Enter a valid email')
      return
    }
    onInvite({ email: email.trim(), name: name.trim() || email.split('@')[0], role })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>Send an invitation to join this workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@venom.com" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Name (optional)</Label>
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter((r) => r !== 'owner').map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isPending}>
            <Mail size={14} /> Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------
// 3. Appearance section (THEME ENGINE)
// ---------------------------------------------------------------

function AppearanceSection() {
  const theme = useThemeStore()

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Appearance"
        description="Pick a theme and tune every aspect of the UI — accent, density, typography, glass intensity, and more."
        actions={
          <Button variant="outline" onClick={() => { theme.reset(); toast.success('Theme reset to defaults') }}>
            <RotateCcw size={14} /> Reset
          </Button>
        }
      />

      {/* Theme gallery */}
      <PremiumCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13.5px] font-semibold">Theme</div>
            <div className="text-[11.5px] text-muted-foreground">14 handcrafted presets.</div>
          </div>
          <Badge variant="secondary" className="capitalize">{theme.config.theme}</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {THEME_PRESETS.map((p) => {
            const selected = theme.config.theme === p.id
            return (
              <button
                key={p.id}
                onClick={() => theme.setTheme(p.id)}
                className={cn(
                  'group relative flex flex-col gap-2 p-3 rounded-lg border transition-all text-left hover:-translate-y-0.5',
                  selected ? 'ring-2 ring-primary border-primary/30 shadow-soft' : 'border-border/60 hover:border-border',
                )}
                style={{ background: p.swatch[0] }}
              >
                <div className="flex items-center gap-1.5">
                  {p.swatch.map((c) => (
                    <span key={c} className="w-5 h-5 rounded-full border border-black/10 shadow-sm" style={{ background: c }} />
                  ))}
                  {p.dark && (
                    <span className="ml-auto text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-black/30 text-white/80">dark</span>
                  )}
                </div>
                <div
                  className="text-[12px] font-medium leading-tight"
                  style={{ color: p.dark ? '#fff' : '#111' }}
                >
                  {p.name}
                </div>
                {selected && (
                  <span className="absolute top-2 right-2 inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </PremiumCard>

      {/* Customization panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PremiumCard>
          <div className="text-[13.5px] font-semibold mb-4">Colors & radius</div>

          <div className="space-y-5">
            {/* Accent color */}
            <div className="space-y-1.5">
              <Label>Accent color</Label>
              <div className="flex items-center gap-2">
                <label className="relative w-9 h-9 rounded-md overflow-hidden border border-border/60 cursor-pointer">
                  <input
                    type="color"
                    value={theme.config.accent}
                    onChange={(e) => theme.setAccent(e.target.value)}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                    aria-label="Pick accent color"
                  />
                  <span className="block w-full h-full" style={{ background: theme.config.accent }} />
                </label>
                <Input
                  value={theme.config.accent}
                  onChange={(e) => theme.setAccent(e.target.value)}
                  className="flex-1 font-mono text-[12.5px]"
                  placeholder="#6366f1"
                />
                <div className="flex items-center gap-1">
                  {ACCENT_PRESETS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => theme.setAccent(c)}
                      className="w-5 h-5 rounded-full border border-black/10 hover:scale-110 transition-transform"
                      style={{ background: c }}
                      aria-label={`Accent ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Radius */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Border radius</Label>
                <span className="text-[11.5px] tabular-nums text-muted-foreground font-mono">{theme.config.radius}px</span>
              </div>
              <Slider
                value={[theme.config.radius]}
                onValueChange={(v) => theme.setRadius(v[0])}
                min={0}
                max={24}
                step={1}
              />
            </div>

            {/* Glass intensity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Glass intensity</Label>
                <span className="text-[11.5px] tabular-nums text-muted-foreground font-mono">{theme.config.glassIntensity}</span>
              </div>
              <Slider
                value={[theme.config.glassIntensity]}
                onValueChange={(v) => theme.setGlassIntensity(v[0])}
                min={0}
                max={100}
                step={1}
              />
              <p className="text-[11px] text-muted-foreground">Affects backdrop-blur amount on glass surfaces.</p>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="text-[13.5px] font-semibold mb-4">Layout & typography</div>

          <div className="space-y-5">
            {/* Density */}
            <div className="space-y-1.5">
              <Label>Density</Label>
              <SegmentedControl
                value={theme.config.density}
                onValueChange={(v) => theme.setDensity(v as Density)}
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'comfortable', label: 'Comfortable' },
                  { value: 'spacious', label: 'Spacious' },
                ]}
              />
            </div>

            {/* Sidebar style */}
            <div className="space-y-1.5">
              <Label>Sidebar style</Label>
              <SegmentedControl
                value={theme.config.sidebarStyle}
                onValueChange={(v) => theme.setSidebarStyle(v as SidebarStyle)}
                options={[
                  { value: 'floating', label: 'Floating' },
                  { value: 'inset', label: 'Inset' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>

            {/* Card style */}
            <div className="space-y-1.5">
              <Label>Card style</Label>
              <SegmentedControl
                value={theme.config.cardStyle}
                onValueChange={(v) => theme.setCardStyle(v as CardStyle)}
                options={[
                  { value: 'outlined', label: 'Outlined' },
                  { value: 'elevated', label: 'Elevated' },
                  { value: 'filled', label: 'Filled' },
                ]}
              />
            </div>

            {/* Animation speed */}
            <div className="space-y-1.5">
              <Label>Animation speed</Label>
              <SegmentedControl
                value={theme.config.animSpeed}
                onValueChange={(v) => theme.setAnimSpeed(v as AnimSpeed)}
                options={[
                  { value: 'instant', label: 'Instant' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'slow', label: 'Slow' },
                ]}
              />
            </div>

            {/* Font */}
            <div className="space-y-1.5">
              <Label>Font</Label>
              <Select value={theme.config.font} onValueChange={(v) => theme.setFont(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geist">Geist Sans</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="mono">Mono</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Live preview */}
      <PremiumCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[13.5px] font-semibold">Live preview</div>
            <div className="text-[11.5px] text-muted-foreground">Reflects every theme setting in real-time.</div>
          </div>
          <Sparkles size={16} className="text-primary" />
        </div>
        <ThemePreview cfg={theme.config} />
      </PremiumCard>
    </div>
  )
}

function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
}: {
  value: T
  onValueChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      variant="outline"
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="flex-1 text-[12px]">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function ThemePreview({ cfg }: { cfg: ThemeConfig }) {
  return (
    <div
      className="rounded-lg border border-border/60 p-4 space-y-3"
      style={{ borderRadius: cfg.radius }}
    >
      {/* Sample card */}
      <div
        className="card-premium bg-card border border-border/60 p-4 shadow-soft"
        style={{ borderRadius: cfg.radius }}
        data-card-style={cfg.cardStyle}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold">Venom Corp — Q3 deal</div>
            <div className="text-[11.5px] text-muted-foreground">Expected close · Aug 22</div>
          </div>
          <Badge>$48,000</Badge>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" style={{ borderRadius: cfg.radius }}>
            <Zap size={12} /> Action
          </Button>
          <Button size="sm" variant="outline" style={{ borderRadius: cfg.radius }}>
            Secondary
          </Button>
        </div>
      </div>

      {/* Sample table row */}
      <div
        className="rounded-md border border-border/60 overflow-hidden"
        style={{ borderRadius: Math.max(0, cfg.radius - 4) }}
      >
        <div className="grid grid-cols-3 px-3 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground">
          <span>Name</span>
          <span>Status</span>
          <span>Owner</span>
        </div>
        {[
          { n: 'Jordan Lee', s: 'qualified', o: 'Ada' },
          { n: 'Riya Patel', s: 'contacted', o: 'Noah' },
        ].map((r) => (
          <div key={r.n} className="grid grid-cols-3 px-3 py-2 text-[12px] border-t border-border/60 hover:bg-muted/30">
            <span className="font-medium">{r.n}</span>
            <span className="capitalize text-muted-foreground">{r.s}</span>
            <span className="text-muted-foreground">{r.o}</span>
          </div>
        ))}
      </div>

      {/* Density indicator */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted">density: {cfg.density}</span>
        <span className="px-1.5 py-0.5 rounded bg-muted">radius: {cfg.radius}px</span>
        <span className="px-1.5 py-0.5 rounded bg-muted">glass: {cfg.glassIntensity}</span>
        <span className="px-1.5 py-0.5 rounded bg-muted">anim: {cfg.animSpeed}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// 4. Pipelines section
// ---------------------------------------------------------------

function PipelinesSection() {
  const { data: pipelines = [], isLoading } = usePipelines() as { data: Pipeline[]; isLoading: boolean }
  const { create, update, remove } = usePipelineMutations()
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Pipelines"
        description="Manage sales pipelines and their stages."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Create pipeline
          </Button>
        }
      />

      {isLoading ? (
        <PremiumCard><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div></PremiumCard>
      ) : pipelines.length === 0 ? (
        <PremiumCard><EmptyState icon={<KanbanSquare size={18} />} title="No pipelines" hint="Create your first pipeline to start tracking deals." /></PremiumCard>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <PipelineRow
              key={p.id}
              pipeline={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onSave={(name, stages) => {
                update.mutate(
                  { id: p.id, name, stages },
                  {
                    onSuccess: () => {
                      toast.success('Pipeline updated')
                      setEditingId(null)
                    },
                  },
                )
              }}
              onDelete={() =>
                remove.mutate(p.id, { onSuccess: () => toast.success('Pipeline deleted') })
              }
              isPending={update.isPending}
            />
          ))}
        </div>
      )}

      <CreatePipelineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(payload) =>
          create.mutate(payload, {
            onSuccess: () => {
              toast.success('Pipeline created')
              setCreateOpen(false)
            },
          })
        }
        isPending={create.isPending}
      />
    </div>
  )
}

function PipelineRow({
  pipeline,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  isPending,
}: {
  pipeline: Pipeline
  isEditing: boolean
  onEdit: () => void
  onSave: (name: string, stages: Partial<Stage>[]) => void
  onDelete: () => void
  isPending: boolean
}) {
  const [name, setName] = React.useState(pipeline.name)
  const [stages, setStages] = React.useState<Partial<Stage>[]>(
    pipeline.stages?.length
      ? pipeline.stages.map((s) => ({ id: s.id, name: s.name, color: s.color, probability: s.probability, isWon: s.isWon, isLost: s.isLost }))
      : [{ name: 'New', color: STAGE_COLORS[0], probability: 20, isWon: false, isLost: false }],
  )

  React.useEffect(() => {
    if (isEditing) {
      setName(pipeline.name)
      setStages(
        pipeline.stages?.length
          ? pipeline.stages.map((s) => ({ id: s.id, name: s.name, color: s.color, probability: s.probability, isWon: s.isWon, isLost: s.isLost }))
          : [],
      )
    }
  }, [isEditing, pipeline])

  function moveStage(idx: number, dir: -1 | 1) {
    const next = [...stages]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setStages(next)
  }

  function addStage() {
    setStages([...stages, { name: `Stage ${stages.length + 1}`, color: STAGE_COLORS[stages.length % STAGE_COLORS.length], probability: 20, isWon: false, isLost: false }])
  }

  function removeStage(idx: number) {
    setStages(stages.filter((_, i) => i !== idx))
  }

  function updateStage(idx: number, patch: Partial<Stage>) {
    setStages(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  return (
    <PremiumCard>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold truncate">{pipeline.name}</div>
            {pipeline.isDefault && <Badge variant="secondary" className="text-[10px]">default</Badge>}
          </div>
          <div className="text-[11.5px] text-muted-foreground mt-0.5">
            {pipeline.stages?.length || 0} stages · {(pipeline as any).deals?.length || 0} deals
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil size={13} /> {isEditing ? 'Close' : 'Edit stages'}
        </Button>
        {!pipeline.isDefault && (
          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      {isEditing && (
        <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
          <div className="space-y-1.5">
            <Label>Pipeline name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Stages</Label>
              <Button size="sm" variant="ghost" onClick={addStage}>
                <Plus size={12} /> Add stage
              </Button>
            </div>
            <div className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border/60 bg-muted/20">
                  <div className="flex flex-col">
                    <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveStage(i, 1)} disabled={i === stages.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <label className="relative w-7 h-7 rounded-md overflow-hidden border border-border/60 cursor-pointer shrink-0">
                    <input
                      type="color"
                      value={s.color || '#64748b'}
                      onChange={(e) => updateStage(i, { color: e.target.value })}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      aria-label="Stage color"
                    />
                    <span className="block w-full h-full" style={{ background: s.color || '#64748b' }} />
                  </label>
                  <Input
                    value={s.name || ''}
                    onChange={(e) => updateStage(i, { name: e.target.value })}
                    className="flex-1 h-8"
                    placeholder="Stage name"
                  />
                  <div className="flex items-center gap-1 w-[90px]">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={s.probability ?? 0}
                      onChange={(e) => updateStage(i, { probability: Number(e.target.value) })}
                      className="h-8 text-[12px] tabular-nums"
                    />
                    <span className="text-[11px] text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <label className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <Checkbox checked={!!s.isWon} onCheckedChange={(v) => updateStage(i, { isWon: !!v, isLost: false })} />
                      won
                    </label>
                    <label className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <Checkbox checked={!!s.isLost} onCheckedChange={(v) => updateStage(i, { isLost: !!v, isWon: false })} />
                      lost
                    </label>
                  </div>
                  <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => removeStage(i)}>
                    <X size={12} />
                  </Button>
                </div>
              ))}
              {stages.length === 0 && (
                <div className="text-[12px] text-muted-foreground text-center py-4">No stages yet. Click "Add stage".</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onEdit}>Cancel</Button>
            <Button disabled={isPending || !name.trim() || stages.length === 0} onClick={() => onSave(name, stages)}>
              <Save size={14} /> Save pipeline
            </Button>
          </div>
        </div>
      )}
    </PremiumCard>
  )
}

function CreatePipelineDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (payload: { name: string; description?: string; stages: Partial<Stage>[] }) => void
  isPending: boolean
}) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
    }
  }, [open])

  function submit() {
    if (!name.trim()) {
      toast.error('Enter a pipeline name')
      return
    }
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      stages: [
        { name: 'New', color: STAGE_COLORS[0], probability: 10, isWon: false, isLost: false },
        { name: 'Qualified', color: STAGE_COLORS[1], probability: 30, isWon: false, isLost: false },
        { name: 'Won', color: STAGE_COLORS[3], probability: 100, isWon: true, isLost: false },
        { name: 'Lost', color: STAGE_COLORS[4], probability: 0, isWon: false, isLost: true },
      ],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create pipeline</DialogTitle>
          <DialogDescription>Pre-seeded with 4 default stages (New, Qualified, Won, Lost). You can edit them after creation.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pl-name">Name</Label>
            <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales pipeline" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-desc">Description (optional)</Label>
            <Textarea id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isPending}>
            <Plus size={14} /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------
// 5. Custom Fields section
// ---------------------------------------------------------------

function CustomFieldsSection() {
  const { data: fields = [], isLoading } = useSettings('customFields') as { data: CustomField[]; isLoading: boolean }
  const { post, remove } = useSettingsMutations()
  const workspace = useAppStore((s) => s.workspace)
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Custom Fields"
        description="Add typed fields to leads, contacts, deals, companies, or tasks."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add field
          </Button>
        }
      />

      <PremiumCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
        ) : fields.length === 0 ? (
          <EmptyState icon={<ListPlus size={18} />} title="No custom fields" hint="Create typed fields like 'Industry', 'Budget', or 'Renewal Date'." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="font-medium text-[12.5px]">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{f.key}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">{f.entityType}</Badge>
                  </TableCell>
                  <TableCell className="capitalize text-[12px]">{f.type}</TableCell>
                  <TableCell>
                    {f.required ? (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-300">required</Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">optional</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate({ action: 'deleteCustomField', id: f.id }, { onSuccess: () => toast.success('Field deleted') })}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PremiumCard>

      <CreateFieldDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(payload) => {
          if (!workspace) return
          post.mutate(
            { workspaceId: workspace.id, action: 'createCustomField', ...payload },
            {
              onSuccess: () => {
                toast.success('Field created')
                setCreateOpen(false)
              },
            },
          )
        }}
        isPending={post.isPending}
      />
    </div>
  )
}

function CreateFieldDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (payload: { name: string; key: string; entityType: string; type: string; options?: string[]; required: boolean }) => void
  isPending: boolean
}) {
  const [name, setName] = React.useState('')
  const [key, setKey] = React.useState('')
  const [entityType, setEntityType] = React.useState<string>('lead')
  const [type, setType] = React.useState<string>('text')
  const [optionsText, setOptionsText] = React.useState('')
  const [required, setRequired] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setName('')
      setKey('')
      setEntityType('lead')
      setType('text')
      setOptionsText('')
      setRequired(false)
    }
  }, [open])

  React.useEffect(() => {
    setKey(slugify(name))
  }, [name])

  const showOptions = type === 'select' || type === 'multiselect'

  function submit() {
    if (!name.trim()) {
      toast.error('Enter a field name')
      return
    }
    const payload: any = {
      name: name.trim(),
      key: (key.trim() || slugify(name)),
      entityType,
      type,
      required,
    }
    if (showOptions && optionsText.trim()) {
      payload.options = optionsText.split(',').map((s) => s.trim()).filter(Boolean)
    }
    onCreate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add custom field</DialogTitle>
          <DialogDescription>Define a typed field available on the chosen entity.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name">Name</Label>
              <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Renewal Date" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-key">Key</Label>
              <Input id="cf-key" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-[12px]" placeholder="renewal_date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Entity</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-full capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showOptions && (
            <div className="space-y-1.5">
              <Label htmlFor="cf-options">Options (comma-separated)</Label>
              <Input id="cf-options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Low, Medium, High" />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(!!v)} />
            <span className="text-[12.5px]">Required field</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isPending}>
            <Plus size={14} /> Create field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------
// 6. Tags section
// ---------------------------------------------------------------

function TagsSection() {
  const { data: tags = [], isLoading } = useTags()
  const { create, remove } = useTagMutations()
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState(TAG_COLORS[0])

  function submit() {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          toast.success('Tag created')
          setName('')
          setColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)])
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Tags"
        description="Reusable labels for leads, contacts, deals, and companies."
      />

      <PremiumCard>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder="Tag name…"
            className="flex-1 min-w-[180px] h-9"
          />
          <label className="inline-flex items-center gap-2 px-2 h-9 rounded-md border border-border/60 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
              aria-label="Tag color"
            />
            <span className="text-[11px] font-mono">{color}</span>
          </label>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            <Plus size={14} /> Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-full" />)
          ) : tags.length === 0 ? (
            <div className="text-[12.5px] text-muted-foreground py-6 w-full text-center">No tags yet. Create one above.</div>
          ) : (
            tags.map((t) => (
              <TagChipEditable
                key={t.id}
                tag={t}
                onRemove={() => remove.mutate(t.id, { onSuccess: () => toast.success('Tag deleted') })}
              />
            ))
          )}
        </div>
      </PremiumCard>
    </div>
  )
}

function TagChipEditable({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <span
      className="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-[11.5px] font-medium"
      style={{ background: `${tag.color}22`, color: tag.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color }} />
      {tag.name}
      <button
        onClick={onRemove}
        className="ml-0.5 inline-flex items-center justify-center size-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label={`Delete tag ${tag.name}`}
      >
        <X size={10} />
      </button>
    </span>
  )
}

// ---------------------------------------------------------------
// 7. Notifications section (UI only)
// ---------------------------------------------------------------

const NOTIF_EVENTS = [
  { key: 'mention', label: 'Mentions', icon: MessageSquare, desc: 'When someone @mentions you' },
  { key: 'assignment', label: 'Assignments', icon: Users, desc: 'When a record is assigned to you' },
  { key: 'automation', label: 'Automation runs', icon: Zap, desc: 'When an automation you own fires' },
  { key: 'system', label: 'System', icon: Info, desc: 'Workspace-level announcements' },
] as const

const NOTIF_CHANNELS = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'inApp', label: 'In-app', icon: Bell },
  { key: 'mobile', label: 'Mobile push', icon: Smartphone },
] as const

function NotificationsSection() {
  // Local state only (no real backend per spec)
  const [matrix, setMatrix] = React.useState<Record<string, Record<string, boolean>>>(() => {
    const init: Record<string, Record<string, boolean>> = {}
    for (const e of NOTIF_EVENTS) {
      init[e.key] = { email: e.key !== 'system', inApp: true, mobile: e.key === 'mention' || e.key === 'assignment' }
    }
    return init
  })
  const [digest, setDigest] = React.useState(true)
  const [digestTime, setDigestTime] = React.useState('09:00')

  function toggle(event: string, channel: string, value: boolean) {
    setMatrix((m) => ({ ...m, [event]: { ...m[event], [channel]: value } }))
    toast.success(`${event} → ${channel}: ${value ? 'on' : 'off'}`)
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Notifications"
        description="Choose how you want to be notified for each event type."
      />

      <PremiumCard className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              {NOTIF_CHANNELS.map((c) => {
                const Icon = c.icon
                return (
                  <TableHead key={c.key} className="text-center">
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <Icon size={12} /> <span className="text-[11.5px]">{c.label}</span>
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {NOTIF_EVENTS.map((e) => {
              const Icon = e.icon
              return (
                <TableRow key={e.key}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-muted grid place-items-center text-muted-foreground">
                        <Icon size={13} />
                      </div>
                      <div>
                        <div className="text-[12.5px] font-medium">{e.label}</div>
                        <div className="text-[11px] text-muted-foreground">{e.desc}</div>
                      </div>
                    </div>
                  </TableCell>
                  {NOTIF_CHANNELS.map((c) => (
                    <TableCell key={c.key} className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={matrix[e.key]?.[c.key] ?? false}
                          onCheckedChange={(v) => toggle(e.key, c.key, v)}
                          aria-label={`${e.label} ${c.label}`}
                        />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </PremiumCard>

      <PremiumCard>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 text-primary grid place-items-center">
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[13px] font-semibold">Daily digest</div>
              <div className="text-[11.5px] text-muted-foreground">One summary email per day instead of per-event pings.</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="time"
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              className="w-[110px] h-9"
              disabled={!digest}
            />
            <Switch checked={digest} onCheckedChange={(v) => { setDigest(v); toast.success(`Daily digest ${v ? 'enabled' : 'disabled'}`) }} />
          </div>
        </div>
      </PremiumCard>
    </div>
  )
}

// ---------------------------------------------------------------
// 8. Integrations section (mock)
// ---------------------------------------------------------------

const INTEGRATIONS = [
  { id: 'slack', name: 'Slack', emoji: '💬', desc: 'Send deal alerts and mention notifications to Slack channels.' },
  { id: 'gmail', name: 'Gmail', emoji: '📧', desc: 'Sync emails with leads and contacts automatically.' },
  { id: 'outlook', name: 'Outlook', emoji: ' Outlook', desc: 'Two-way calendar + email sync for Microsoft accounts.' },
  { id: 'zoom', name: 'Zoom', emoji: '🎥', desc: 'Schedule and attach Zoom meetings to deals.' },
  { id: 'stripe', name: 'Stripe', emoji: '💳', desc: 'Pull subscription and revenue data into deal records.' },
  { id: 'hubspot', name: 'HubSpot', emoji: '🟠', desc: 'Migrate contacts and companies from HubSpot.' },
  { id: 'intercom', name: 'Intercom', emoji: '💬', desc: 'Push conversation history to lead records.' },
  { id: 'twilio', name: 'Twilio', emoji: '📱', desc: 'Send and receive SMS from the contacts view.' },
  { id: 'openai', name: 'OpenAI', emoji: '✨', desc: 'AI-assisted email drafting and lead scoring.' },
  { id: 'anthropic', name: 'Anthropic', emoji: '🧠', desc: 'Claude-powered summarization of notes and calls.' },
] as const

function IntegrationsSection() {
  const [connected, setConnected] = React.useState<Record<string, boolean>>({ slack: true, openai: true })

  function toggle(id: string) {
    setConnected((c) => {
      const next = !c[id]
      if (next) toast.success(`${INTEGRATIONS.find((i) => i.id === id)?.name} connected`)
      else toast.info('Coming soon')
      return { ...c, [id]: next }
    })
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Integrations"
        description="Connect Pulse CRM with the tools your team already uses."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INTEGRATIONS.map((i) => (
          <PremiumCard key={i.id} className="p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-muted/60 grid place-items-center text-[20px]">
                {i.emoji}
              </div>
              {connected[i.id] && (
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px]">
                  <Check size={10} /> Connected
                </Badge>
              )}
            </div>
            <div className="text-[13px] font-semibold">{i.name}</div>
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed flex-1">{i.desc}</p>
            <Button
              size="sm"
              variant={connected[i.id] ? 'outline' : 'default'}
              className="mt-3 w-full"
              onClick={() => toggle(i.id)}
            >
              {connected[i.id] ? (
                <>
                  <Check size={12} /> Connected
                </>
              ) : (
                <>
                  <Plug size={12} /> Connect
                </>
              )}
            </Button>
          </PremiumCard>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// 9. API Keys section
// ---------------------------------------------------------------

function ApiKeysSection() {
  const workspace = useAppStore((s) => s.workspace)
  const user = useAppStore((s) => s.user)
  const { data: keys = [], isLoading } = useSettings('apiKeys') as { data: ApiKey[]; isLoading: boolean }
  const { post, remove } = useSettingsMutations()
  const [createOpen, setCreateOpen] = React.useState(false)
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null)

  function createKey(name: string) {
    if (!workspace || !user) return
    post.mutate(
      { workspaceId: workspace.id, action: 'createApiKey', creatorId: user.id, name },
      {
        onSuccess: (data: any) => {
          const raw = data?.rawKey
          setCreateOpen(false)
          if (raw) {
            setRevealedKey(raw)
          } else {
            toast.success('API key created')
          }
        },
        onError: () => toast.error('Failed to create key'),
      },
    )
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="API Keys"
        description="Programmatic access to the Pulse CRM REST API. Keep keys secret."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Create API key
          </Button>
        }
      />

      <PremiumCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
        ) : keys.length === 0 ? (
          <EmptyState icon={<KeyRound size={18} />} title="No API keys" hint="Create a key to start using the REST API." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium text-[12.5px]">{k.name}</TableCell>
                  <TableCell>
                    <code className="text-[11.5px] font-mono px-1.5 py-0.5 rounded bg-muted">{k.prefix}…</code>
                  </TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground">{relTime(k.createdAt)}</TableCell>
                  <TableCell className="text-[11.5px] text-muted-foreground">
                    {k.lastUsedAt ? relTime(k.lastUsedAt) : 'never'}
                  </TableCell>
                  <TableCell>
                    {k.revokedAt ? (
                      <Badge variant="destructive" className="text-[10px]">revoked</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[10px]">active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={!!k.revokedAt}
                      onClick={() =>
                        remove.mutate(
                          { action: 'revokeApiKey', id: k.id },
                          { onSuccess: () => toast.success('API key revoked') },
                        )
                      }
                    >
                      <Lock size={12} /> Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PremiumCard>

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createKey}
        isPending={post.isPending}
      />

      <RevealKeyDialog
        rawKey={revealedKey}
        onClose={() => setRevealedKey(null)}
      />
    </div>
  )
}

function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (name: string) => void
  isPending: boolean
}) {
  const [name, setName] = React.useState('')

  React.useEffect(() => {
    if (!open) setName('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>Give your key a memorable name to identify where it's used.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ak-name">Name</Label>
          <Input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { if (!name.trim()) { toast.error('Enter a name'); return } onCreate(name.trim()) }} disabled={isPending}>
            <KeyRound size={14} /> Generate key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RevealKeyDialog({ rawKey, onClose }: { rawKey: string | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (rawKey) {
      setCopied(false)
      setVisible(false)
    }
  }, [rawKey])

  function copy() {
    if (!rawKey) return
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Dialog open={!!rawKey} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-500" /> Save your API key
          </DialogTitle>
          <DialogDescription>
            Copy it now — <strong>you won't see this again</strong>. Treat it like a password.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-border/60 bg-muted/40">
            <code className="flex-1 text-[11.5px] font-mono break-all">
              {visible ? rawKey : rawKey ? '•'.repeat(Math.min(rawKey.length, 40)) : ''}
            </code>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => setVisible((v) => !v)}>
              {visible ? <EyeOff size={13} /> : <Eye size={13} />}
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={copy}>
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </Button>
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            If you lose this key, you'll need to revoke it and create a new one.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>I've saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------
// 10. Audit Logs section
// ---------------------------------------------------------------

const AUDIT_ACTIONS = [
  'all',
  'create',
  'update',
  'delete',
  'invite',
  'revoke',
  'login',
  'export',
] as const

function AuditLogsSection() {
  const { data: logs = [], isLoading } = useSettings('audit') as { data: AuditLog[]; isLoading: boolean }
  const [actionFilter, setActionFilter] = React.useState<string>('all')
  const [visibleCount, setVisibleCount] = React.useState(20)

  const filtered = React.useMemo(() => {
    if (actionFilter === 'all') return logs
    return logs.filter((l) => l.action.toLowerCase().includes(actionFilter))
  }, [logs, actionFilter])

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Audit Logs"
        description="Every important workspace event, recorded for compliance."
        actions={
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setVisibleCount(20) }}>
            <SelectTrigger size="sm" className="w-[140px] capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a} className="capitalize">
                  {a === 'all' ? 'All actions' : a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <PremiumCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ScrollText size={18} />} title="No audit logs" hint="Workspace activity will appear here." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>User agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((l) => {
                  const meta = typeof l.meta === 'string' ? safeParse(l.meta) : (l.meta || {})
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-[11.5px] text-muted-foreground whitespace-nowrap">{relTime(l.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={l.actor?.name || 'System'} url={l.actor?.avatarUrl} size={22} />
                          <span className="text-[12px] truncate max-w-[160px]">{l.actor?.name || 'System'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-[11.5px]">
                        <span className="capitalize">{l.entityType}</span>
                        <span className="text-muted-foreground font-mono ml-1">{shortId(l.entityId)}</span>
                      </TableCell>
                      <TableCell className="text-[11.5px] font-mono text-muted-foreground">{(meta as any)?.ip || '—'}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">{(meta as any)?.userAgent || '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {visibleCount < filtered.length && (
              <div className="p-3 border-t border-border/60 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + 20)}>
                  Load more ({filtered.length - visibleCount} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </PremiumCard>
    </div>
  )
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown> } catch { return {} }
}

// ---------------------------------------------------------------
// 11. Exports section
// ---------------------------------------------------------------

function ExportsSection() {
  const leads = useLeads()
  const contacts = useContacts()
  const deals = useDeals()
  const activities = useActivities()

  const cards = [
    {
      title: 'Export Leads',
      desc: 'All leads as a CSV spreadsheet.',
      icon: Users,
      count: leads.data?.length ?? 0,
      loading: leads.isLoading,
      onExport: () => {
        const rows = (leads.data || []).map((l) => ({
          id: l.id,
          name: l.fullName,
          email: l.email || '',
          phone: l.phone || '',
          source: l.source || '',
          status: l.status,
          score: l.score,
          estimatedValue: l.estimatedValue ?? '',
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        }))
        downloadCSV('leads.csv', rows)
      },
    },
    {
      title: 'Export Contacts',
      desc: 'All contacts as a CSV spreadsheet.',
      icon: Users,
      count: contacts.data?.length ?? 0,
      loading: contacts.isLoading,
      onExport: () => {
        const rows = (contacts.data || []).map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email || '',
          phone: c.phone || '',
          jobTitle: c.jobTitle || '',
          company: c.company?.name || '',
          status: c.status,
          createdAt: c.createdAt,
        }))
        downloadCSV('contacts.csv', rows)
      },
    },
    {
      title: 'Export Deals',
      desc: 'All deals with stage, value, and probability.',
      icon: KanbanSquare,
      count: deals.data?.length ?? 0,
      loading: deals.isLoading,
      onExport: () => {
        const rows = (deals.data || []).map((d) => ({
          id: d.id,
          title: d.title,
          amount: d.amount,
          currency: d.currency,
          probability: d.probability,
          stage: d.stage?.name || '',
          pipeline: d.pipeline?.name || '',
          owner: d.owner?.name || '',
          expectedClose: d.expectedClose || '',
          closedAt: d.closedAt || '',
          closeReason: d.closeReason || '',
          createdAt: d.createdAt,
        }))
        downloadCSV('deals.csv', rows)
      },
    },
    {
      title: 'Export Activities',
      desc: 'Recent activity feed as a CSV log.',
      icon: ScrollText,
      count: activities.data?.length ?? 0,
      loading: activities.isLoading,
      onExport: () => {
        const rows = (activities.data || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          summary: a.summary,
          actor: a.actor?.name || '',
          createdAt: a.createdAt,
        }))
        downloadCSV('activities.csv', rows)
      },
    },
  ]

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Exports"
        description="Download a CSV snapshot of any entity for backup or analysis."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <PremiumCard key={c.title} className="p-5 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">{c.title}</div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{c.desc}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {c.loading ? '…' : c.count}
                </Badge>
              </div>
              <Button onClick={c.onExport} variant="outline" className="mt-auto w-full">
                <Download size={13} /> Download CSV
              </Button>
            </PremiumCard>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// 12. Danger Zone section
// ---------------------------------------------------------------

function DangerZoneSection() {
  const workspace = useAppStore((s) => s.workspace)
  const theme = useThemeStore()
  const { remove } = useSettingsMutations()
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [confirmText, setConfirmText] = React.useState('')

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Danger Zone"
        description="Irreversible workspace actions. Proceed with caution."
      />

      <div className="rounded-xl border-2 border-destructive/40 overflow-hidden">
        <div className="bg-destructive/5 divide-y divide-destructive/20">
          {/* Transfer ownership */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 p-5">
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold flex items-center gap-2">
                <ShieldAlert size={14} className="text-destructive" /> Transfer workspace ownership
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Hand this workspace over to another owner. Currently requires manual verification.</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" disabled className="border-destructive/30 text-destructive">
                    <Lock size={13} /> Contact support
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Contact support to transfer ownership.</TooltipContent>
            </Tooltip>
          </div>

          {/* Reset theme */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 p-5">
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold flex items-center gap-2">
                <Palette size={14} className="text-destructive" /> Reset theme to defaults
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Restores the default Plane Dark theme and clears all customization.</p>
            </div>
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => { theme.reset(); toast.success('Theme reset') }}
            >
              <RotateCcw size={13} /> Reset theme
            </Button>
          </div>

          {/* Delete workspace */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 p-5">
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold flex items-center gap-2">
                <Trash2 size={14} className="text-destructive" /> Delete workspace
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">Permanently delete this workspace and all of its data. This cannot be undone.</p>
            </div>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={13} /> Delete workspace
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(v) => { setDeleteOpen(v); if (!v) setConfirmText('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{workspace?.name}</strong> and all associated records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-name">Type the workspace name to confirm</Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={workspace?.name}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={confirmText.trim() !== (workspace?.name || '') || remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!workspace) return
                remove.mutate(
                  { action: 'deleteWorkspace', id: workspace.id },
                  {
                    onSuccess: () => {
                      setDeleteOpen(false)
                      toast.success('Workspace deleted')
                    },
                    onError: () => toast.error('Failed to delete workspace'),
                  },
                )
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------
// Sidebar nav
// ---------------------------------------------------------------

function SettingsSidebar({
  active,
  onSelect,
}: {
  active: SectionKey
  onSelect: (k: SectionKey) => void
}) {
  return (
    <nav className="w-[220px] shrink-0 sticky top-[72px] self-start">
      <div className="rounded-xl border border-border/60 bg-card shadow-soft p-2">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Settings
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = active === item.key
            return (
              <li key={item.key}>
                <button
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon size={14} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'danger' && (
                    <AlertTriangle size={11} className={cn(isActive ? 'text-destructive' : 'text-muted-foreground/70')} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------
// Main view
// ---------------------------------------------------------------

export function SettingsView() {
  const [section, setSection] = React.useState<SectionKey>('workspace')

  return (
    <div className="p-4 md:p-6 view-enter">
      <div className="flex flex-col md:flex-row gap-5">
        <SettingsSidebar active={section} onSelect={setSection} />
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {section === 'workspace' && <WorkspaceSection />}
              {section === 'members' && <MembersSection />}
              {section === 'appearance' && <AppearanceSection />}
              {section === 'pipelines' && <PipelinesSection />}
              {section === 'customFields' && <CustomFieldsSection />}
              {section === 'tags' && <TagsSection />}
              {section === 'notifications' && <NotificationsSection />}
              {section === 'integrations' && <IntegrationsSection />}
              {section === 'apiKeys' && <ApiKeysSection />}
              {section === 'audit' && <AuditLogsSection />}
              {section === 'exports' && <ExportsSection />}
              {section === 'danger' && <DangerZoneSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
