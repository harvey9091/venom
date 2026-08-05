# Task ID: 10 — Build the CSV Import view for Pulse CRM

**Agent:** full-stack-developer
**Task:** build the CSV Import view (`ImportView`)
**Target file:** `src/components/crm/views/import.tsx`

## Context read

- `worklog.md` (Tasks 5–11 history — confirmed `card-premium`, `shadow-soft`, `view-enter`, drawer conventions, `useSettings('members')` returns `Membership[]`)
- `src/lib/types.ts` (`AuditLog`, `Membership`, `User`, `Workspace`, `ViewKey`)
- `src/lib/store.ts` (`useAppStore` — `user`, `workspace`, `navigate`)
- `src/lib/hooks.ts` (`useSettings`, `useQueryClient` invalidation patterns)
- `src/app/api/crm/import/route.ts` (exact request/response shapes for preview/import/history/undo; `meta` stored as JSON **string** in DB → must `JSON.parse` client-side)
- `src/components/crm/shared.tsx` (`Avatar`, `relTime`, `EmptyState`)
- `src/components/ui/*` (radio-group, progress, toggle-group, select, table, card, skeleton, etc.)
- `src/app/globals.css` (`card-premium`, `shadow-soft`, `shadow-glow`, `view-enter`, `scroll-area`)

## Key implementation decisions

- **Mapping direction**: backend reads `mapping.<targetKey>` as the CSV-header name (e.g. `row[mapping.fullName]`). UI state is `Record<csvHeader, targetKey | '__skip__'>` (one dropdown per CSV column); inverted to `Record<targetKey, csvHeader>` before sending to the backend. Skipped entries (`'__skip__'`) are omitted from the payload.
- **estimatedValue key quirk**: backend reads `row[mapping.value]` for the lead estimated value (not `mapping.estimatedValue`). Field def uses `key: 'value'` with `label: 'Estimated Value'` so the dropdown shows the pretty label while the payload key matches the backend.
- **Row count for import**: preview endpoint slices to 50 rows. To support large CSVs, the client re-parses the full CSV text with a parser that mirrors the backend's `parseCSV` exactly — the preview is used for display/validation, the client-parsed rows are sent to `import`.
- **Auto-match**: two-pass — exact normalized match first (`fullName` ↔ `Full Name`), then `includes` fallback (`Email Address` ↔ `email`). Unmatched → `'__skip__'`.
- **Required-field validation**: enforces the primary required field per entity type (`fullName` / `firstName` / `name`) before allowing step 2 → 3. Visual asterisks shown on all asterisked fields per spec.
- **Invalid-row estimate** (step 3): counts rows where the backend would `continue` (leads: both fullName+email empty; contacts: firstName+lastName+email empty; companies: name empty).
- **History `meta`**: `JSON.parse(log.meta)` → `{ imported, duplicates, total, undone? }`.
- **Framer Motion**: `AnimatePresence mode="wait"` wrapping each step; `x: 24 → 0` slide + `opacity` fade, 0.2s.
- **Step indicator**: 4 numbered circles connected by a flex line; completed = filled primary + Check icon; current = primary ring + glow; future = muted.

## Status

🚧 In progress — building the file.

## Final status

**Status:** ✅ Complete

**File created:** `src/components/crm/views/import.tsx` (~1330 lines) — exports `ImportView`

**Lint:** ✅ 0 errors, 0 warnings (`bunx eslint src/components/crm/views/import.tsx` — clean after removing one dead `eslint-disable` directive and one dead-code placeholder).

**Compile:** ✅ Dev server reports `✓ Compiled in 142ms`. The only dev-log error is the pre-existing `@/components/crm/views/settings` module-not-found, which belongs to a different task (not this file).

### What was built

A 4-step CSV import wizard:
1. **Upload** — drag-and-drop zone (dashed border, primary tint on dragover, `Upload` icon), file picker (`.csv` only), "Paste CSV" textarea toggle, "Download template" (client-side Blob), file chip with name/size/row-count, `Continue` → `preview` mutation.
2. **Map Columns** — entity-type `ToggleGroup` (Leads/Contacts/Companies), mapping `Table` (CSV header → target-field `Select` with "(Skip)" + asterisked required fields), two-pass `autoMatch` (exact normalized then `includes` fallback), owner `Select` from `useSettings('members')` (leads/contacts only), 5-row × 4-col preview, validation enforces primary required field mapped.
3. **Review** — 3 summary cards (Will import / Duplicates "by email" / Invalid rows), duplicate-handling `RadioGroup` (Skip default / Update existing — UI-only), "Import NNN rows" → `import` mutation with `invertMapping` payload.
4. **Done & History** — spring-animated success hero, history `Table` (`GET ?action=history`, `JSON.parse(log.meta)` for counts + `undone` flag), per-row "Undo" button (`POST ?action=undo`), "Import another file" (resets state), "View imported leads" (`navigate('leads')`).

### Key decisions

- **Mapping direction**: UI = `{ csvHeader → targetKey }`; backend payload = inverted `{ targetKey → csvHeader }` (because backend does `row[mapping.fullName]`). See `invertMapping()`.
- **`estimatedValue` key quirk**: backend reads `mapping.value`, so the field def uses `key: 'value'` with `label: 'Estimated Value'`.
- **Full-row import**: client-side `parseCSV` (exact mirror of backend parser) produces `allRows` so imports work for CSVs > 50 rows (preview only returns 50).
- **Invalid-row estimate**: matches backend skip conditions (leads: fullName+email both empty; contacts: firstName+lastName+email all empty; companies: name empty).
- **Invalidations after import**: `['leads']`, `['contacts']`, `['companies']`, `['dashboard']`, `['import-history']`.
- **Framer Motion**: `AnimatePresence mode="wait"` + `motion.div` keyed by step; `x: 24→0` slide + opacity fade, 0.2s.

### Constraints honored

- `'use client'` at top.
- Only `src/components/crm/views/import.tsx` created — no other files modified.
- `sonner` toasts, `lucide-react` icons, `useQueryClient` invalidations, `useAppStore` for user/workspace/navigate, `useSettings('members')` for owner dropdown.
- Existing shadcn/ui primitives only.
- Sticky footer with `mt-auto` per layout rule.
