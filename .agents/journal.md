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

Still missing:
- Keep `Data Node` sidebar-only by product decision. Do not remove its effective compact/sidebar policy from the workspace model.
- Remove the legacy `presentation.exposedFields[*].gridX/gridY/gridW/gridH` fallback path after older stored workspaces have been migrated forward safely.
