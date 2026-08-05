# Task ID: 12 — Build the Automation Builder view for Pulse CRM

**Agent:** full-stack-developer
**Task:** build automations view (`AutomationsView`) — visual no-code builder
**Date:** 2025

## Summary

Created `/home/z/my-project/src/components/crm/views/automations.tsx` (~2100 lines, `'use client'`), exporting `AutomationsView`. The view is a Plane + Zapier-inspired visual no-code automation builder with a two-pane layout: left list of automations + right editor (empty-state with templates OR full graph editor with canvas + palette + inspector + run log).

## Architecture

Single file. Module-scope: catalogs (`TRIGGERS`, `ACTIONS`, `CONDITIONS`, `TEMPLATES`, `MOCK_RUNS`), pure helpers (`nodeSize`, `portPos`, `portsFor`, `bezierPath`, `uid`, `pickNodeIcon`, `renderNodeIcon`, `makeNode`), the `useGraphHistory` hook. Component tree:

- `AutomationsView` (root) — `useAutomations()` + `useAutomationMutations()`; `selectedId` state; renders `AutomationList` (left) + either `AutomationsEmptyState` or `AutomationEditor` (right).
- `AutomationList` → `AutomationListItem` (icon, inline-editable name, trigger label, runs + relTime, enabled Switch, hover edit/delete).
- `AutomationsEmptyState` → 4 `TemplateCard`s (Hot lead routing, Welcome email, Stale lead nudge, Won deal celebration) + CTA.
- `AutomationEditor`:
  - `EditorTopBar` (back, name + description inline inputs, undo/redo, enabled Switch, Run now, Save).
  - Canvas: dotted-grid background that pans/scales with viewport; transformed wrapper div holds the SVG edge layer (bezier paths with arrowhead marker + label rects) + absolutely-positioned `NodeCard`s.
  - `NodeCard` (trigger/condition/action variants; condition uses `clip-path` hexagon; hover toolbar with Copy + X; Framer Motion entrance).
  - `MiniMap` (160×110, viewport indicator, click-to-jump).
  - `ZoomControls` (zoom in/out, %, reset).
  - Right sidebar: `NodePalette` (3 Accordion sections) when nothing selected, `NodeInspector` (type-specific form fields) when a node is selected.
  - `RunLog` (collapsible bottom panel with mock runs).

## Key implementation choices

- **History**: custom `useGraphHistory(initial)` hook with `graph` + `past[]` + `future[]` + `lastCommitted` ref. `live(next)` updates without history (used during drag); `commit(next)` pushes `lastCommitted` to past and sets new committed. Undo/redo swap via functional setState.
- **Drag/pan**: `dragRef` (union of pan/node descriptors) + a single window mousemove/mouseup listener effect. Listeners read the latest viewport/graph from `stateRef.current` (a ref synced in a no-deps useEffect — required by React Compiler's `react-hooks/refs` rule).
- **Zoom toward cursor**: wheel handler computes the new translate so the point under the cursor stays fixed; clamped to [0.5, 2.0].
- **Edge connection**: click an output port → `pendingConn` state + cursor tracking via `onCanvasMouseMove`; click an input port → create edge, commit, toast. Condition-node edges auto-label "true"/"false" based on which output port was used.
- **Node dropping**: click a palette item → armed state with crosshair cursor + top-center banner; click canvas → `makeNode` at click position, commit, select new node.
- **Keyboard**: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Delete / Backspace / Esc — all skipped when focus is in an input/textarea.
- **Templates**: pre-built graphs cloned with fresh IDs; edge `source`/`target` remapped by index (not id) since node IDs are regenerated.

## Lint status

Final: **0 errors, 0 warnings** ✅

### Lint fixes applied

1. **`react-hooks/static-components`** on `const Icon = nodeIcon(node); <Icon />` in `NodeCard` and `NodeInspector`. Refactored to `renderNodeIcon(node, size, className)` helper that calls `React.createElement(pickNodeIcon(node), { size, className })` and returns the element directly — eliminates the `const Icon = fn(); <Icon />` pattern the compiler flagged.
2. **`react-hooks/immutability`** on `deleteNode` / `deleteEdge` referenced inside the keyboard `useEffect` before their source-order declaration. Reordered all handler functions ABOVE the keyboard effect (function declarations are hoisted at runtime, but the compiler's static analysis treats them as TDZ).
3. **`react-hooks/refs`** on `canvasRef.current?.clientWidth` read during render to pass canvas dimensions to `MiniMap`. Added `canvasSize` state updated by a `ResizeObserver` effect.
4. **`react-hooks/refs`** on `stateRef.current = { viewport, graph: history.graph }` written during render. Moved the assignment into a no-deps `useEffect` (standard "latest value ref" pattern).
5. Removed two dead `// eslint-disable-next-line react-hooks/exhaustive-deps` directives (the rule is disabled project-wide).

## Constraints honored

- ✅ `'use client'` at the top.
- ✅ Only file created: `src/components/crm/views/automations.tsx`. No other files modified (worklog + agent-ctx only).
- ✅ Used existing hooks only (`useAutomations`, `useAutomationMutations`, `useAppStore`).
- ✅ Used `sonner` for toasts, `lucide-react` for icons, `framer-motion` for animations.
- ✅ Used existing shadcn/ui primitives only (`Button`, `Input`, `Label`, `Switch`, `Skeleton`, `Badge`, `Textarea`, `Accordion`, `Select`).
- ✅ Sub-components all defined in-file (`NodeCard`, `EdgePath`, `NodePalette`, `NodeInspector`, `MiniMap`, `RunLog`, `ZoomControls`, etc.).
- ✅ Premium styling: `card-premium` + `shadow-soft` on cards, `shadow-glow` on hover-lifted template cards, dotted-grid canvas, primary-tinted node headers, Framer Motion entrance animations, hover toolbar on nodes.

## Hand-off notes for downstream agents

- `useGraphHistory` doesn't coalesce consecutive commits — each discrete mutation pushes one entry to the undo stack. Wrap `updateNodeData` in a debounce + commit pattern if you want to coalesce inspector edits.
- Node positions are clamped to `[0, CANVAS_W-60] × [0, CANVAS_H-60]` (`CANVAS_W=4000`, `CANVAS_H=3000`). Update both constants to grow the canvas.
- `MiniMap` reads `canvasSize` (state from a `ResizeObserver` on the canvas div). The indicator stays correct across resize / tab-switch because the observer fires `update` on the next layout.
- Condition-node edges auto-label "true"/"false" based on which output port was the source (`out-true` → "true", `out-false` → "false"). The label is rendered as a rect+text at the path midpoint. If you change port names, update `EdgePath`'s `srcPort` selection logic.
- The run log uses `MOCK_RUNS` (5 hardcoded rows). When wiring real `AutomationLog` data, the API already includes `logs: { take: 10, orderBy: { createdAt: 'desc' } }` via Prisma — swap `MOCK_RUNS` for `automation.logs || []` (confirm exact shape first).
- Template cloning rebuilds edge source/target by index (position in the template's `nodes` array) — necessary because node IDs are regenerated. Works for any edge arrangement.
- Pending-connection cursor tracking uses `onCanvasMouseMove` → `setPendingCursor` (state update every mousemove while a connection is pending). Acceptable for short connection gestures; throttle if perf becomes an issue.
- The dotted grid uses `hsl(var(--muted-foreground) / 0.18)` — bump to `0.25` for a stronger grid in dark mode.
