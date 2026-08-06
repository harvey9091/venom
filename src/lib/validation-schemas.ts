import { z } from 'zod'

export const searchQuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
  status: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  pipelineId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  pinned: z.string().optional(),
})

export const idParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

export const taskCreateSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  description: z.string().max(10000).optional().default(''),
  status: z.string().max(50).optional().default('todo'),
  priority: z.string().max(50).optional().default('medium'),
  dealId: z.string().max(100).optional(),
  assigneeId: z.string().max(100).optional(),
  creatorId: z.string().max(100).optional(),
  dueDate: z.string().max(50).optional(),
  startDate: z.string().max(50).optional(),
  parentTaskId: z.string().max(100).optional(),
  order: z.number().int().optional().default(0),
})

export const taskPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().max(200).optional(),
  description: z.string().max(10000).optional(),
  status: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
  dealId: z.string().max(100).optional().nullable(),
  assigneeId: z.string().max(100).optional().nullable(),
  creatorId: z.string().max(100).optional().nullable(),
  dueDate: z.string().max(50).optional().nullable(),
  startDate: z.string().max(50).optional().nullable(),
  parentTaskId: z.string().max(100).optional().nullable(),
  order: z.number().int().optional(),
  pinned: z.boolean().optional(),
})

export const companyCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  domain: z.string().max(200).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  size: z.string().max(50).optional().nullable(),
  revenue: z.number().optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  status: z.string().max(50).optional().default('active'),
})

export const contactCreateSchema = z.object({
  firstName: z.string().min(1, 'firstName is required').max(100),
  lastName: z.string().min(1, 'lastName is required').max(100),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  linkedin: z.string().max(200).optional().nullable(),
  twitter: z.string().max(200).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  status: z.string().max(50).optional().default('subscribed'),
})

export const contactPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().max(500).optional().nullable(),
  linkedin: z.string().max(200).optional().nullable(),
  twitter: z.string().max(200).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  status: z.string().max(50).optional(),
})

export const leadCreateSchema = z.object({
  fullName: z.string().min(1, 'fullName is required').max(200),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional().default('new'),
  score: z.number().int().min(0).max(100).optional().default(0),
  estimatedValue: z.number().optional().nullable(),
  expectedClose: z.string().max(50).optional().nullable(),
  contactId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  ownerId: z.string().max(100).optional().nullable(),
  assignedUserId: z.string().max(100).optional().nullable(),
})

export const leadPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  fullName: z.string().max(200).optional(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional(),
  score: z.number().int().min(0).max(100).optional(),
  estimatedValue: z.number().optional().nullable(),
  expectedClose: z.string().max(50).optional().nullable(),
  contactId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  ownerId: z.string().max(100).optional().nullable(),
  assignedUserId: z.string().max(100).optional().nullable(),
})

export const dealCreateSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  pipelineId: z.string().min(1, 'pipelineId is required').max(100),
  stageId: z.string().min(1, 'stageId is required').max(100),
  contactId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  ownerId: z.string().max(100).optional().nullable(),
  amount: z.number().optional().default(0),
  currency: z.string().max(10).optional().default('INR'),
  probability: z.number().int().min(0).max(100).optional().default(20),
  expectedClose: z.string().max(50).optional().nullable(),
  closeReason: z.string().max(50).optional().nullable(),
})

export const dealPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().max(200).optional(),
  pipelineId: z.string().max(100).optional(),
  stageId: z.string().max(100).optional(),
  contactId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
  ownerId: z.string().max(100).optional().nullable(),
  amount: z.number().optional(),
  currency: z.string().max(10).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedClose: z.string().max(50).optional().nullable(),
  closeReason: z.string().max(50).optional().nullable(),
  closedAt: z.string().max(50).optional().nullable(),
})

export const pipelineCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
})

export const pipelinePatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  isDefault: z.boolean().optional(),
})

export const noteCreateSchema = z.object({
  title: z.string().max(200).optional().default(''),
  body: z.string().max(50000).optional().default(''),
  pinned: z.boolean().optional().default(false),
  leadId: z.string().max(100).optional().nullable(),
  contactId: z.string().max(100).optional().nullable(),
  dealId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
})

export const notePatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().max(200).optional(),
  body: z.string().max(50000).optional(),
  pinned: z.boolean().optional(),
  leadId: z.string().max(100).optional().nullable(),
  contactId: z.string().max(100).optional().nullable(),
  dealId: z.string().max(100).optional().nullable(),
  companyId: z.string().max(100).optional().nullable(),
})

export const tagCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  color: z.string().max(20).optional().default('#64748b'),
})

export const automationCreateSchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  enabled: z.boolean().optional().default(true),
  triggerType: z.string().max(100).optional(),
  triggerConfig: z.unknown().optional(),
  graph: z.unknown().optional(),
})

export const automationPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  enabled: z.boolean().optional(),
  triggerType: z.string().max(100).optional(),
  triggerConfig: z.unknown().optional(),
  graph: z.unknown().optional(),
})

export const notificationPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  read: z.boolean().optional(),
  markAllForUserId: z.string().max(100).optional(),
})

export const notificationCreateSchema = z.object({
  userId: z.string().min(1, 'userId is required').max(100),
  type: z.string().min(1, 'type is required').max(50),
  title: z.string().min(1, 'title is required').max(200),
  body: z.string().max(5000).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
  read: z.boolean().optional().default(false),
})

export const settingsCreateApiKeySchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  creatorId: z.string().max(100),
})

export const settingsInviteMemberSchema = z.object({
  email: z.string().email('valid email is required').max(200),
  name: z.string().max(200).optional(),
  role: z.string().max(50).optional().default('member'),
})

export const settingsUpdateWorkspaceSchema = z.object({
  name: z.string().max(200).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  accentColor: z.string().max(20).optional(),
  logoUrl: z.string().max(500).optional().nullable(),
  plan: z.string().max(50).optional(),
})

export const settingsCreateCustomFieldSchema = z.object({
  entityType: z.string().max(50),
  name: z.string().min(1, 'name is required').max(100),
  key: z.string().min(1, 'key is required').max(100),
  type: z.string().max(50),
  options: z.any().optional(),
  required: z.boolean().optional().default(false),
})

export const settingsUpdateMemberSchema = z.object({
  id: z.string().min(1, 'id is required'),
  role: z.string().max(50).optional(),
})

export const settingsUpdateCustomFieldSchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().max(100).optional(),
  key: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
  options: z.any().optional(),
  required: z.boolean().optional(),
})

export const deleteWorkspaceSchema = z.object({
  id: z.string().min(1, 'id is required'),
})
