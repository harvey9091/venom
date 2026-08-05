# Task: venom-lead-drawer — Update Lead Drawer for Venom CRM Phase 2

**Agent:** full-stack-developer
**Task ID:** venom-lead-drawer
**Date:** 2025
**Status:** ✅ Complete — lint passes (0 errors, 0 warnings)

## Summary

Expanded `src/components/crm/views/lead-drawer.tsx` to support the Venom Phase-2 Lead model: 9-status enum, `expectedClose` date picker, `assignedUserId` select, auto-deal info banner, linked-deal chip, and phone-in-header. Used `MultiEdit` only (11 atomic edits, no rewrite). Theme CSS variables only — no hardcoded colors.

## Changes applied

1. **Imports** — added `Popover`/`PopoverTrigger`/`PopoverContent`, `Calendar`, `format` (date-fns), lucide `Calendar as CalendarIcon` + `Link2`.
2. **`LEAD_STATUSES`** — expanded 5 → 9 statuses (`new, contacted, qualified, unqualified, proposal_sent, negotiation, won, lost, archived`) with human-readable labels.
3. **Zod schema** — added `expectedClose: z.string().optional().nullable()` + `assignedUserId: z.string().optional().nullable()`.
4. **Form defaults + `values`** — added `expectedClose: null` + `assignedUserId: null` (create) and `lead.expectedClose ?? null` + `lead.assignedUserId ?? null` (edit).
5. **PATCH/POST payload** — added `expectedClose: values.expectedClose ? new Date(values.expectedClose).toISOString() : null`. `assignedUserId` flows via `...values`.
6. **Header phone** — added a third line (Phone icon + number, `text-[12px] text-muted-foreground`) below the subtitle, only when editing and `lead.phone` exists.
7. **`expectedClose` date picker** — Calendar+Popover field next to `estimatedValue` in the "Lead details" card. Estimated value label changed "(USD)" → "(INR)".
8. **`assignedUserId` select** — "Assigned User" Select after the Owner field, same `members` source + `'unassigned'` sentinel pattern. Company field promoted to `col-span-2`.
9. **Auto-deal banner + Linked Deal chip** — at the top of `OverviewTab` (edit mode only). Sparkles icon + muted message. If `convertedDealId` set, a "Linked Deal" chip button calls `openDrawer('deal', convertedDealId)`.
10. **Currency** — verified header already uses `money()` (₹ INR). No change beyond the label fix.
11. **Prop plumbing** — `OverviewTab` accepts new `convertedDealId?: string | null` prop; parent passes `convertedDealId={lead?.convertedDealId}`.

## Lint

`bunx eslint src/components/crm/views/lead-drawer.tsx` → exit 0, no output. ✅

## Note for downstream agents

The Prisma `Lead` table does NOT yet have `expectedClose` / `assignedUserId` columns (confirmed via `dev.log` Prisma query — SELECT lists only the original 16 columns). The frontend now SENDS these fields in the PATCH payload; they will be silently dropped until the schema is migrated. Frontend is forward-compatible — no further UI changes needed once columns exist.

## Files touched

- `src/components/crm/views/lead-drawer.tsx` (edited via MultiEdit, +~90 lines)
- `worklog.md` (appended entry)
