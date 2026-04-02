# Workspace ADR Journal

## 2026-03-29

### ADR: Dashboard Layout Modes Baseline

Status: accepted

Decision:
- Treat existing dashboards/workspaces as `custom` layout by default.
- `custom` means canonical saved `x/y/w/h` semantics.
- The workspace studio must use one canonical `react-grid-layout` layout in both view and edit.
- Read-only dashboard surfaces must not reinterpret `custom` through proportional responsive repacking.
- Future responsive/rules-based behavior should be introduced as `auto-grid`, not by changing `custom`.

Implemented:
- Added backward-compatible `layoutKind` support to the shared dashboard model.
- Defaulted existing normalized dashboards/workspaces to `layoutKind: "custom"`.
- Changed `DashboardCanvas` so `custom` layouts render from canonical saved geometry instead of the width-driven repacker.
- Updated local dashboard/workspace READMEs to document the new baseline.
- Added an initial `auto-grid` config contract: `maxColumns`, `minColumnWidthPx`, and `rowHeight`.
- Added workspace settings controls for `Custom` vs `Auto grid`.
- Wired both read-only dashboards and the workspace studio to respect `layoutKind`.
- In the workspace studio, `auto-grid` is rules-based and does not allow manual drag/resize.
- Promoted companion-card layout into the dashboard model through `DashboardDefinition.companions`.
- Added backward-compatible normalization so older workspaces that only stored companion geometry in widget presentation still load into the new dashboard-owned companion layout model.
- Changed both the shared dashboard viewer and the workspace studio to read/write companion-card geometry from the dashboard model instead of persisting new geometry into widget presentation state.
- Reworked `auto-grid` to use deterministic order-based packing from dashboard-level rules instead of scaling legacy `x` positions from custom layout geometry.
- Added initial `fillScreen` support on Auto grid so the canvas can expand to fill more of the viewport when requested.
- Fixed the dedicated workspace settings page so it scrolls like the widget settings page instead of trapping long content.
- Simplified `auto-grid` again after the first pass proved too hybrid: it now uses only layout-level rules (`maxColumns`, `minColumnWidthPx`, `rowHeight`, `fillScreen`), removes item-level span presets, and lets the number of columns reduce naturally as canvas width shrinks.
- Tightened the simplified Auto grid rule so the active column count is capped by visible item count as well as `maxColumns`. This avoids stranding two widgets inside a four-column grid and keeps sparse rows visually filled.
- Replaced the JS Auto grid packer with a Grafana-style CSS Grid renderer. `custom` stays on canonical RGL and saved `x/y/w/h`, while `auto-grid` now renders through CSS Grid `auto-fit` template columns in both the viewer and the workspace studio. Auto grid width is no longer derived from saved widget geometry or a JS placement algorithm.
- Kept `custom` on the canonical RGL path and added order-only drag reordering for `auto-grid` in edit mode. Auto grid still does not allow manual resize or free placement, but widgets can now be reordered by drag without reintroducing custom geometry rules.
- Moved the workspace canvas controls bar out of the old floating overlay card and into the scrollable canvas flow as a straight sticky strip, so it no longer hovers over the left rail/sidebar area.
- Normalized widget definition sizing behind a shared platform default through `defineWidget(...)`.
  Normal content widgets now inherit one canonical default size, while structural exceptions such
  as the workspace row keep an explicit override. Route/app-owned surfaces remain responsible for
  their own local size overrides.
- Added a shared `custom` small-screen runtime rewrite modeled on Grafana. Below the shared
  `769px` breakpoint, `custom` dashboards/workspaces temporarily render every item full width while
  preserving stored row spans. The workspace studio now also disables `custom` drag/resize under
  that breakpoint so the mobile rewrite never gets committed back into saved layout geometry.
- Fixed shell kiosk eligibility for the workspace canvas. `AppShell` now keeps kiosk mode active
  on `/app/workspace-studio/workspaces?workspace=...` canvas routes instead of immediately
  resetting it because the surface is registered as a `page`. Workspace list and settings routes
  still exit kiosk mode.
