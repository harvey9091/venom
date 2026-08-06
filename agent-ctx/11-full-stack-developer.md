# Task ID: 11 — Build Notes view, Note Drawer, Files view, and File Drawer for Pulse CRM

**Agent:** full-stack-developer
**Task:** build notes + files views and their drawers
**Date:** 2025

## Summary

Created 4 `'use client'` files under `src/components/crm/views/`:

1. **`notes.tsx`** — exports `NotesView`
2. **`note-drawer.tsx`** — exports `NoteDrawer({ id?, mode?, onClose })`
3. **`files.tsx`** — exports `FilesView`
4. **`file-drawer.tsx`** — exports `FileDrawer({ id, onClose })`

The `src/components/crm/shell/entity-drawer.tsx` shell already imports `NoteDrawer` (for `note-new` / `note` types) and `FileDrawer` (for `file` type with id), so no shell edits were required.

## Files & exports

| File | Lines | Exports | Notes |
|---|---|---|---|
| `src/components/crm/views/notes.tsx` | ~340 | `NotesView` | 2-col masonry grid, pinned toggle, search, Framer Motion stagger |
| `src/components/crm/views/note-drawer.tsx` | ~690 | `NoteDrawer` | Inline title, debounced autosave (800ms), linked-entity Popover+Command combobox |
| `src/components/crm/views/files.tsx` | ~840 | `FilesView` | Drop zone + grid/list toggle + mocked upload progress (1.5s) |
| `src/components/crm/views/file-drawer.tsx` | ~605 | `FileDrawer` | mime-based preview (img/pdf/video/audio/other) + mock version history |

## Key implementation choices

### Notes view (`notes.tsx`)
- Masonry via CSS `columns-1 md:columns-2 gap-3` + `break-inside-avoid` per card (no JS layout lib).
- Each `NoteCard` is a `<motion.button>` with staggered entrance (`delay = min(i * 0.04, 0.4)`).
- Hover reveals a Pencil icon (top-right) that overlays the pinned Star when present (`pr-7` / `pr-14` reservation depending on pinned state).
- Linked-entity badge is a nested `<button>` that stops propagation before calling `openDrawer(linked.drawerType, linked.id)` — so clicking the badge opens the linked entity's drawer without also opening the note's.
- Client-side sort: pinned first, then `updatedAt` desc (overrides whatever order the API returns).

### Note drawer (`note-drawer.tsx`)
- Header is a borderless inline-editable `<input>` for the title (`text-[18px] font-semibold`).
- Save state machine: `'idle' | 'saving' | 'saved'`, surfaced as a small label in the header with an amber pulse dot for saving and a green Check for saved.
- Two save triggers:
  - **Title blur** → `handleTitleCommit` → `persist({ title, body: lastBody.current })` (only if title changed).
  - **Body debounce** → 800ms after last keystroke → `persist({ title, body })` (only if body differs from `note.body`).
  - **Body blur** → immediate flush (clears any pending debounce timer).
- Linked-entity combobox uses shadcn `Popover` + `Command` with 4 tabs (Leads/Contacts/Deals/Companies) inside the popover. Selecting an item sends the right `leadId/contactId/dealId/companyId` patch.
- Create mode focuses the title input on mount, then on first save calls `create.mutate({ workspaceId, authorId, title, body, pinned })` and immediately `openDrawer('note', newId)` to swap into edit mode.

### Files view (`files.tsx`)
- `DropZone` is always rendered above the view (large `py-8` variant when empty, compact `p-4` otherwise).
- Upload mock: pushes an `UploadingItem` into local state, runs `requestAnimationFrame` to animate Progress 0→100 over ~1500ms, then calls `create.mutate({ ..., url: \`https://files.pulsecrm.app/${Date.now()}-${name}\` })`.
- In-flight uploads render as either cards (grid view) or rows (list view, full-width colSpan row).
- `fileIconFor()` returns `{ Icon, bg, fg, label }` per mime: purple=image, red=PDF, rose=video, pink=audio, emerald=sheet, amber=slides, blue=doc, slate=other.
- Grid `FileCard` shows an image thumbnail if `image/*` (with `onError` hiding on failure), else a colored icon. Hover overlay shows Preview/Download/Delete actions.
- List view: TanStack Table with sortable Name/Size/Uploaded; dropdown Actions cell.

