# Task ID: venom-leads — Rebuild Leads view as PRIMARY CRM entity (Phase 2 refactor)

**Agent:** full-stack-developer
**File rewritten:** `src/components/crm/views/leads.tsx` (~840 lines, `'use client'`)

## What was built

Twenty CRM-inspired compact, dense Leads view with:
- **Header strip (h-12)**: title + count badge | debounced search (250ms) | status `<Select>` (9 statuses) | owner `<Select>` (All/Me/Unassigned + each member) | Import CSV button | New Lead button
- **Tabs**: Table | Board with Framer Motion fade+slide transitions (respects `useReducedMotion`)
- **Table view**: `.venom-table` with 13 fixed-width columns (32–180px), sticky header, sortable headers (name/status/value/createdAt/expectedClose/score), inline-editable status pill (Popover → `update.mutate({id, status})` immediately), 9-status color map (slate/blue/violet/rose/amber/orange/emerald/red/gray), phone in monospace, ₹ INR money formatting, past-due expected close in red, ScoreBar, 36px compact rows, hover primary tint
- **Bulk action bar (h-10)**: slides in via AnimatePresence — count + Assign (Popover with members → bulk `update.mutate`) + Tag (toast) + Delete (bulk `remove.mutate`)
- **Board view**: 9-column Kanban with @dnd-kit/core + sortable. Drag-and-drop between columns → `update.mutate({id, status})`. Compact cards (p-2.5) with Avatar, name, email, ScoreBar, ₹ value, company/source
- **Import CSV dialog**: 4-step wizard in a Dialog — Upload (drag-drop + paste + download template) → Map (auto-match headers to target fields, owner select) → Review (summary + duplicate radio) → Done (success + Import another / View leads). Importing state shows ThinkingState with rotating labels via `useThinkingTask().startSequence()` + parallel `create.mutateAsync` loop

## Key decisions

- Dropped TanStack Table → raw `<table className="venom-table">` with `<colgroup>` for pixel-precise column widths
- Inline status edit uses Popover (not Select) for custom colored-dot dropdown
- Used `create.mutateAsync` (not `mutate`) in import loop to await each create + update progress counter
- ThinkingState reads label from `useThinkingStore` (synced with `startSequence`)
- Client-side CSV parser (RFC-4180: quoted fields, escaped quotes, CRLF)
- All colors via Tailwind palette + `dark:` variants (no hardcoded hex)

## Lint

`bunx eslint src/components/crm/views/leads.tsx` — **exit 0, 0 errors, 0 warnings** ✅

## Pre-existing note

The `/api/crm/leads` GET route had a transient 500 earlier in dev.log (Prisma validation error suggesting `workspace/activities/notes/files` as valid include fields — likely a stale hot-reload cache). The latest dev.log shows successful Lead queries from the dashboard endpoint. This is a server-side route issue, NOT caused by this client-side rewrite.