- Fixed the kiosk full-bleed container path for the workspace canvas. Even when kiosk is active,
  the workspace canvas route now stays on the full-height, zero-padding shell container instead of
  falling back to the generic padded page layout, which was causing the workspace canvas to render
  as effectively blank.
- Added a backend-only `Permissions` tab to workspace settings. The tab reuses
  `MainSequencePermissionsTab` against the workspace collection endpoint root so Workspaces can use
  the same standard object-sharing API contract as Resource Releases and Teams. The shared
  permissions helpers now accept string or numeric object ids, which matches the frontend's
  normalized workspace id model.
- Added a direct `Copy` action to the workspace index. It clones the selected workspace through the
  existing snapshot/restore helpers to guarantee a fresh workspace id, then routes through the
  normal workspace create flow so backend persistence creates a new workspace instance instead of
  modifying the source workspace.
- Added a new Markets `Curve Plot` widget registered from `extensions/main_sequence/extensions/markets/`.
  The widget uses TradingView Lightweight Charts `createYieldCurveChart(...)` and follows the Main
  Sequence widget pattern of consuming rows from a linked `Data Node` widget instead of creating a
  second data-source contract. The first pass keeps the Markets widget on top of the existing
  Workbench DataNode-source helpers; if more Markets widgets need that same contract, that shared
  layer should be moved into `extensions/main_sequence/common/`.
- Extended the Markets `Curve Plot` widget with a dedicated `Curve Data Node` mode. When enabled,
  the widget assumes the linked dataset uses the compressed curve contract
  (`time_index`, `unique_identifier`, `curve`) and decompresses the `curve` payload from
  Base64 + gzip + JSON before turning it into plotted maturity/value points.
- Tightened the Markets `Curve Plot` formatting path so compressed curve maturities render as clean
  whole day/month/year tenors instead of long fractional labels, and documented that curve values
  are already treated as percent values with no `* 100` or `/ 100` scaling inside the widget.
- Simplified the `Curve Plot` maturity axis again so the rendered tenors now snap to whole
  `M` or `Y` labels only, avoiding fractional or compound labels on the yield-curve x-axis.
- Split the experimental compressed-curve mode out of `Curve Plot`. `Curve Plot` settings now
  expose only the generic mapped maturity/value flow again, while the new `Zero Curve` widget owns
  the Main Sequence compressed curve contract (`time_index`, `unique_identifier`, `curve`) and
  renders it with ECharts on a numeric days axis.
- Corrected the `Zero Curve` rate interpretation. The widget now converts decompressed curve values
  from decimal-rate input into percent values before plotting, which fixes the chart output that
  was rendering 100x too small when the raw payload was displayed directly.
- Reworked `Zero Curve` visual encoding so one `unique_identifier` keeps one stable hue across time
  while `time_index` progression is expressed through alpha and line weight. Point markers are now
  disabled by default to keep dense zero-curve histories readable.
- Tightened `Zero Curve` again for dense histories: tooltips are now item-scoped instead of
  axis-scoped, latest snapshots render noticeably thicker, and older snapshots fade much further
  into the background so the current curve is visually dominant.
- Replaced the temporary `Zero Curve` min/max overlay with a top-left observation window summary
  (`From` / `To`) derived from the rendered `time_index` range, which is more appropriate for a
  historical zero-curve viewer.
- Simplified `Zero Curve` family styling again: historical snapshots no longer use an alpha
  gradient by recency. They now share one uniform low-alpha treatment, while only the latest
  snapshot remains fully opaque and visually dominant.
- Fixed `Zero Curve` hover metadata by embedding each point's `time_index` label directly in the
  ECharts line-series data payload. Tooltips no longer depend only on series-index lookup to show
  the curve date.
- Corrected `Data Node Table` heatmap rendering so heatmap columns now tint the full cell by
  normalized value intensity instead of drawing a left-to-right gradient that visually behaved more
  like a decorative bar than a real heat map.

Still missing:
- Keep `Data Node` sidebar-only by product decision. Do not remove its effective compact/sidebar policy from the workspace model.
- Remove the legacy `presentation.exposedFields[*].gridX/gridY/gridW/gridH` fallback path after older stored workspaces have been migrated forward safely.