### File drawer (`file-drawer.tsx`)
- `FilePreview` switches on mime:
  - `image/*` → `<img>` with onError fallback to "Preview not available" + colored icon.
  - `application/pdf` → sandboxed `<iframe>` (height 480px) + "Open in new tab" link.
  - `video/*` → `<video controls>`.
  - `audio/*` → centered Music icon + `<audio controls>`.
  - other → large colored icon + Download CTA.
- Sidebar (240px): metadata rows (name, type badge, mime mono, size, version), uploader (Avatar+relTime), linked-lead button (clickable), copyable URL field (`navigator.clipboard.writeText` + Check feedback), VersionHistory.
- `VersionHistory`: mocked — generates `v1..vCurrent` by subtracting 3 days per version from `createdAt`. "New version" button opens a file picker → 1.5s mock progress → `create.mutate({ ..., version: file.version + 1 })`.

## Lint status

Final: **0 errors, 1 warning**

The single remaining warning is the benign `react-hooks/incompatible-library` notice on `useReactTable()` in `files.tsx` — identical to the same warning in `contacts.tsx` and `deals.tsx`. Accepted project-wide pattern; React Compiler gracefully skips memoizing the table component.

### Lint fixes applied

1. Removed unused `// eslint-disable-line react-hooks/exhaustive-deps` on a `useEffect` in `note-drawer.tsx` (the rule is disabled project-wide).
2. Changed `useCallback` deps from `[workspace?.id, user?.id, create]` to `[workspace, user, create]` in both `note-drawer.tsx` (`handleFirstSave`) and `files.tsx` (`startUpload`) — the React Compiler inferred `workspace`/`user` as deps and flagged the manual memoization mismatch.
3. Removed two `// eslint-disable-next-line @next/next/no-img-element` directives before `<img>` tags in `files.tsx` and `file-drawer.tsx` (rule isn't enabled).

## Constraints honored

- ✅ All 4 files are `'use client'`.
- ✅ No files modified outside the 4 listed.
- ✅ Used existing hooks only (`useNotes`, `useNoteMutations`, `useFiles`, `useFileMutations`, `useLeads`, `useContacts`, `useDeals`, `useCompanies`).
- ✅ File upload is mocked (fake URL `https://files.pulsecrm.app/...`).
- ✅ Used `sonner` for toasts and `lucide-react` for icons throughout.
- ✅ Used existing shadcn/ui primitives only (`Button`, `Input`, `Textarea`, `Badge`, `Skeleton`, `Switch`, `Progress`, `ToggleGroup`, `Table`, `DropdownMenu`, `Popover`, `Command`, `Separator`).
- ✅ Honored existing drawer conventions: `pr-12` header (room for Sheet X), sticky footer with destructive + primary actions, `card-premium` + `shadow-soft` + `view-enter` classes.
- ✅ Framer Motion stagger on card entrances.
- ✅ Drag-and-drop zone with dashed border + primary tint on dragover.

## Hand-off notes

- The `entity-drawer.tsx` shell already imports `NoteDrawer` and `FileDrawer` from the created paths — no shell edits were needed.
- `useFileMutations` only exposes `create` and `remove` (no `update`) — so version bumping in `FileDrawer` creates a brand-new `CRMFile` record with `version: prev + 1` rather than mutating the existing one. This is intentional per the hooks file.
- `fileIconFor()` is duplicated between `files.tsx` and `file-drawer.tsx` to avoid creating a new shared file (task constraint: only the 4 listed files). If a single source of truth is desired, extract to `src/components/crm/shared.tsx`.
- `NoteDrawer` create mode uses `openDrawer('note', newId)` after first save to swap the global drawer state to edit mode — necessary because `id` is captured from props at mount.
