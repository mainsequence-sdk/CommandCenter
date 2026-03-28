# Dashboard Layout

This folder owns the shared dashboard/workspace layout model used by both read-only dashboard
surfaces and the editable workspace studio.

## Entry Points

- `types.ts`: canonical dashboard, widget-instance, and resolved-layout types.
- `layout.ts`: current collision-safe dashboard layout resolver, including Grafana-style row
  sequencing, sidebar-only widget exclusion from canvas occupancy, and normalized grid resolution.
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
- Row widgets are now first-class grid-managed items. They stay full-width, fixed-height, and
  non-resizable, and they only allow dragging while collapsed.
- Row ownership now follows the Grafana pattern: expanded rows are represented by sequence in the
  top-level widget list, while collapsed rows serialize their hidden children into
  `DashboardWidgetInstance.row.children`.
- Companion canvas cards still belong to widget presentation state rather than the dashboard grid
  model, but the workspace studio now materializes them as first-class RGL items from that
  presentation state so they move and resize through the same grid engine as normal widgets.
