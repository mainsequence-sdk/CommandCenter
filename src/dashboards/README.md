# Dashboard Layout

This folder owns the shared dashboard/workspace layout model used by both read-only dashboard
surfaces and the editable workspace studio.

## Entry Points

- `types.ts`: canonical dashboard, widget-instance, and resolved-layout types.
- `layout.ts`: current collision-safe dashboard layout resolver, including collapsible row
  sequencing, sidebar-only widget exclusion from canvas occupancy, and normalized grid resolution.
- `canvas-items.ts`: shared derivation for workspace canvas items that are not just normal widgets,
  including companion-card ids, default companion layouts, and companion candidate resolution.
- `responsive-layout.ts`: width-driven runtime layout adapter for read-only dashboard surfaces. It
  derives effective columns from actual canvas width, applies per-widget minimum widths, and
  repacks items without mutating the saved canonical layout.
- `DashboardControls.tsx`: shared dashboard controls and time-range/refresh coordination.
- `DashboardWidgetRegistry.tsx`: runtime widget-instance registry used for linked-widget
  composition.
- `react-grid-layout-adapter.ts`: adapter utilities for the workspace studio's
  `react-grid-layout`-managed canvas. This file converts resolved dashboard widgets into RGL items,
  converts committed RGL layouts back into widget `position/layout`, and exposes the shared
  draggable handle/cancel selectors used by widget chrome.

## Notes

- The workspace studio now uses `react-grid-layout` for normal on-canvas widgets with vertical
  compaction and handle-only drag/resize commits. The shared dashboard model still stays canonical:
  committed grid layout writes back into widget `position/layout`, then normal dashboard
  materialization re-resolves the full layout.
- The workspace studio itself should not run an extra responsive remap layer during edit
  interactions. Its RGL `cols` and item geometry should stay canonical so resize/drag behavior is
  predictable.
- Row widgets are now first-class grid-managed items. They stay full-width, fixed-height, and
  non-resizable, and they only allow dragging while collapsed.
- Row ownership now follows the current row model: expanded rows are represented by sequence in the
  top-level widget list, while collapsed rows serialize their hidden children into
  `DashboardWidgetInstance.row.children`.
- Companion canvas cards still belong to widget presentation state rather than the dashboard grid
  model, but both the workspace studio and the shared read-only dashboard canvas now materialize
  them as first-class runtime canvas items instead of leaving them as widget-local overlays.
- Responsive viewing is now width-driven rather than breakpoint-authored. Dashboard surfaces keep
  one canonical saved layout, derive effective runtime columns from available canvas width, then
  repack widgets and companion cards while respecting widget minimum widths and preserving the
  authored widget size model.
