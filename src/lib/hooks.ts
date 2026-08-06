/**
 * TanStack Query hooks for all CRM resources.
 * Each hook fetches from /api/crm/<resource>
 * and provides optimistic-aware mutations.
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from './store'
import { toast } from 'sonner'
import type {
  Company, Contact, Lead, Deal, Task, Note, CRMFile,
  CalendarEvent, Tag, Automation, CustomField, AuditLog, ApiKey,
} from './types'

const BASE = '/api/crm'

async function handleResponse<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const j = await r.json().catch(() => ({ error: r.statusText }))
    throw new Error(j.error || `HTTP ${r.status}`)
  }
  const j = await r.json()
  return j.data as T
}

function useWorkspaceId() {
  return useAppStore((s) => s.workspace?.id)
}

// ---------------------------------------------------
//  Dashboard
// ---------------------------------------------------
export function useDashboard() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['dashboard', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/dashboard?workspaceId=${ws}`)
      return handleResponse(r)
    },
    enabled: !!ws,
    refetchInterval: 30_000,
  })
}

// ---------------------------------------------------
//  Companies
// ---------------------------------------------------
export function useCompanies(q = '') {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['companies', ws, q],
    queryFn: async () => {
      const r = await fetch(`${BASE}/companies?workspaceId=${ws}&q=${encodeURIComponent(q)}`)
      return handleResponse<Company[]>(r)
    },
    enabled: !!ws,
  })
}

export function useCompanyMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Company>) => {
      const r = await fetch(`${BASE}/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return handleResponse<Company>(r)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company created')
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Company> & { id: string }) => {
      const r = await fetch(`${BASE}/companies`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return handleResponse<Company>(r)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company updated')
    },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/companies`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company deleted')
    },
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Contacts
// ---------------------------------------------------
export function useContacts(q = '') {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['contacts', ws, q],
    queryFn: async () => {
      const r = await fetch(`${BASE}/contacts?workspaceId=${ws}&q=${encodeURIComponent(q)}`)
      const j = await r.json()
      return j.data as Contact[]
    },
    enabled: !!ws,
  })
}

export function useContactMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Contact>) => {
      const r = await fetch(`${BASE}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact created')
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Contact> & { id: string }) => {
      const r = await fetch(`${BASE}/contacts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact updated')
    },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/contacts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact deleted')
    },
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Leads
// ---------------------------------------------------
export function useLeads(q = '', status?: string) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['leads', ws, q, status],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: ws!, q, ...(status ? { status } : {}) })
      const r = await fetch(`${BASE}/leads?${params}`)
      const j = await r.json()
      return j.data as Lead[]
    },
    enabled: !!ws,
  })
}

export function useLeadMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Lead>) => {
      const r = await fetch(`${BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Lead created')
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Lead> & { id: string }) => {
      const r = await fetch(`${BASE}/leads`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Lead updated')
    },
    onError: () => toast.error('Could not update lead'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/leads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead deleted')
    },
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Pipelines + Deals
// ---------------------------------------------------
export function usePipelines() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['pipelines', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pipelines?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as any[]
    },
    enabled: !!ws,
  })
}

export function usePipelineMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${BASE}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline created')
    },
    onError: () => toast.error('Could not create pipeline'),
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const r = await fetch(`${BASE}/pipelines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline updated')
    },
    onError: () => toast.error('Could not update pipeline'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/pipelines`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipelines'] })
      toast.success('Pipeline deleted')
    },
    onError: () => toast.error('Could not delete pipeline'),
  })
  return { create, update, remove }
}

export function useDeals(pipelineId?: string) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['deals', ws, pipelineId],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: ws! })
      if (pipelineId) params.set('pipelineId', pipelineId)
      const r = await fetch(`${BASE}/deals?${params}`)
      const j = await r.json()
      return j.data as Deal[]
    },
    enabled: !!ws,
  })
}

export function useDealMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Deal>) => {
      const r = await fetch(`${BASE}/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Deal created')
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Deal> & { id: string }) => {
      const r = await fetch(`${BASE}/deals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Deal updated')
    },
    onError: () => toast.error('Could not update deal'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/deals`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      toast.success('Deal deleted')
    },
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Tasks
// ---------------------------------------------------
export function useTasks(status?: string) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['tasks', ws, status],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: ws! })
      if (status) params.set('status', status)
      const r = await fetch(`${BASE}/tasks?${params}`)
      const j = await r.json()
      return j.data as Task[]
    },
    enabled: !!ws,
  })
}

export function useTaskMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Task>) => {
      const r = await fetch(`${BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Task created')
    },
    onError: () => toast.error('Could not create task'),
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const r = await fetch(`${BASE}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Task updated')
    },
    onError: () => toast.error('Could not update task'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/tasks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task deleted')
    },
    onError: () => toast.error('Could not delete task'),
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Notes
// ---------------------------------------------------
export function useNotes(pinnedOnly = false) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['notes', ws, pinnedOnly],
    queryFn: async () => {
      const r = await fetch(`${BASE}/notes?workspaceId=${ws}${pinnedOnly ? '&pinned=1' : ''}`)
      const j = await r.json()
      return j.data as Note[]
    },
    enabled: !!ws,
  })
}

export function useNoteMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Note>) => {
      const r = await fetch(`${BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note created')
    },
    onError: () => toast.error('Could not create note'),
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Note> & { id: string }) => {
      const r = await fetch(`${BASE}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note updated')
    },
    onError: () => toast.error('Could not update note'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      toast.success('Note deleted')
    },
    onError: () => toast.error('Could not delete note'),
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Files
// ---------------------------------------------------
export function useFiles() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['files', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/files?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as CRMFile[]
    },
    enabled: !!ws,
  })
}

export function useFileMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<CRMFile>) => {
      const r = await fetch(`${BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      toast.success('File uploaded')
    },
    onError: () => toast.error('Could not upload file'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
      toast.success('File deleted')
    },
    onError: () => toast.error('Could not delete file'),
  })
  return { create, remove }
}

// ---------------------------------------------------
//  Calendar
// ---------------------------------------------------
export function useCalendar() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['calendar', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/calendar?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as CalendarEvent[]
    },
    enabled: !!ws,
  })
}

export function useCalendarMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<CalendarEvent>) => {
      const r = await fetch(`${BASE}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
      toast.success('Event created')
    },
    onError: () => toast.error('Could not create event'),
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CalendarEvent> & { id: string }) => {
      const r = await fetch(`${BASE}/calendar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
      toast.success('Event updated')
    },
    onError: () => toast.error('Could not update event'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/calendar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar'] })
      toast.success('Event deleted')
    },
    onError: () => toast.error('Could not delete event'),
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Tags
// ---------------------------------------------------
export function useTags() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['tags', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/tags?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as Tag[]
    },
    enabled: !!ws,
  })
}

export function useTagMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: { name: string; color?: string }) => {
      const r = await fetch(`${BASE}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag created')
    },
    onError: () => toast.error('Could not create tag'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag deleted')
    },
    onError: () => toast.error('Could not delete tag'),
  })
  return { create, remove }
}

// ---------------------------------------------------
//  Activities
// ---------------------------------------------------
export function useActivities() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['activities', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/activities?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as any[]
    },
    enabled: !!ws,
  })
}

// ---------------------------------------------------
//  Notifications
// ---------------------------------------------------
export function useNotifications() {
  const ws = useWorkspaceId()
  const userId = useAppStore((s) => s.user?.id)
  return useQuery({
    queryKey: ['notifications', ws, userId],
    queryFn: async () => {
      const params = new URLSearchParams({ workspaceId: ws!, ...(userId ? { userId } : {}) })
      const r = await fetch(`${BASE}/notifications?${params}`)
      const j = await r.json()
      return j.data as any[]
    },
    enabled: !!ws && !!userId,
  })
}

export function useNotificationMutations() {
  const qc = useQueryClient()
  const markRead = useMutation({
    mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
      await fetch(`${BASE}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: () => toast.error('Could not update notification'),
  })
  const markAllRead = useMutation({
    mutationFn: async (userId: string) => {
      await fetch(`${BASE}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllForUserId: userId }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('All notifications marked as read')
    },
    onError: () => toast.error('Could not update notifications'),
  })
  return { markRead, markAllRead }
}

// ---------------------------------------------------
//  Automations
// ---------------------------------------------------
export function useAutomations() {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['automations', ws],
    queryFn: async () => {
      const r = await fetch(`${BASE}/automations?workspaceId=${ws}`)
      const j = await r.json()
      return j.data as Automation[]
    },
    enabled: !!ws,
  })
}

export function useAutomationMutations() {
  const ws = useWorkspaceId()
  const qc = useQueryClient()
  const create = useMutation({
    mutationFn: async (payload: Partial<Automation>) => {
      const r = await fetch(`${BASE}/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...payload }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation created')
    },
    onError: () => toast.error('Could not create automation'),
  })
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const r = await fetch(`${BASE}/automations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation updated')
    },
    onError: () => toast.error('Could not update automation'),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/automations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation deleted')
    },
    onError: () => toast.error('Could not delete automation'),
  })
  return { create, update, remove }
}

// ---------------------------------------------------
//  Settings
// ---------------------------------------------------
export function useSettings(section: string) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['settings', ws, section],
    queryFn: async () => {
      const r = await fetch(`${BASE}/settings?workspaceId=${ws}&section=${section}`)
      const j = await r.json()
      return j.data
    },
    enabled: !!ws,
  })
}

export function useSettingsMutations() {
  const qc = useQueryClient()
  const post = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Could not save changes'),
  })
  const patch = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`${BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return (await r.json()).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Updated')
    },
    onError: () => toast.error('Could not update'),
  })
  const remove = useMutation({
    mutationFn: async (payload: any) => {
      await fetch(`${BASE}/settings`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Could not delete'),
  })
  return { post, patch, remove }
}

// ---------------------------------------------------
//  Global Search
// ---------------------------------------------------
export function useGlobalSearch(q: string) {
  const ws = useWorkspaceId()
  return useQuery({
    queryKey: ['search', ws, q],
    queryFn: async () => {
      const r = await fetch(`${BASE}/search?workspaceId=${ws}&q=${encodeURIComponent(q)}`)
      const j = await r.json()
      return j.data as {
        leads: Lead[]
        companies: Company[]
        deals: Deal[]
        contacts: Contact[]
        notes: Note[]
        files: CRMFile[]
        tasks: Task[]
      }
    },
    enabled: !!ws && q.length > 0,
  })
}

// ---------------------------------------------------
//  Integrations — real connection status from backend
// ---------------------------------------------------
export interface IntegrationStatus {
  id: string
  name: string
  category: 'database' | 'ai'
  connected: boolean
  details?: Record<string, string | number | boolean | null>
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const r = await fetch(`${BASE}/integrations`)
      const j = await r.json()
      return j.data as {
        integrations: IntegrationStatus[]
        summary: { total: number; connected: number }
      }
    },
    staleTime: 60_000,
  })
}

