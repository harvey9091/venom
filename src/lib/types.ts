/**
 * Pulse CRM — Shared types
 * Mirrors the Prisma schema but simplified for client-side state.
 */

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  jobTitle?: string | null
}

export interface Workspace {
  id: string
  slug: string
  name: string
  description?: string | null
  logoUrl?: string | null
  accentColor: string
  plan: 'free' | 'pro' | 'enterprise'
}

export interface Membership {
  id: string
  userId: string
  workspaceId: string
  role: Role
  user?: User
}

export interface Company {
  id: string
  workspaceId: string
  name: string
  domain?: string | null
  industry?: string | null
  size?: string | null
  revenue?: number | null
  website?: string | null
  logoUrl?: string | null
  city?: string | null
  country?: string | null
  status: string
  createdAt: string
  tags?: Tag[]
}

export interface Contact {
  id: string
  workspaceId: string
  companyId?: string | null
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  jobTitle?: string | null
  avatarUrl?: string | null
  status: string
  createdAt: string
  company?: Company | null
  tags?: Tag[]
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'

export interface Lead {
  id: string
  workspaceId: string
  contactId?: string | null
  companyId?: string | null
  ownerId?: string | null
  fullName: string
  email?: string | null
  phone?: string | null
  source?: string | null
  status: LeadStatus
  score: number
  estimatedValue?: number | null
  createdAt: string
  updatedAt: string
  lastActivityAt?: string | null
  owner?: User | null
  contact?: Contact | null
  company?: Company | null
  tags?: Tag[]
}

export interface Stage {
  id: string
  pipelineId: string
  name: string
  color: string
  order: number
  probability: number
  isWon: boolean
  isLost: boolean
}

export interface Pipeline {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  isDefault: boolean
  stages: Stage[]
}

export interface Deal {
  id: string
  workspaceId: string
  pipelineId: string
  stageId: string
  contactId?: string | null
  companyId?: string | null
  ownerId?: string | null
  title: string
  amount: number
  currency: string
  probability: number
  expectedClose?: string | null
  closedAt?: string | null
  closeReason?: 'won' | 'lost' | null
  createdAt: string
  updatedAt: string
  stage?: Stage
  pipeline?: Pipeline
  owner?: User | null
  contact?: Contact | null
  company?: Company | null
  tags?: Tag[]
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'canceled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  workspaceId: string
  dealId?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  ownerId?: string | null
  assigneeId?: string | null
  creatorId?: string | null
  dueDate?: string | null
  startDate?: string | null
  recurrence?: string | null
  parentTaskId?: string | null
  order: number
  createdAt: string
  owner?: User | null
  assignee?: User | null
  subtasks?: Task[]
  comments?: Comment[]
  tags?: Tag[]
}

export interface Comment {
  id: string
  taskId: string
  authorId: string
  body: string
  createdAt: string
  author?: User | null
}

export interface Note {
  id: string
  workspaceId: string
  authorId: string
  leadId?: string | null
  contactId?: string | null
  dealId?: string | null
  companyId?: string | null
  title?: string | null
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  author?: User | null
}

export interface CRMFile {
  id: string
  workspaceId: string
  uploaderId?: string | null
  leadId?: string | null
  name: string
  mimeType: string
  size: number
  url: string
  version: number
  createdAt: string
  uploader?: User | null
}

export interface CalendarEvent {
  id: string
  workspaceId: string
  title: string
  description?: string | null
  type: 'meeting' | 'call' | 'task' | 'reminder' | 'out-of-office'
  startAt: string
  endAt: string
  allDay: boolean
  location?: string | null
  meetingLink?: string | null
}

export interface Activity {
  id: string
  workspaceId: string
  actorId?: string | null
  leadId?: string | null
  contactId?: string | null
  dealId?: string | null
  companyId?: string | null
  type: string
  summary: string
  createdAt: string
  actor?: User | null
}

export interface Notification {
  id: string
  workspaceId: string
  userId: string
  type: 'mention' | 'assignment' | 'automation' | 'system'
  title: string
  body?: string | null
  link?: string | null
  read: boolean
  createdAt: string
}

export interface Tag {
  id: string
  workspaceId: string
  name: string
  color: string
}

export interface CustomField {
  id: string
  workspaceId: string
  entityType: 'lead' | 'contact' | 'deal' | 'company' | 'task'
  name: string
  key: string
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'url'
  options?: string[] | null
  required: boolean
}

export interface AuditLog {
  id: string
  workspaceId: string
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  meta?: Record<string, unknown> | null
  createdAt: string
  actor?: User | null
}

export interface ApiKey {
  id: string
  workspaceId: string
  creatorId: string
  name: string
  prefix: string
  lastUsedAt?: string | null
  revokedAt?: string | null
  createdAt: string
  creator?: User | null
}

export interface Automation {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  enabled: boolean
  triggerType: string
  graph: AutomationGraph
  runsCount: number
  lastRunAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AutomationNode {
  id: string
  type: 'trigger' | 'condition' | 'action'
  data: {
    triggerType?: string
    actionType?: string
    field?: string
    op?: string
    value?: string | number
    target?: string
    tag?: string
    [k: string]: unknown
  }
  position: { x: number; y: number }
}

export interface AutomationEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface AutomationGraph {
  nodes: AutomationNode[]
  edges: AutomationEdge[]
}

// CRM Views (client-side router)
export type ViewKey =
  | 'dashboard'
  | 'companies'
  | 'contacts'
  | 'leads'
  | 'deals'
  | 'pipeline'
  | 'tasks'
  | 'calendar'
  | 'notes'
  | 'files'
  | 'automations'
  | 'import'
  | 'settings'

export interface RouteState {
  view: ViewKey
  params?: Record<string, unknown>
}
