# Task 6 — full-stack-developer — CRM-record views + drawers

## What was built

Six `'use client'` files under `/home/z/my-project/src/components/crm/views/`:

| File | Export | LOC | Purpose |
|---|---|---|---|
| `leads.tsx` | `LeadsView` | ~600 | Lead list — Table (TanStack) + Board (Kanban w/ dnd-kit) |
| `contacts.tsx` | `ContactsView` | ~470 | Contact list — Table + Cards grid |
| `companies.tsx` | `CompaniesView` | ~580 | Company list — Table + Cards grid |
| `lead-drawer.tsx` | `LeadDrawer` | ~580 | Slide-over drawer: Overview / Activity / Notes / Files tabs |
| `contact-drawer.tsx` | `ContactDrawer` | ~580 | Same skeleton, contact-specific fields |
| `company-drawer.tsx` | `CompanyDrawer` | ~640 | Same skeleton, company-specific fields + Contacts sub-card |

## Architecture decisions

### Views

- **Header strip pattern** (reused across all 3 views): title + count `Badge` on the left; debounced (300ms) search `Input` + shadcn `Select` filters + primary `New X` `Button` on the right. The whole strip collapses to a column on `< md` and the filter row wraps.
- **Tabs**: shadcn `Tabs` with two views per entity. `Table` for the dense data view, `Board` (leads only) or `Cards` (contacts/companies) for the visual view.
- **Table**: TanStack Table v8 (`getCoreRowModel` + `getSortedRowModel` + `getFilteredRowModel`). Custom `SortableHeader` primitive that toggles asc/desc with ArrowUp/ArrowDown/ArrowUpDown icons. Sticky `TableHeader` with `bg-card/95 backdrop-blur`. Checkbox selection column + bulk-action toolbar (Assign / Tag / Delete — Delete actually mutates, Assign/Tag toast "coming soon" per spec).
- **Board**: `@dnd-kit/core` `DndContext` + `PointerSensor` (6px activation) + `closestCorners`. Five columns (new/contacted/qualified/unqualified/converted). Each card is a `useSortable` component. On drop, calls `useLeadMutations().update.mutate({ id, status })` and toasts.
- **Cards view**: responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` of premium cards with `hover:-translate-y-px hover:shadow-glow` lift.
- **Loading**: 8-row shimmering `Skeleton` mirroring the table layout.
- **Empty**: shared `EmptyState` helper with relevant icon + CTA button.

### Drawers

- **Render context**: My component renders inside the existing `SheetContent` from `entity-drawer.tsx`. The Sheet already provides `overflow-y-auto` + `sm:max-w-[640px]` + a built-in `SheetPrimitive.Close` X button at `top-4 right-4`. My drawer adds `pr-12` to the header to leave room for that X — so the user sees exactly one close button.
- **Form stack**: `react-hook-form` + `zod` via `@hookform/resolvers/zod`. The `values:` option on `useForm` re-syncs the form whenever the fetched entity changes (so opening a different lead updates the form without remounting).
- **Tab layout**: Tabs are sticky `top-0` with a `border-b-2 border-transparent data-[state=active]:border-primary` bottom-border indicator — overrides the default shadcn Tabs trigger pill styling for a cleaner Linear-style underline.
- **Sticky footer**: `sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between`. Delete (destructive ghost, edit mode only) on the left; Cancel + Save/Create (primary) on the right. Create mode calls `onClose()` after success; edit mode toasts and stays open.
- **Tags input**: Simple text `Input` + `Plus` button. Enter key adds the tag. Tags stored as `string[]` and sent as `tags: string[]` in the mutation payload.
- **Owner select**: populated from `useSettings('members')` which returns `Membership[]` with `user` populated. The hook returns `unknown` so I cast locally.
- **Company select**: populated from `useCompanies()`.

### Type-extension pattern

The Company API (`/api/crm/companies/route.ts`) returns `include: { contacts: true }`, but the shared `Company` type in `src/lib/types.ts` does not expose `contacts`. Rather than modify `types.ts` (forbidden by the task constraints), I declared a local `CompanyWithContacts` interface in both `companies.tsx` and `company-drawer.tsx`:

```ts
interface CompanyWithContacts extends Company {
  contacts?: Contact[]
}
```

And cast at the call site: `const typed = companies as CompanyWithContacts[]`.

## Public API

```ts
// src/components/crm/views/leads.tsx
export function LeadsView(): JSX.Element

// src/components/crm/views/contacts.tsx
export function ContactsView(): JSX.Element

