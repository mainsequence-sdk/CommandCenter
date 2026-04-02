# Dashboard Layout

This folder owns the shared dashboard/workspace layout model used by both read-only dashboard
surfaces and the editable workspace studio.

## Entry Points

- `types.ts`: canonical dashboard, widget-instance, and resolved-layout types.
- `layout.ts`: current collision-safe dashboard layout resolver, including collapsible row
  sequencing, sidebar-only widget exclusion from canvas occupancy, and normalized grid resolution.
- `canvas-items.ts`: shared derivation for workspace canvas items that are not just normal widgets,
  including companion-card ids, dashboard-owned companion layout resolution, legacy presentation
  fallback, and companion candidate resolution.
- `responsive-layout.ts`: shared responsive layout helpers. It builds the Grafana-style
  `grid-template-columns` string for Auto grid and also provides the temporary runtime rewrite used
  when `custom` dashboards collapse to full-width cards on smaller screens.
- `DashboardControls.tsx`: shared dashboard controls and time-range/refresh coordination.
- `DashboardWidgetRegistry.tsx`: runtime widget-instance registry used for linked-widget
  composition.
- `widget-dependencies.ts`: shared binding normalization, resolved-input resolution, and static
  dependency-graph extraction. It also owns graph-connection parsing, validation, and canonical
  binding add/remove helpers so visual graph editors do not duplicate semantics.
- `DashboardWidgetDependencies.tsx`: React provider/hooks layer that exposes resolved widget
  inputs and dependency diagnostics on top of the raw widget registry.
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
- The workspace studio now drives the root `react-grid-layout` v2 component through grouped
  `gridConfig`, `dragConfig`, `resizeConfig`, and `compactor` props. The studio should not hide
  that API behind `any` casts again.
- The custom workspace editor intentionally exposes only the bottom-right `se` resize handle.
  Combined width+height resize from one corner is part of the current interaction contract.
- `custom` currently uses one canonical dense manual grid: `48` columns, `15px` row units, and
  `8px` visual gutters. Older `12`-, `24`-, and `96`-column workspace layouts are normalized into
  that model when they are loaded, so the editor no longer inherits legacy fine-grid sizing.
- Dashboard definitions now carry a backward-compatible `layoutKind`, defaulting existing
  dashboards to `custom`.
- Dashboard definitions now also carry `companions`, which are first-class layout items for exposed
  companion cards. Older workspaces that only stored companion geometry in widget presentation are
  normalized into this dashboard-owned shape on load.
- `auto-grid` now has an initial rules-based config contract on the dashboard model:
  `maxColumns`, `minColumnWidthPx`, `rowHeight`, and `fillScreen`. Runtime placement is computed
  from widget order plus the layout-level grid rules, rather than saved widget coordinates.
- Row widgets are now first-class grid-managed items. They stay full-width, fixed-height, and
  non-resizable, and they only allow dragging while collapsed.
- Row ownership now follows the current row model: expanded rows are represented by sequence in the
  top-level widget list, while collapsed rows serialize their hidden children into
  `DashboardWidgetInstance.row.children`.
- Companion canvas cards are now dashboard-owned layout items rather than presentation-owned grid
  geometry. Widget presentation still owns exposure/visibility, but committed companion placement
  lives in the dashboard model so both `custom` and `auto-grid` can treat companions as real
  canvas items.
- Dashboard widget instances can now also carry canonical `bindings` separately from widget props.
  This is the first-class graph-edge model for widget composition and should remain distinct from
  widget-local configuration.
- The dependency layer is intentionally separate from `DashboardWidgetRegistryProvider`. The raw
  registry remains the mounted-widget index, while the dependency provider adds graph extraction,
  canonical binding validation, and optional resolved inputs on top.
- The route-level workspace graph editor must stay on top of this dependency layer. React Flow owns
  node/edge rendering and local node positions there, but binding validation and canonical binding
  mutation rules stay centralized in `widget-dependencies.ts`.
- Auto grid now uses Grafana-style CSS Grid behavior. `maxColumns` is an upper bound, not a fixed
  reserved set of slots. The container uses `repeat(auto-fit, minmax(..., 1fr))`, so empty tracks
  collapse naturally:
  1 item fills the row, 2 items render as 2 equal columns, and so on up to `maxColumns`.
- `custom` now also has a Grafana-style mobile runtime rewrite. Below the shared `769px`
  breakpoint, runtime rendering keeps each item height but temporarily rewrites the layout so every
  item spans the full dashboard width. That rewrite is view/runtime only and must never be written
  back into saved widget geometry.
- In the workspace studio, Auto grid is still a rules-based layout, but edit mode now allows
  order-only drag reordering. That reorder updates dashboard widget sequence without writing custom
  `x/y/w/h` geometry back into the Auto grid mode.
- In the workspace studio, `custom` drag/resize is disabled under that same small-screen breakpoint
  so the temporary full-width runtime layout is not accidentally committed back into the canonical
  saved layout.
- Row widgets remain full-width items in Auto grid through `grid-column: 1 / -1`.
- `custom` should mean explicit saved layout semantics. Responsive or rules-based behavior should
  be introduced under a separate `auto-grid` mode instead of changing what `custom` means.
- Current limitation: `auto-grid` is now layout-rule driven, but it is still a top-level mode
  only. Rows are still special full-width items, and there is not yet a nested layout-mode system
  like Grafana rows/tabs.
