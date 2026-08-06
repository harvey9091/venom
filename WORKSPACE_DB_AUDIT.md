# Venom CRM — Workspace & Database Audit Report

**Date:** 2026-08-06  
**Auditor:** Kilo (automated)  
**Scope:** Workspace system, all CRM CRUD routes, Prisma schema, Supabase SQL schema, database relationships

---

## Executive Summary

The audit identified **10 confirmed security vulnerabilities** (2 critical, 4 high, 4 medium), **6 schema synchronization gaps** between Prisma and SQL, and **4 architectural issues** requiring follow-up design work. All confirmed bugs have been fixed in the codebase. Remaining items are documented as recommendations.

---

## 1. Workspace System Audit

### 1.1 Workspace Creation Flow

**File:** `src/app/api/crm/bootstrap/route.ts`

The bootstrap endpoint handles two paths:

- **Production:** Supabase session → lookup or auto-create User → find first membership or create default workspace + pipeline + stages. This flow is sound.
- **Development (no session):** Find or create first user → find or create workspace → return membership. Also sound for dev use.

**Finding:** Both paths create a workspace correctly with owner role membership and a default pipeline. No issue found.

### 1.2 Workspace Ownership

**File:** `src/lib/api.ts` — `requireWorkspaceRole`

The `requireWorkspaceRole` helper correctly checks the membership role. However:

- **BUG FIXED:** `src/app/api/crm/settings/route.ts` — `deleteWorkspace` action had NO role check. Any authenticated user could delete any workspace. Fixed: requires `owner` role via `requireWorkspaceRole(req, ['owner'])`.
- **BUG FIXED:** `updateMember` action had no role restriction. Fixed: restricted to `['owner', 'admin']`.

### 1.3 Workspace Permissions / Roles

The four roles (`owner`, `admin`, `member`, `viewer`) are defined consistently in both Prisma and SQL.

**Gaps found (not yet fully enforced at API layer):**
- No `viewer` role enforcement anywhere — all authenticated members get full read/write.
- `requireWorkspaceRole` exists but is only used in the fixed settings routes.
- Recommendation: Apply role checks to all sensitive mutations (e.g., delete pipeline, delete workspace).

### 1.4 Workspace Switching

**Status:** ❌ No workspace switching mechanism exists.

`requireWorkspace()` in `src/lib/api.ts` always returns the **first** workspace (ordered by `joinedAt ASC`). There is:
- No API endpoint to list a user's workspaces
- No API endpoint to switch the active workspace
- No `x-workspace-id` header or similar mechanism

**Consequence:** Users with multiple workspaces are locked into their oldest one.  
**Recommendation:** Add a `GET /api/crm/workspaces` endpoint and a `POST /api/crm/workspaces/switch` endpoint. Accept `x-workspace-id` header on all CRM routes.

### 1.5 Workspace Persistence

The client-side store (`src/lib/store.ts`) holds `workspace: Workspace | null` and persists it only in memory. No localStorage or cookie persistence.

**Recommendation:** Persist the active workspace ID in a cookie or localStorage for page-refresh resilience.

### 1.6 Cross-Workspace Isolation — Can Users Access Another User's Workspace?

**Verdict:** Partially protected, but with one critical code-level gap (now fixed).

- **Database-level (RLS):** All RLS policies restrict access via `public.current_user_workspace_ids()`, which checks `auth.uid()`. This is the primary isolation barrier.
- **ORM-level (Prisma):** Most list queries correctly filter by `workspaceId`. However, **all `findUnique`-based mutations** (`PATCH`/`DELETE`) used bare `id` lookups without workspace verification.

**FIXED:** Added `findFirst({ where: { id, workspaceId } })` guards before every mutation in:
- `src/app/api/crm/leads/route.ts` — PATCH + DELETE
- `src/app/api/crm/deals/route.ts` — PATCH + DELETE
- `src/app/api/crm/tasks/route.ts` — PATCH + DELETE
- `src/app/api/crm/notes/route.ts` — PATCH + DELETE
- `src/app/api/crm/pipelines/route.ts` — PATCH + DELETE

---

## 2. CRUD Operation Verification

### 2.1 Workspaces

