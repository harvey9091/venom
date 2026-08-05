# Task ID: 13 — Build the Settings view for Pulse CRM

**Agent:** full-stack-developer
**Task:** build settings view (`SettingsView`) — 12-section two-pane settings hub
**Date:** 2025

## Summary

Created `/home/z/my-project/src/components/crm/views/settings.tsx` (~1700 lines, `'use client'`), exporting `SettingsView`. The view is a Linear/Stripe-inspired two-pane settings hub: a 220px sticky left nav with 12 sections, and a right pane that renders the active section with Framer Motion fade+slide transitions.

## Architecture

Single file. Module-scope: catalogs (`NAV`, `PLAN_BADGE`, `ROLE_OPTIONS`, `FIELD_TYPES`, `ENTITY_TYPES`, `ACCENT_PRESETS`, `TAG_COLORS`, `STAGE_COLORS`, `NOTIF_EVENTS`, `NOTIF_CHANNELS`, `AUDIT_ACTIONS`, `INTEGRATIONS`) + pure helpers (`slugify`, `csvEscape`, `downloadCSV`, `shortId`, `safeParse`).

Component tree:
- `SettingsView` (root) — `section` state (default `'workspace'`); renders `SettingsSidebar` + `AnimatePresence`-wrapped `<motion.div key={section}>` for fade+slide transitions.
- `SettingsSidebar` — 220px sticky nav with 12 buttons.
- `SettingsHeader` — title + description + actions slot.
- `PremiumCard` — `card-premium bg-card border border-border/60 rounded-xl p-6 shadow-soft`.

## Sections (12)

1. **Workspace** — name / slug (read-only + Info tooltip "Custom domains coming soon") / description / logo URL (image preview + "Set demo URL" button) / plan badge / accent color picker (12 presets + `<input type="color">` + hex mono). Save → `post.mutate({ workspaceId, action: 'updateWorkspace', ...payload })` then `setWorkspace(updated)` to propagate.
2. **Members** — `useSettings('members')` as `Membership[]`; Avatar + name + email + joined date + role `<Select>` + Remove. "Invite member" → `InviteMemberDialog` (email + name + role → `post.mutate({ workspaceId, action: 'inviteMember', ... })`). Role change → `patch.mutate({ action: 'updateMember', id, role })`. Remove → `remove.mutate({ action: 'removeMember', id })`.
3. **Appearance** (THEME ENGINE) — theme gallery (all 14 `THEME_PRESETS` as clickable swatch cards with `ring-2 ring-primary` on selection) + customization panel (accent color, border radius slider 0-24, density segmented, sidebar style segmented, card style segmented, glass intensity slider 0-100, animation speed segmented, font Select) + live preview card showing sample card + buttons + table that reflects the theme in real-time. Reset button at the top.
4. **Pipelines** — `usePipelines()` as `Pipeline[]`; each row shows name + stage count + deal count + default badge + "Edit stages" + delete (disabled for default). Inline stage editor: name + stage list (up/down chevrons, color swatch, name, probability, won/lost Checkboxes, remove X) + "Add stage". Save → `update.mutate({ id, name, stages })`. Create dialog pre-seeds 4 default stages.
5. **Custom Fields** — `useSettings('customFields')` as `CustomField[]`; `<Table>` with Name+key, Entity, Type, Required, Delete. Add field dialog: name + auto-key + entity + type + options (only for select/multiselect) + required checkbox.
6. **Tags** — `useTags()` + `useTagMutations()`; inline create (name Input + color picker + Enter or button). Tag chips with color dot + name + X.
7. **Notifications** — UI only. 4 events × 3 channels `<Switch>` matrix + daily digest toggle + time picker.
8. **Integrations** — 10 mock cards (Slack, Gmail, Outlook, Zoom, Stripe, HubSpot, Intercom, Twilio, OpenAI, Anthropic) with Connect/Connected buttons (local state, toasts).
9. **API Keys** — `useSettings('apiKeys')` as `ApiKey[]`; `<Table>` with Name, Prefix (mono), Created, Last used, Status (active/revoked), Revoke. Create dialog → `post.mutate({ workspaceId, action: 'createApiKey', creatorId: user.id, name })`. On success, raw key revealed ONCE in a dialog with eye toggle + Copy + amber warning.
10. **Audit Logs** — `useSettings('audit')` as `AuditLog[]`; `<Table>` with When, Actor (Avatar), Action badge, Entity (type + short ID), IP (from `meta` JSON via `safeParse`), User agent. Action filter `<Select>`. "Load more" button (increments by 20).
11. **Exports** — 4 cards (Leads / Contacts / Deals / Activities CSV). Each card uses existing `useLeads/useContacts/useDeals/useActivities` hooks, shows count badge, "Download CSV" button calls `downloadCSV(filename, rows)` — builds CSV with proper escaping, wraps in Blob, triggers download via temporary `<a>`.
12. **Danger Zone** — red-bordered card with 3 destructive actions: Transfer ownership (disabled + tooltip "Contact support"), Reset theme (`useThemeStore().reset()`), Delete workspace (`AlertDialog` requiring user to type workspace name → `remove.mutate({ action: 'deleteWorkspace', id: workspace.id })`, toasts "Workspace deleted", no navigation).

