# Task: venom-phase5-container — Wrap all 8 Venom CRM views in `AppContentContainer`

**Agent:** full-stack-developer
**Date:** 2025

## Goal

Phase 5 of the Venom CRM layout system requires every page to render inside the new `AppContentContainer` component with a semantic width preset. Prior to this task each view hard-coded its own padding (`p-4 md:p-6`) and had no max-width — content stretched edge-to-edge. This task wraps all 8 views with the correct preset and removes the redundant padding classes.

## Context read first

- `/home/z/my-project/worklog.md` (build history — confirmed Phase 4 SettingsLayout refactor was the immediately prior task)
- `/home/z/my-project/src/components/crm/shell/app-content-container.tsx` — confirmed props: `preset`, `children`, `className`, `flushVertical?`, `flushHorizontal?`. Renders a `div` with `maxWidth` from CSS variables (`--content-width-compact`/`-standard`/`-wide`/`-extrawide`), `marginLeft/Right: auto`, and `paddingLeft/Right: var(--page-horizontal-padding)`, `paddingTop/Bottom: var(--page-vertical-padding)` (skipped when flush). Adds `view-enter` to `className` itself via `cn()`.

## Preset assignments applied (per Phase 5 spec)

| View | Preset | Max-width |
|---|---|---|
| `dashboard.tsx` | `standard` | 1450px |
| `leads.tsx` | `wide` | 1560px |
| `deals.tsx` | `wide` | 1560px |
| `pipeline.tsx` | `wide` | 1560px |
| `tasks.tsx` | `standard` | 1450px |
| `notes.tsx` | `compact` | 1320px |
| `automations.tsx` | `extrawide` | 1640px (flushVertical + flushHorizontal) |
| `settings.tsx` | `standard` | 1450px |

## Per-file changes

### `dashboard.tsx` (preset=standard, special case)
- Original structure: outer `<div className="relative">` containing a `<motion.div className="grid grid-cols-12 gap-4 p-4 md:p-6">` and an absolutely-positioned refresh button.
- Replaced `<div className="relative">` with `<AppContentContainer preset="standard" className="relative">` so the absolute refresh button keeps its containing block.
- Removed `p-4 md:p-6` from the inner `motion.div` (kept `grid grid-cols-12 gap-4`).
- Closing `</div>` of the outer wrapper → `</AppContentContainer>`.
- Added import after `import { cn } from '@/lib/utils'`.