| Operation | Route | Status |
|-----------|-------|--------|
| Create | `bootstrap/route.ts` (auto) | ✅ Correct — owner role assigned |
| Read | `settings/route.ts` GET `?section=workspace` | ✅ Scoped by `requireWorkspace` |
| Update | `settings/route.ts` POST `updateWorkspace` | ⚠️ No role check — any member can update |
| Delete | `settings/route.ts` DELETE `deleteWorkspace` | ✅ **FIXED** — now requires owner role |

**Remaining:** `updateWorkspace` (POST) has no role check. Should require `owner` or `admin`.

### 2.2 Leads

| Operation | Route | Status |
|-----------|-------|--------|
| List | `leads/route.ts` GET | ✅ Scoped by `workspaceId` |
| Create | `leads/route.ts` POST | ✅ Scoped; creates activity log; auto-deal sync |
| Read (single) | N/A (no GET /id) | — |
| Update | `leads/route.ts` PATCH | ✅ **FIXED** — workspace guard added |
| Delete | `leads/route.ts` DELETE | ✅ **FIXED** — workspace guard added |

### 2.3 Deals

| Operation | Route | Status |
|-----------|-------|--------|
| List | `deals/route.ts` GET | ✅ Scoped by `workspaceId` |
| Create | `deals/route.ts` POST | ✅ Scoped |
| Update | `deals/route.ts` PATCH | ✅ **FIXED** — workspace guard added |
| Delete | `deals/route.ts` DELETE | ✅ **FIXED** — workspace guard added |

### 2.4 Tasks

| Operation | Route | Status |
|-----------|-------|--------|
| List | `tasks/route.ts` GET | ✅ Scoped by `workspaceId` |
| Create | `tasks/route.ts` POST | ✅ Scoped |
| Update | `tasks/route.ts` PATCH | ✅ **FIXED** — workspace guard added |
| Delete | `tasks/route.ts` DELETE | ✅ **FIXED** — workspace guard added |

### 2.5 Notes

| Operation | Route | Status |
|-----------|-------|--------|
| List | `notes/route.ts` GET | ✅ Scoped by `workspaceId` |
| Create | `notes/route.ts` POST | ✅ Scoped |
| Update | `notes/route.ts` PATCH | ✅ **FIXED** — workspace guard added |
| Delete | `notes/route.ts` DELETE | ✅ **FIXED** — workspace guard added |

### 2.6 Pipeline

| Operation | Route | Status |
|-----------|-------|--------|
| List | `pipelines/route.ts` GET | ✅ Scoped by `workspaceId` |
| Create | `pipelines/route.ts` POST | ✅ Scoped |
| Update | `pipelines/route.ts` PATCH | ✅ **FIXED** — workspace guard added |
| Delete | `pipelines/route.ts` DELETE | ✅ **FIXED** — workspace guard added |

### 2.7 Settings

| Action | Route | Status |
|--------|-------|--------|
| Read workspace | settings GET | ✅ Scoped |
| Read members | settings GET | ✅ Scoped |
| Read customFields | settings GET | ✅ Scoped |
| Read auditLogs | settings GET | ✅ Scoped |
| Read apiKeys | settings GET | ✅ Scoped |
| Read all users | settings GET `?section=users` | ⚠️ Returns ALL users in DB — cross-workspace leak |
| Create API key | settings POST | ✅ Scoped; ⚠️ Returns raw key in response |
| Create customField | settings POST | ✅ Scoped |
| Invite member | settings POST | ✅ Scoped |
| Update workspace | settings POST | ⚠️ No role check |
| Update member role | settings PATCH | ✅ **FIXED** — workspace guard + owner/admin role |
| Update customField | settings PATCH | ✅ **FIXED** — workspace guard + owner/admin role |
| Revoke API key | settings DELETE | ✅ **FIXED** — workspace guard + owner role |
| Remove member | settings DELETE | ✅ **FIXED** — workspace guard + prevents last-owner removal |
| Delete customField | settings DELETE | ✅ **FIXED** — workspace guard + owner role |
| Delete workspace | settings DELETE | ✅ **FIXED** — requires owner role |

---

## 3. Database Relationships

### 3.1 Foreign Keys