## Key implementation choices

- **Theme gallery**: each preset card uses `p.swatch[0]` as the card background (so dark themes look dark) and the name uses `p.dark ? '#fff' : '#111'` for contrast. Selected theme gets `ring-2 ring-primary` + a primary check badge in the top-right corner.
- **Accent color picker**: combines a styled color swatch (`<input type="color">` overlaying a colored span), a hex mono Input, and 6 quick preset swatches — all funnel into `theme.setAccent(value)`.
- **Live preview**: `ThemePreview` renders a `card-premium` sample card with `data-card-style={cfg.cardStyle}` so the same `[data-card-style]` CSS hooks that style the rest of the app apply here too. The `style={{ borderRadius: cfg.radius }}` overrides the card radius inline so users see the slider's effect immediately.
- **Pipeline stage editor**: stages are kept as `Partial<Stage>[]` in local state. The `isWon`/`isLost` Checkboxes are mutually exclusive (toggling one unsets the other). On save, the array is sent as-is; the backend deletes all stages and recreates them in order with fresh IDs.
- **API key reveal**: `post.mutate`'s `onSuccess` reads `data.rawKey` from the API response (the API returns `{ ...apiKey, rawKey }` where `rawKey` is the full `pk_live_<48 hex>` string). The `RevealKeyDialog` shows the raw key with eye toggle + Copy button + amber "you won't see this again" warning. Closing the dialog clears the key — it's gone forever.
- **CSV export**: pure client-side. `csvEscape` wraps values containing commas, quotes, or newlines in double quotes (escaping inner quotes by doubling them per RFC 4180). `downloadCSV` builds the CSV string, wraps it in a `Blob` with `text/csv;charset=utf-8`, and uses a temporary `<a download>` element to trigger the download.
- **Audit log meta**: `meta` may arrive as a JSON string or an object (depending on whether the API's `serialize` JSON.parse'd it). `safeParse` handles both cases.
- **Delete workspace confirmation**: AlertDialog requires `confirmText.trim() === workspace.name`. Submit button is disabled until the match is exact. After deletion, `onSuccess` toasts "Workspace deleted" but does NOT navigate away (per spec — there's no other workspace in this demo).
- **Section transitions**: `AnimatePresence mode="wait"` + `motion.div key={section}` with `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}` — a 200ms fade+slide. The `mode="wait"` ensures the outgoing section finishes before the incoming one starts.

## Lint status

Final: **0 errors, 0 warnings** ✅

### Lint fixes applied

1. Removed `// eslint-disable-next-line @next/next/no-img-element` directive before the `<img>` for the workspace logo preview (rule isn't enabled project-wide — confirmed by checking `eslint.config.mjs`).

## Constraints honored

- ✅ `'use client'` at the top.
- ✅ Only file created: `src/components/crm/views/settings.tsx`. No other files modified (worklog + agent-ctx only).
- ✅ Used existing hooks only (`useSettings`, `useSettingsMutations`, `usePipelines`, `usePipelineMutations`, `useTags`, `useTagMutations`, `useLeads`, `useContacts`, `useDeals`, `useActivities`).
- ✅ Used `useThemeStore` + `THEME_PRESETS` + all setters.
- ✅ Used `useAppStore` (`user`, `workspace`, `setWorkspace`) — `setWorkspace(updated)` is called on workspace save so the rest of the app picks up the new name/accent/logo.
- ✅ Used `sonner` for toasts on every action.
- ✅ Used `lucide-react` for icons throughout.
- ✅ Used `framer-motion` for section transitions (`AnimatePresence mode="wait"`).
- ✅ Used existing shadcn/ui primitives only (`Button`, `Input`, `Label`, `Textarea`, `Badge`, `Skeleton`, `Switch`, `Slider`, `Checkbox`, `Separator`, `ToggleGroup`, `Select`, `Dialog`, `AlertDialog`, `Table`, `Tooltip`).
- ✅ Premium styling: `card-premium` + `shadow-soft` on every card, `view-enter` on the root, consistent `p-6` padding (overridden to `p-0` only for cards wrapping a Table).
- ✅ Sub-components all defined in-file (24 components).
- ✅ Mobile responsive: sidebar collapses to top on small screens (`flex-col md:flex-row`), tables scroll horizontally via shadcn `Table` container, grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

## Hand-off notes for downstream agents

- `useSettings(section)` returns `unknown`-typed `data`. The view casts it inline (`as { data: Membership[]; isLoading: boolean }`) at each call site because the hook is intentionally untyped (matches the pattern in `import.tsx`). If you tighten the hook's typing, drop the casts.
- `MemberRow` reads `member.joinedAt` but falls back to `(member as any).createdAt` if the API ever returns `createdAt` instead. Defensive — the Prisma schema uses `joinedAt` and `serialize` converts Date → ISO string, so `joinedAt` will be present.
- `RevealKeyDialog` reads `data.rawKey` from the `createApiKey` response. The API returns `{ ...apiKey, rawKey }` — the raw key is the full `pk_live_<48 hex chars>` string. It's only shown once; if the user closes the dialog without copying, the key is gone (intentional).
- `ThemePreview` is intentionally simple (card + button + 2-row table) — it reflects `radius`, `cardStyle`, and `density` (via density's `--density-pad` CSS vars that shadcn primitives consume). It does NOT re-render the entire app shell — the real shell already reflects the theme via `applyTheme` called by the `ThemeSwitcher` in the top bar.
- `ExportsSection` calls `useLeads()`, `useContacts()`, `useDeals()`, `useActivities()` simultaneously — these queries are already cached by TanStack Query if the user has visited those views, so opening the Exports section is essentially free.
- `DangerZoneSection`'s delete-workspace button stays on the page after deletion (no navigation) because the spec says "don't actually navigate away since there's no other workspace in this demo." If multi-workspace support is added later, swap the `onSuccess` to navigate after invalidating the bootstrap query.
- `PipelinesSection` stage editor sends `stages` to `PATCH /api/crm/pipelines` — the backend deletes all existing stages then recreates them in order. The `id` field on each stage is included in the payload but ignored by the backend (it generates fresh IDs). Don't try to patch a single stage in place — there's no per-stage endpoint.
- `NotificationsSection` and `IntegrationsSection` are UI-only — there's no backend for either. The notification matrix state lives in `useState` (initialize from a future `useSettings('notifications')` call) and the integrations connection state lives in `useState` (initialize from a future `useSettings('integrations')` call).
- The `CreatePipelineDialog` pre-seeds 4 default stages (New/Qualified/Won/Lost) with sensible colors and probabilities. If you want to let the user customize the initial stages during creation, expand the dialog to include the stage editor (reuse the `PipelineRow` editor logic).
