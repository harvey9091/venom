# Task ID: thinking-1 — Integrate Thinking Orbs into Dashboard, CSV Import, and Files views

**Agent:** full-stack-developer
**Task:** thinking-1
**Date:** 2025

## Summary

Integrated the reusable Thinking Orb system (`<ThinkingState />` + `useThinkingTask` Zustand store + `simulateAIThinking` helper) into the three existing CRM views: Dashboard, CSV Import, and Files. All edits were made with the `Edit`/`MultiEdit` tools only — no files were rewritten.

## Context files read first

- `/home/z/my-project/worklog.md` — project worklog (read template + recent entries)
- `/home/z/my-project/src/components/crm/thinking/index.ts` — barrel export
- `/home/z/my-project/src/components/crm/thinking/orb.tsx` — `Orb` primitive (variants: trio/single/orbit/pulse)
- `/home/z/my-project/src/components/crm/thinking/thinking-state.tsx` — `<ThinkingState />` + `<ThinkingSwap />` (props: state/label, size, variant, theme, animated, fullscreen, compact, overlay, progress, className, children)
- `/home/z/my-project/src/lib/thinking.ts` — Zustand store; `useThinkingTask()` → `{ start, stop, update, startSequence }`; `useThinkingStore` → `{ tasks, startTask, updateTask, stopTask, stopAll, foregroundTask }`
- `/home/z/my-project/src/lib/ai-sim.ts` — `simulateAIThinking(category, { duration, onLabel })`, `mockAIResponse(prompt)`, `THINKING_LABELS` (categories include `upload`, `csv`, `search`, etc.)
- `/home/z/my-project/src/components/crm/views/dashboard.tsx`, `import.tsx`, `files.tsx` — the 3 target views
- `/home/z/my-project/src/lib/hooks.ts` — confirmed `useDashboard()` returns `{ data, isLoading, refetch }`; `useFileMutations()` returns `{ create, remove }` where `create`'s `onSuccess` invalidates `['files']`

## Changes per file

### 1. `src/components/crm/views/dashboard.tsx`

- Added imports: `import * as React from 'react'`, `ThinkingState` from `@/components/crm/thinking`, `useThinkingTask` from `@/lib/thinking`, `RotateCcw` from lucide-react.
- Added `SkeletonWithOrb` helper: wraps each `<Skeleton>` in a `relative` div with an absolutely-positioned `<ThinkingState compact size="sm" variant="trio" theme="primary" />` orb in the top-left.
- Replaced all 8 `<Skeleton>` instances in `DashboardSkeleton` with `<SkeletonWithOrb>` so every skeleton card now shows a small thinking orb alongside the shimmer.
- In `DashboardView`: destructured `refetch` from `useDashboard()`, added `useThinkingTask().startSequence`, added `isRefreshing` state + `handleRefresh` callback. `handleRefresh` runs `startSequence(['Refreshing charts…', 'Recomputing KPIs…', 'Updating dashboard…'], { duration: 800, variant: 'trio', size: 'sm', priority: 'background' })` in parallel with `refetch()` via `Promise.all`; auto-clears `isRefreshing` on settle.
- Wrapped the dashboard `<motion.div>` grid in a `<div className="relative">` and added a floating refresh button (`absolute top-4 right-4 md:top-6 md:right-6 z-30`) in the top-right of the content area. While refreshing, a `<ThinkingState compact size="xs" variant="pulse" />` appears next to the button and the `RotateCcw` icon spins.

### 2. `src/components/crm/views/import.tsx`