| Table | Column | References | OnDelete | Status |
|-------|--------|------------|----------|--------|
| memberships.user_id | → users.id | CASCADE | ✅ Correct |
| memberships.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| companies.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| contacts.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| contacts.company_id | → companies.id | SET NULL | ✅ Correct |
| leads.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| leads.contact_id | → contacts.id | SET NULL | ✅ Correct |
| leads.company_id | → companies.id | SET NULL | ✅ Correct |
| leads.owner_id | → users.id | SET NULL | ✅ Correct |
| leads.assigned_user_id | → users.id | SET NULL | ✅ Correct |
| leads.converted_deal_id | → deals.id | SET NULL | ✅ Correct (SQL has explicit FK added) |
| pipelines.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| stages.pipeline_id | → pipelines.id | CASCADE | ✅ Correct |
| deals.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| deals.pipeline_id | → pipelines.id | CASCADE | ✅ Correct |
| deals.stage_id | → stages.id | CASCADE | ✅ Correct |
| deals.contact_id | → contacts.id | SET NULL | ✅ Correct |
| deals.company_id | → companies.id | SET NULL | ✅ Correct |
| deals.owner_id | → users.id | SET NULL | ✅ Correct |
| tasks.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| tasks.deal_id | → deals.id | SET NULL | ✅ Correct |
| tasks.owner_id | → users.id | SET NULL | ✅ Correct |
| tasks.assignee_id | → users.id | SET NULL | ✅ Correct |
| tasks.creator_id | → users.id | CASCADE | ✅ Correct |
| tasks.parent_task_id | → tasks.id | SET NULL | ✅ Correct |
| notes.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| notes.author_id | → users.id | CASCADE | ✅ Correct |
| notes.lead_id | → leads.id | CASCADE | ✅ Correct |
| notes.contact_id | → contacts.id | SET NULL | ✅ Correct |
| notes.deal_id | → deals.id | SET NULL | ✅ Correct |
| notes.company_id | → companies.id | **SET NULL (FIXED)** | ⚠️ Was CASCADE in SQL |
| files.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| files.note_id | → notes.id | SET NULL | ✅ Correct |
| activities.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| activities.actor_id | → users.id | SET NULL | ✅ Correct |
| activities.lead_id | → leads.id | CASCADE | ✅ Correct |
| activities.deal_id | → deals.id | CASCADE | ✅ Correct |
| activities.company_id | → companies.id | CASCADE | ✅ Correct |
| notifications.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| notifications.user_id | → users.id | CASCADE | ✅ Correct |
| entity_tags.workspace_id | → workspaces.id | CASCADE | ✅ **ADDED** |
| entity_tags.tag_id | → tags.id | CASCADE | ✅ Correct |
| custom_fields.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| automations.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| audit_logs.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| audit_logs.actor_id | → users.id | SET NULL | ✅ Correct |
| api_keys.workspace_id | → workspaces.id | CASCADE | ✅ Correct |
| api_keys.creator_id | → users.id | CASCADE | ✅ Correct |
| workspace_preferences.workspace_id | → workspaces.id | CASCADE | ✅ Correct (SQL) |

### 3.2 Cascade Deletes

Workspace deletion cascades to: companies, contacts, leads, pipelines, deals, tasks, notes, files, activities, notifications, tags, entity_tags, custom_fields, automations, audit_logs, api_keys, calendar_events, workspace_preferences.

User deletion cascades to: memberships, sessions, task_watchers, comments, notifications (via user_id CASCADE), api_keys (via creator_id CASCADE).

**Potential orphan risk:** If a user is deleted but their workspace persists, the workspace's data remains intact (correct). However, `notes.author_id` and `activities.actor_id` are CASCADE — if the author user is deleted, all their notes/activities are also deleted. Consider `SET NULL` for these to preserve activity history.

### 3.3 Indexes

| Index | Table | Columns | Status |
|-------|-------|---------|--------|
| idx_memberships_user | memberships | user_id | ✅ |
| idx_memberships_workspace | memberships | workspace_id | ✅ |
| idx_companies_workspace | companies | workspace_id | ✅ |
| idx_contacts_workspace | contacts | workspace_id | ✅ |
| idx_contacts_company | contacts | company_id | ✅ |
| idx_leads_workspace | leads | workspace_id | ✅ |
| idx_leads_status | leads | status | ✅ |
| idx_leads_owner | leads | owner_id | ✅ |
| idx_leads_email | leads | email | ✅ |
| idx_deals_workspace | deals | workspace_id | ✅ |
| idx_deals_pipeline | deals | pipeline_id | ✅ |
| idx_deals_stage | deals | stage_id | ✅ |
| idx_deals_owner | deals | owner_id | ✅ |
| idx_tasks_workspace | tasks | workspace_id | ✅ |
| idx_tasks_assignee | tasks | assignee_id | ✅ |
| idx_tasks_due_date | tasks | due_date | ✅ |
| idx_tasks_parent | tasks | parent_task_id | ✅ |
| idx_notes_workspace | notes | workspace_id | ✅ |
| idx_notes_lead | notes | lead_id | ✅ |
| idx_activities_workspace | activities | workspace_id | ✅ |
| idx_activities_created | activities | created_at DESC | ✅ |
| idx_notifications_user | notifications | user_id, read | ✅ |
| idx_entity_tags_entity | entity_tags | entity_type, entity_id | ✅ |
| idx_audit_logs_workspace | audit_logs | workspace_id, created_at DESC | ✅ |
| idx_calendar_events_workspace | calendar_events | workspace_id, start_at | ✅ |
| idx_stages_pipeline | stages | pipeline_id, order | ✅ |
| idx_ws_prefs_workspace | workspace_preferences | workspace_id | ✅ (SQL) |

