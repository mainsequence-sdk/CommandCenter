# Workspace Snapshot

This module implements the client-side live workspace snapshot archive described in the ADR.

## Purpose

- keep the existing JSON workspace export/import flow unchanged
- build a separate live archive from the mounted workspace runtime
- expose that archive to automation through browser state instead of uploading it to the backend by default

## Main Entry Points

- `WorkspaceSnapshotCapture.tsx`: route-driven runtime controller for `snapshot=true`
- `archive.ts`: assembles structured live state, screenshots, graph exports, and ZIP contents
- `capture.ts`: browser-side DOM and SVG to PNG capture helpers; DOM capture now uses
  `html2canvas`, while synthetic SVG reports still rasterize through the local SVG helper
- `zip.ts`: small stored ZIP writer with no extra client dependency
- `types.ts`: archive, live-state, and browser completion contracts

## Behavior

- snapshot mode is intended for the real mounted client runtime, not for the persisted JSON export path
- the workspace edit toolbar also reuses this same controller for a manual `Create snapshot`
  action, so route-driven and in-canvas capture stay on one implementation
- snapshot mode forces the selected workspace into normal dashboard view before capture
- full-canvas screenshots are stitched from scroll tiles so long dashboards capture beyond the
  current viewport instead of relying on one oversized DOM rasterization pass
- the archive includes:
  - `manifest.json`
  - workspace definition JSON
  - live runtime state JSON
  - controls JSON
  - dashboard screenshots, including `full-canvas.png` from the actual workspace canvas root
  - dependency graph JSON and PNG
  - per-widget snapshot files
  - per-widget screenshots when the widget has a visible canvas DOM node
  - per-widget `data.json`, `data.csv`, `chart-data.json`, or `response.json` files when the
    widget snapshot exposes row, series, or response payloads
- `workspace-definition.json` is the normal sanitized JSON workspace export from
  `createWorkspaceSnapshot(...)`, embedded into the live archive unchanged
- `workspace-live-state.json` currently has schema `mainsequence.workspace-agent-live-state` and
  records:
  - live controls state
  - the resolved widget dependency graph
  - one widget record per mounted workspace instance, including title, widget id, placement mode,
    hidden reason, optional layout, optional screenshot path, artifact paths, and the widget's
    structured `WidgetAgentSnapshot`
- widgets without a custom `buildAgentSnapshot(...)` implementation still produce
  `widgets/<instanceId>/snapshot.json` through the generic fallback snapshot builder
- capture profiles are widget-driven:
  - `full-data` lets widget snapshot builders include deeper row/series payloads
  - `evidence` keeps the same structure but allows widgets to truncate data-heavy payloads before
    archive files are written
- the finished archive is exposed on `window.__COMMAND_CENTER_SNAPSHOT__` and announced with the `command-center:snapshot-ready` event

## Constraints

- screenshot capture is best-effort and browser-dependent
- hidden/sidebar widgets are represented through structured snapshot data and the hidden-widget report sheet
- this module does not implement external runner orchestration; it only prepares the client-side capture surface