- Added imports: `ThinkingState` from `@/components/crm/thinking`, `useThinkingStore, useThinkingTask` from `@/lib/thinking`.
- **Step 1 → 2 (preview)**: Made `UploadStep`'s outer div `relative`. When `isPending` (preview mutation running), renders a `<ThinkingState label="Reading CSV…" size="lg" variant="orbit" theme="rainbow" overlay />` centered over the upload step content. Uses the `overlay` prop (translucent backdrop) — does NOT block the whole viewport.
- **Step 3 → 4 (import)**: In `ImportView`, added `isImporting` local state + `handleImport`. On import click: sets `isImporting=true`, calls `startSequence(['Reading CSV…', 'Mapping columns…', 'Validating emails…', 'Detecting duplicates…', 'Importing rows…', 'Finalizing import…'], { duration: 1200, variant: 'orbit', size: 'xl', priority: 'foreground' })`, then calls `importMutation.mutate(undefined, { onError })`. The `.finally()` on the sequence clears `isImporting`; on mutation error, `stopAll()` + `setIsImporting(false)` abort the sequence early.
- Subscribed to `useThinkingStore` for the foreground task's rotating label + progress. The import overlay (`<ThinkingState label={foregroundTask?.label} size="xl" variant="orbit" theme="rainbow" progress={foregroundTask?.progress} overlay />`) renders in the step-content area (made `relative`) only while `isImporting && step === 3`. Does NOT use `fullscreen` — respects the "never block user interaction beyond the in-view overlay" constraint.
- Changed `ReviewStep`'s `onImport` from `() => importMutation.mutate()` → `handleImport`, and `isImporting` from `importMutation.isPending` → local `isImporting`.
- **Undo button**: In `DoneStep`, added `undoingId` state + `handleUndo(logId)`. Clicking Undo sets `undoingId`, waits 600ms (showing `<ThinkingState compact size="xs" label="Reverting…" variant="pulse" />` inside the button), then calls `undoMutation.mutate(logId)` and clears `undoingId`. The mutation's existing `onSuccess` refetches history.

### 3. `src/components/crm/views/files.tsx`

- Added imports: `ThinkingState` from `@/components/crm/thinking`, `simulateAIThinking` from `@/lib/ai-sim`.
- Extended `UploadingItem` interface with `phase: 'uploading' | 'scanning' | 'generating'`, `label?`, `fileId?`.
- Rewrote `UploadingCard` to render by phase:
  - `uploading`: original progress bar + new `<ThinkingState compact size="xs" label="Uploading…" variant="trio" theme="primary" />` below the bar.
  - `scanning`: shows file name + `<ThinkingState compact size="xs" label={item.label} variant="pulse" />` (label rotates via `simulateAIThinking`).
  - `generating`: shows file name + `<ThinkingState compact size="xs" label="Generating preview…" variant="pulse" />`.
- Updated the list-view uploading row to render phase-appropriate ThinkingStates (same logic).
- Rewrote `startUpload`'s completion branch: when progress hits 100%, transitions to `scanning` phase, runs `simulateAIThinking('upload', { duration: 400, onLabel: (l) => update item.label })`, then on completion calls `create.mutate(...)`. On create success: transitions to `generating` phase (captures `data.id` as `fileId`), waits 500ms, then removes the uploading item + toasts success.
- Added `hiddenFileIds` memo: collects `fileId`s of items in `generating` phase, and filters them out of the `files` list so the real file card doesn't appear until the 500ms "Generating preview…" indicator finishes.

## Constraints honored

- ✅ Used `Edit`/`MultiEdit` tools only — no files rewritten from scratch.
- ✅ All 3 files already had `'use client'` — left intact.
- ✅ Imported `ThinkingState` from `@/components/crm/thinking` (barrel), `useThinkingTask`/`useThinkingStore` from `@/lib/thinking`, `simulateAIThinking` from `@/lib/ai-sim`.
- ✅ Used `overlay` prop (not `fullscreen`) for all in-view overlays — never blocks the whole viewport.
- ✅ `<ThinkingState />` auto-respects `prefers-reduced-motion` (handled internally by the orb's `useReducedMotion`).
- ✅ No other files modified.

## Lint result

`bunx eslint src/components/crm/views/dashboard.tsx src/components/crm/views/import.tsx src/components/crm/views/files.tsx` → **0 errors, 1 warning** (pre-existing `react-hooks/incompatible-library` warning on `useReactTable()` in files.tsx — unrelated to this task; present before edits).

## Dev server

`✓ Compiled in 1442ms` — no compilation errors. Dashboard API returns 200.

## Notes for downstream agents

- The dashboard refresh button uses `priority: 'background'` for the thinking sequence, so it shows in the topbar indicator but does NOT take foreground. The import sequence uses `priority: 'foreground'` so it's the primary active task while importing.
- The files view's 3-phase upload (uploading → scanning → generating) adds ~1.6s of total "thinking" time on top of the real create mutation. The scan phase uses the `upload` category labels from `THINKING_LABELS` (`Uploading file…` / `Scanning for threats…` / `Generating preview…`) rotating at 400ms each.
- The import overlay reads its label/progress from the global thinking store (`foregroundTask`), not local state — so the rotating labels are driven entirely by `startSequence`'s internal timer. If you want to customize the import labels, edit the array passed to `startSequence` in `handleImport`.
- `stopAll()` is called on import mutation error to immediately clear the foreground task from the store (the sequence's internal timers are harmless no-ops after the task is removed).