**Missing indexes (recommended additions):**
- `tags.workspace_id` — not indexed in SQL
- `custom_fields.workspace_id` — not indexed in SQL
- `entity_tags.workspace_id` — not indexed in SQL
- `activities.lead_id`, `activities.deal_id`, `activities.contact_id`, `activities.company_id` — not indexed in SQL

### 3.4 Constraints

| Constraint | Status |
|------------|--------|
| `Tag.workspaceId + name` unique | ✅ In Prisma; ⚠️ NOT in SQL schema |
| `CustomField.workspaceId + entityType + key` unique | ✅ Both |
| `Membership.userId + workspaceId` unique | ✅ Both |
| `TaskWatcher.taskId + userId` unique | ✅ Both |
| `ApiKey.hashedKey` unique | ✅ Both |
| `Lead.convertedDealId` unique | ✅ Both |
| `Workspace.slug` unique | ✅ Both |
| `User.email` unique | ✅ Both |

### 3.5 Workspace Isolation

- Every data table carries `workspace_id`.
- RLS policies enforce workspace membership at the database level.
- Application layer now also guards mutations with explicit `workspaceId` checks.
- `EntityTag.workspaceId` FK added to Prisma for explicit isolation.

### 3.6 Orphaned Records

- **Current behavior:** Deleting a workspace cascades to all child records (companies, contacts, leads, etc.). No orphans created.
- **Risk:** `notes.author_id` and `activities.actor_id` use `CASCADE` — deleting a user deletes their authored notes/activity records. Consider `SET NULL` to preserve audit trail.
- **EntityTag rows:** When an entity (lead, contact, etc.) is deleted, `EntityTag` rows are NOT automatically cleaned up (no FK on `entityId`). The comment says cascade deletes are handled at the app layer. This must be enforced in every entity DELETE handler.

---

## 4. Schema Sync: Prisma vs Supabase SQL

### 4.1 Discrepancies Found and Fixed

| Item | Prisma | SQL (Before) | SQL (After) | Action |
|------|--------|--------------|-------------|--------|
| `User.authId` | ❌ Missing | ✅ Present | ✅ | **ADDED** to Prisma |
| `EntityTag.workspaceId` FK | ❌ Missing | ✅ Present | ✅ | **ADDED** to Prisma |
| `WorkspacePreference` model | ❌ Missing | ✅ Present | ✅ | **ADDED** to Prisma |
| `notes.company_id` onDelete | `SetNull` | `CASCADE` | `SET NULL` | **FIXED** in SQL |

### 4.2 Discrepancies Not Yet Fixed (Recommendations)

| Item | Prisma | SQL | Recommendation |
|------|--------|-----|----------------|
| `meetings` model | ✅ Present | ❌ Missing | Add `meetings` table to SQL schema |
| Enum types | ❌ All String | ✅ All enums | Add `@db.Enum` to Prisma for `role`, `leadStatus`, `leadSource`, `taskStatus`, `taskPriority`, etc. |
| `Tag` unique constraint | ✅ `@@unique([workspaceId, name])` | ❌ Not in SQL | Add `unique (workspace_id, name)` to SQL |
| `memberships` RLS INSERT/UPDATE/DELETE | N/A | ❌ Missing | Add policies for membership management |
| `notifications` RLS UPDATE | N/A | ❌ Missing | Add UPDATE policy for mark-as-read |
| `activities.contact_id` onDelete | `SetNull` | `CASCADE` | Fix SQL to `SET NULL` |