### `leads.tsx` (preset=wide)
- Replaced outer `<div className="p-4 md:p-5 view-enter">` with `<AppContentContainer preset="wide">`. (Note: original was `p-4 md:p-5` — slightly different padding from the others, now unified via the container's CSS variable padding.)
- Closing `</div>` → `</AppContentContainer>`. Kept all inner content (HeaderStrip, Tabs, table/board, ImportCsvDialog) untouched.
- Added import.

### `deals.tsx` (preset=wide)
- Replaced outer `<div className="p-4 md:p-6 view-enter">` with `<AppContentContainer preset="wide">`.
- Closing `</div>` → `</AppContentContainer>`.
- Added import.

### `pipeline.tsx` (preset=wide)
- Replaced outer `<div className="p-4 md:p-6 view-enter">` with `<AppContentContainer preset="wide">`.
- Closing `</div>` → `</AppContentContainer>`.
- Added import.

### `tasks.tsx` (preset=standard)
- Replaced outer `<div className="p-4 md:p-6 view-enter">` with `<AppContentContainer preset="standard">`.
- Closing `</div>` → `</AppContentContainer>`.
- Added import.

### `notes.tsx` (preset=compact)
- Replaced outer `<div className="p-4 md:p-6 view-enter">` with `<AppContentContainer preset="compact">`.
- Closing `</div>` → `</AppContentContainer>`.
- Added import.

### `automations.tsx` (preset=extrawide, special case — flushVertical + flushHorizontal)
- This view has a full-height editor (`h-[calc(100vh-3.5rem)]`) with left list pane, top toolbar, canvas, and run log. The editor manages its own internal spacing — applying the container's default padding would break the canvas.
- Wrapped BOTH render branches (loading skeleton + main editor) in `<AppContentContainer preset="extrawide" flushVertical flushHorizontal>`.
- Inside, kept the original `<div className="h-[calc(100vh-3.5rem)] flex view-enter">` but **removed `view-enter`** from it (the container adds it itself via `cn()` — keeping it would have been a duplicate, harmless but redundant).
- This centers the entire editor (list + canvas + logs) at 1640px max-width with zero internal padding from the container; the editor continues to manage its own internal spacing via the existing `aside` (left list) and `flex-1` (right pane) layout.
- Added import.

### `settings.tsx` (preset=standard)
- Replaced outer `<div className="p-4 md:p-6 view-enter">` with `<AppContentContainer preset="standard">`.
- Kept the inner `<div className="flex flex-col md:flex-row gap-5">` (sidebar + content) untouched.
- Closing `</div>` → `</AppContentContainer>`.
- Added import.

## ESLint result

```
bunx eslint src/components/crm/views/{dashboard,leads,deals,pipeline,tasks,notes,automations,settings}.tsx
```

**0 errors, 2 warnings — both pre-existing and unrelated to this task:**
- `deals.tsx:368:17` — `react-hooks/incompatible-library` warning about `useReactTable()` (TanStack Table library; pre-existing, untouched code).
- `tasks.tsx:672:17` — same TanStack Table warning (pre-existing, untouched code).

No new warnings or errors introduced by the `AppContentContainer` wrapping.

## Decisions

- **Why `flushVertical flushHorizontal` on automations**: the automation editor is a full-viewport-height canvas app. Applying `--page-horizontal-padding` (typically 16-24px) would have shrunk the usable canvas width and broken the editor's `h-[calc(100vh-3.5rem)]` math (which assumes the editor fills its parent). The `extrawide` preset's 1640px max-width still applies via `maxWidth`, so the editor centers correctly on wide screens, but with zero internal padding — the editor manages its own gaps.
- **Why wrap the loading skeleton branch in automations too**: without wrapping, the loading skeleton would render edge-to-edge while the loaded editor renders centered at 1640px — causing a visible horizontal jump when data resolves. Wrapping both branches keeps the layout stable.
- **Why move `relative` to AppContentContainer's `className` on dashboard**: the dashboard's refresh button is `absolute top-4 right-4` — it needs a positioned ancestor. `AppContentContainer` accepts `className` and merges it via `cn()` into its own `view-enter` class, so passing `className="relative"` makes the container itself the positioned ancestor — same behavior, single source of truth for the page wrapper.
- **Why remove `view-enter` from inner wrappers**: `AppContentContainer` already adds `view-enter` to its own root `div` via `cn('view-enter', className)`. Leaving `view-enter` on an inner div would have applied the entrance animation twice (container + inner), which is harmless but redundant and looks slightly different on transitions. Removed for cleanliness.

## Files Changed

- `src/components/crm/views/dashboard.tsx`
- `src/components/crm/views/leads.tsx`
- `src/components/crm/views/deals.tsx`
- `src/components/crm/views/pipeline.tsx`
- `src/components/crm/views/tasks.tsx`
- `src/components/crm/views/notes.tsx`
- `src/components/crm/views/automations.tsx`
- `src/components/crm/views/settings.tsx`

## Notes for Future Agents

- **Do NOT add `p-4`, `p-6`, `md:p-6`, or `view-enter` to the outer wrapper of any view.** `AppContentContainer` handles all of these via CSS variables and its own `cn()` call.
- **The 5 valid presets are** `compact` (1320px), `standard` (1450px), `wide` (1560px), `extrawide` (1640px), `full` (100%). Don't invent new ones — extend `PRESET_MAX_WIDTH` in `app-content-container.tsx` if a new width is needed.
- **`flushVertical` and `flushHorizontal` are for canvas / full-bleed pages only** (currently only `automations.tsx`). Regular content pages should keep the default padding so their content aligns with the rest of the app.
- **The `className` prop on `AppContentContainer` is for positioning context** (e.g. `relative` for absolutely-positioned children), not for padding or width — those come from the preset.
- **Adding a new view**: pick a preset (most likely `standard` or `wide`), wrap the outer return in `<AppContentContainer preset="…">`, never add hardcoded padding. Look at `tasks.tsx` or `deals.tsx` as the canonical example.