// src/components/crm/views/companies.tsx
export function CompaniesView(): JSX.Element

// src/components/crm/views/lead-drawer.tsx
export function LeadDrawer({ id?, mode?, onClose }: {
  id?: string
  mode?: 'create'
  onClose: () => void
}): JSX.Element

// src/components/crm/views/contact-drawer.tsx
export function ContactDrawer({ id?, mode?, onClose }: { ... }): JSX.Element

// src/components/crm/views/company-drawer.tsx
export function CompanyDrawer({ id?, mode?, onClose }: { ... }): JSX.Element
```

## Interactions wired up

| Trigger | Action | Store / hook call |
|---|---|---|
| Header `New X` button | open create drawer | `openDrawer('<entity>-new')` |
| Table row click | open edit drawer | `openDrawer('<entity>', id)` |
| Card click | open edit drawer | `openDrawer('<entity>', id)` |
| Row actions menu → Edit | open edit drawer | `openDrawer('<entity>', id)` |
| Row actions menu → Delete | delete entity | `use<Entity>Mutations().remove.mutate(id)` |
| Bulk toolbar → Delete | delete all selected | `remove.mutate(id)` per row, then clear selection |
| Bulk toolbar → Assign / Tag | toast | `toast.info('Bulk assign — coming soon')` |
| Board card drag-end | change lead status | `useLeadMutations().update.mutate({ id, status })` |
| Drawer Save (create) | create + close | `create.mutate(payload, { onSuccess: onClose })` |
| Drawer Save (edit) | update + toast | `update.mutate({ id, ...payload }, { onSuccess: toast })` |
| Drawer Delete | delete + close | `remove.mutate(id, { onSuccess: onClose })` |
| Drawer Notes → Add note | create note | `useNoteMutations().create.mutate({ <entity>Id, body, pinned: false })` |
| Drawer Files → Upload | create file | `useFileMutations().create.mutate({ <entity>Id, name, mimeType, size, url, version })` |
| Company drawer → contact row click | open contact drawer | `openDrawer('contact', contactId)` |

## Lint status

`bunx eslint src/components/crm/views/leads.tsx src/components/crm/views/contacts.tsx src/components/crm/views/companies.tsx src/components/crm/views/lead-drawer.tsx src/components/crm/views/contact-drawer.tsx src/components/crm/views/company-drawer.tsx`

→ **0 errors, 3 warnings**. All 3 warnings are benign React-Compiler informational notices (`react-hooks/incompatible-library`) about `useReactTable()` from TanStack Table — the React Compiler gracefully skips memoizing components that call it. No actionable code changes needed.

## Files touched

- Created: `src/components/crm/views/leads.tsx`
- Created: `src/components/crm/views/contacts.tsx`
- Created: `src/components/crm/views/companies.tsx`
- Created: `src/components/crm/views/lead-drawer.tsx`
- Created: `src/components/crm/views/contact-drawer.tsx`
- Created: `src/components/crm/views/company-drawer.tsx`
- Modified: `worklog.md` (appended Task 6 entry)
- Modified: none other

## Hand-off notes for downstream agents

- The `useSettings('members')` hook returns `unknown`. I cast it to `Membership[]` locally in `lead-drawer.tsx`. If you reuse this pattern, do the same cast rather than modifying the shared hook.
- The Company API returns `contacts: true` but the shared `Company` type doesn't expose it. I declared a local `CompanyWithContacts` interface in both `companies.tsx` and `company-drawer.tsx` and cast at the call site. If multiple views need this, consider promoting the interface to `types.ts` (would be a one-line change).
- The drawer's sticky tabs use `data-[state=active]:border-primary` bottom-border indicator — overriding the default shadcn Tabs trigger pill styling. Copy the className pattern from this file if you want the same look in other drawers (deal/task/note/file drawers owned by other agents).
- The "X" close button visible to the user is the Sheet's built-in `SheetPrimitive.Close` (from `entity-drawer.tsx`); my drawer content uses `pr-12` on the header to leave room for it. **Don't add your own close button** or you'll get two stacked X icons.
- The bulk-action toolbar's Assign and Tag buttons currently toast "coming soon" rather than implementing real bulk mutation — that's per the task spec. Bulk Delete is fully wired.
- The companies view filters by `industry` using a fixed list of 7 industries. If the workspace has custom industries, the filter dropdown will miss them. The badge coloring falls back to `bg-muted text-muted-foreground` for unknown industries.
- The lead drawer's "Files" tab disables the Upload button when in create mode (`!leadId`), because files need a parent entity ID. The same guard applies to the contact and company drawers.