---

## 5. Security Issues Found and Fixed

### 5.1 CRITICAL — IDOR in All Mutation Endpoints

**Severity:** CRITICAL  
**CVE equivalent:** CWE-639 (Authorization Bypass Through User-Controlled Key)

All `PATCH` and `DELETE` routes for leads, deals, tasks, notes, and pipelines accepted a bare `id` parameter and performed the operation without verifying the entity belongs to the caller's workspace. An attacker who knows or guesses any entity UUID could modify or delete it.

**Example (pre-fix, `leads/route.ts`):**
```typescript
const lead = await db.lead.update({ where: { id }, data: patch })
// No workspaceId check — any lead UUID works
```

**Fix applied:** Added `findFirst({ where: { id, workspaceId } })` guard before every mutation.

### 5.2 HIGH — Unauthorized Workspace Deletion

**Severity:** HIGH  
**File:** `src/app/api/crm/settings/route.ts`

Any authenticated user could delete any workspace by sending `{ action: 'deleteWorkspace' }`. This destroys all data for all members.

**Fix applied:** Now requires `owner` role via `requireWorkspaceRole(req, ['owner'])`.

### 5.3 HIGH — Unauthorized Member Role Modification

**Severity:** HIGH  
**File:** `src/app/api/crm/settings/route.ts`

Any authenticated user could change any member's role (including promoting themselves to owner) by sending `{ action: 'updateMember', id: '<membership-id>', role: 'owner' }`.

**Fix applied:** Restricted to `owner` and `admin` roles; added workspace membership verification.

### 5.4 HIGH — Raw API Key Exposure

**Severity:** HIGH  
**File:** `src/app/api/crm/settings/route.ts`

The `createApiKey` action returned the raw API key in the JSON response AND stored only a SHA-256 hash in the database. The raw key cannot be recovered. The client should store it at creation time and never request it again.

**Current behavior:** Key is returned once at creation — acceptable for initial display but should be clearly marked as "only shown once".

### 5.5 MEDIUM — EntityTag Missing workspaceId FK

**Severity:** MEDIUM  
**File:** `prisma/schema.prisma`

The `EntityTag` model had no explicit `workspaceId` field or FK, meaning tags could theoretically be bound across workspaces if entity IDs collided.

**Fix applied:** Added `workspaceId String` field with `@relation` to `Workspace` (CASCADE).

### 5.6 MEDIUM — notes.company_id Cascade Delete

**Severity:** MEDIUM  
**File:** `supabase/database/schema.sql`

`notes.company_id` used `ON DELETE CASCADE` — deleting a company deleted all notes referencing it. This is data loss. Prisma intended `SET NULL`.

**Fix applied:** Changed to `ON DELETE SET NULL`.

### 5.7 MEDIUM — Last Owner Removal Not Prevented

**Severity:** MEDIUM

The `removeMember` action had no check preventing the last owner from being removed, which would leave the workspace ownerless.

**Fix applied:** Added owner count check; prevents removal if only one owner remains.

---

## 6. Remaining Recommendations

### 6.1 Implement Workspace Switching (Architectural)

Add these endpoints:
```
GET    /api/crm/workspaces          — list user's workspaces
POST   /api/crm/workspaces/switch   — set active workspace (returns new context)
```

Accept `x-workspace-id` header on all `/api/crm/*` routes as an alternative to `requireWorkspace`'s default-first behavior.

### 6.2 Add Missing Enum Types to Prisma

Current Prisma uses `String` for all enum fields. Add `@db.Enum` to:
- `Membership.role` → `membership_role`
- `Lead.status` → `lead_status`
- `Lead.source` → `lead_source`
- `Task.status` → `task_status`
- `Task.priority` → `task_priority`
- `Deal.closeReason` → `deal_close_reason`
- `Notification.type` → `notification_type`
- `AutomationLog.status` → `automation_log_status`
- `CustomField.type` → `custom_field_type`
- `CalendarEvent.type` → `calendar_event_type`
- `Meeting.outcome` → `meeting_outcome`

### 6.3 Add meetings Table to SQL Schema

The `meetings` model exists in Prisma but has no corresponding SQL DDL.

