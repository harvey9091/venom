# Task: venom-phase4-settings-layout

**Agent:** full-stack-developer
**Task:** Refactor all 13 settings sections in Venom CRM to use the new `SettingsLayout` wrapper for identical spacing (excluding IntegrationsSection)

## Context files read

- `/home/z/my-project/worklog.md` (build history)
- `/home/z/my-project/src/components/crm/views/settings.tsx` (the file being edited — 2572 lines)
  - `SettingsLayout` wrapper at lines 297-314 (renders `<div className="space-y-4"><SettingsHeader .../>{children}</div>`)
  - `SettingsHeader` at lines 261-280
  - `PremiumCard` at lines 282-288

## What changed

All 12 settings sections (every section EXCEPT `IntegrationsSection`, which is being rebuilt separately) were refactored so that their outer wrapper is now `<SettingsLayout title="..." description="..." actions={...}>...</SettingsLayout>` instead of the manual `<div className="space-y-4"><SettingsHeader .../>...</div>` pattern.

### Sections refactored (12 total)

1. **WorkspaceSection** (~line 320)
   - Main return wrapped in `<SettingsLayout title="Workspace" description="Manage your workspace identity, branding, and plan.">`
   - Early return `if (!workspace) return <PremiumCard>...</PremiumCard>` was also wrapped in `<SettingsLayout>` so the header is always present and vertical spacing matches the loaded state — no more "vertical jump" when the skeleton disappears.

2. **MembersSection** (~line 503)
   - Wrapped in `<SettingsLayout>` with `actions={<Button onClick={() => setInviteOpen(true)}>…Invite member</Button>}`

3. **NavigationSection** (~line 701)
   - Wrapped in `<SettingsLayout title="Navigation" description="…">` (no actions)

4. **AppearanceSection** (~line 808)
   - Wrapped in `<SettingsLayout>` with `actions={<Button variant="outline" onClick={() => { theme.reset(); toast.success('Theme reset to defaults') }}>…Reset</Button>}`
   - Manual `<SettingsHeader>` removed; all inner cards (`PremiumCard`, layout grid, live preview) preserved as-is.

5. **PipelinesSection** (~line 1124)
   - Wrapped in `<SettingsLayout>` with `actions={<Button onClick={() => setCreateOpen(true)}>…Create pipeline</Button>}`

6. **CustomFieldsSection** (~line 1417)
   - Wrapped in `<SettingsLayout>` with `actions={<Button onClick={() => setCreateOpen(true)}>…Add field</Button>}`

7. **TagsSection** (~line 1622)
   - Wrapped in `<SettingsLayout title="Tags" description="…">` (no actions)

8. **NotificationsSection** (~line 1734)
   - Wrapped in `<SettingsLayout title="Notifications" description="…">` (no actions)

9. **ApiKeysSection** (~line 1910)
   - Wrapped in `<SettingsLayout>` with `actions={<Button onClick={() => setCreateOpen(true)}>…Create API key</Button>}`
   - Note: ApiKeysSection does NOT have an early component-level return — the `if (!workspace || !user) return` only appears inside the inner `createKey` function. No early-return wrap was needed.

10. **AuditLogsSection** (~line 2129)
    - Wrapped in `<SettingsLayout>` with `actions={<Select>…action filter</Select>}`

11. **ExportsSection** (~line 2227)
    - Wrapped in `<SettingsLayout title="Exports" description="…">` (no actions)

12. **DangerZoneSection** (~line 2358)
    - Wrapped in `<SettingsLayout title="Danger Zone" description="…">` (no actions)

### Sections intentionally NOT touched

- **IntegrationsSection** (~line 1854) — per task instructions, this section will be rebuilt separately. It still uses the old `<div className="space-y-4"><SettingsHeader/></div>` pattern, which is fine because it will be replaced wholesale.

## Constraints honored

- Used only `MultiEdit` (no full file rewrites).
- Did NOT touch `IntegrationsSection`.
- Did NOT change any inner content — only the outer wrapper.
- All forms, mutations, dialogs, action buttons, tables, selects, switches, and toast calls preserved exactly as before.
- The `actions` prop is forwarded where appropriate (MembersSection, AppearanceSection, PipelinesSection, CustomFieldsSection, ApiKeysSection, AuditLogsSection).

## Lint result

`bunx eslint src/components/crm/views/settings.tsx` exits with code 0 — no errors, no warnings.

## Verification

- Final `grep` for `^\s*<SettingsHeader` confirms only TWO matches remain in the file:
  - Line 310 — the one inside the `SettingsLayout` definition itself (correct: the wrapper renders it internally).
  - Line 1865 — inside `IntegrationsSection` (intentionally left untouched).
- Every other section's `return (` now opens with `<SettingsLayout` and closes with `</SettingsLayout>`.
- Spacing is now identical across all sections: `<div className="space-y-4"><SettingsHeader/>{children}</div>` — guaranteed by the single source of truth in `SettingsLayout`.