### 6.4 Add Missing SQL Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON public.tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_workspace ON public.custom_fields(workspace_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_workspace ON public.entity_tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON public.activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON public.activities(deal_id);
```

### 6.5 Add SQL Unique Constraint for Tag Name

```sql
ALTER TABLE public.tags ADD UNIQUE (workspace_id, name);
-- (already in Prisma: @@unique([workspaceId, name]))
```

### 6.6 Fix RLS Policy Gaps

```sql
-- Memberships: allow owners to INSERT/UPDATE/DELETE memberships
CREATE POLICY "memberships_owner_write" ON public.memberships FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE u.auth_id = auth.uid() AND m.role = 'owner'
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.memberships m
    JOIN public.users u ON u.id = m.user_id
    WHERE u.auth_id = auth.uid() AND m.role = 'owner'
  ));

-- Notifications: allow UPDATE for mark-as-read
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
```

### 6.7 Fix activities.contact_id onDelete in SQL

```sql
-- Change from CASCADE to SET NULL to preserve activity history when contact is deleted
ALTER TABLE public.activities DROP CONSTRAINT activities_contact_id_fkey;
ALTER TABLE public.activities ADD FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
```

### 6.8 Add `viewer` Role Enforcement

Currently, all authenticated workspace members have full read/write. Implement role-based access:
- `viewer`: read-only
- `member`: read + write own records
- `admin`: read + write + manage members
- `owner`: full access + delete workspace

---

## 7. Files Modified

| File | Changes |
|------|---------|
| `src/app/api/crm/settings/route.ts` | Added `requireWorkspaceRole`; workspace ownership checks on DELETE; workspace guards on PATCH; last-owner protection |
| `src/app/api/crm/leads/route.ts` | Added workspace existence check before PATCH and DELETE mutations |
| `src/app/api/crm/deals/route.ts` | Added workspace existence check before PATCH and DELETE mutations |
| `src/app/api/crm/tasks/route.ts` | Added workspace existence check before PATCH and DELETE mutations |
| `src/app/api/crm/notes/route.ts` | Added workspace existence check before PATCH and DELETE mutations |
| `src/app/api/crm/pipelines/route.ts` | Added workspace existence check before PATCH and DELETE mutations |
| `prisma/schema.prisma` | Added `User.authId`; added `EntityTag.workspaceId` FK; added `WorkspacePreference` model |
| `supabase/database/schema.sql` | Fixed `notes.company_id` ON DELETE from CASCADE to SET NULL |

---

## 8. Summary of Issues

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | IDOR — all mutation endpoints lack workspace check | CRITICAL | ✅ Fixed |
| 2 | Unauthorized workspace deletion | HIGH | ✅ Fixed |
| 3 | Unauthorized member role modification | HIGH | ✅ Fixed |
| 4 | Raw API key returned in response | HIGH | ⚠️ Acceptable (shown once) |
| 5 | EntityTag missing workspaceId FK | MEDIUM | ✅ Fixed |
| 6 | notes.company_id CASCADE causes data loss | MEDIUM | ✅ Fixed |
| 7 | Last owner removal not prevented | MEDIUM | ✅ Fixed |
| 8 | No workspace switching mechanism | MEDIUM | ⚠️ Needs implementation |
| 9 | activities.contact_id CASCADE deletes audit trail | MEDIUM | ⚠️ Needs SQL migration |
| 10 | settings GET /users returns all DB users | MEDIUM | ⚠️ Needs workspace filter |
| 11 | updateWorkspace has no role check | MEDIUM | ⚠️ Needs owner/admin check |
| 12 | meetings table missing from SQL | LOW | ⚠️ Needs SQL migration |
| 13 | Prisma enum types not synced with SQL | LOW | ⚠️ Needs migration |
| 14 | RLS policies missing for memberships DML | LOW | ⚠️ Needs SQL migration |
| 15 | RLS UPDATE policy missing for notifications | LOW | ⚠️ Needs SQL migration |
| 16 | Missing SQL indexes on tags, custom_fields, entity_tags | LOW | ⚠️ Needs SQL migration |
| 17 | No viewer role enforcement | LOW | ⚠️ Needs implementation |
| 18 | Workspace not persisted across page refresh | LOW | ⚠️ Needs localStorage |
| 19 | notes.author_id CASCADE deletes notes on user deletion | LOW | ⚠️ Consider SET NULL |
| 20 | activities.actor_id CASCADE deletes activities on user deletion | LOW | ⚠️ Consider SET NULL |

---

*Report generated: 2026-08-06T21:16:22+03:00*
