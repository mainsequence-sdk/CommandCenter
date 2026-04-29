# Workspace Snapshot

This module implements the client-side live workspace snapshot archive described in the ADR.

## Purpose

- keep the existing JSON workspace export/import flow unchanged
- build a separate agent-facing live archive from the mounted workspace runtime
- expose that archive to automation through browser state instead of uploading it to the backend by default

## Main Entry Points

- `WorkspaceSnapshotCapture.tsx`: route-driven runtime controller for `snapshot=true`
- `archive.ts`: assembles workspace context, per-widget agent snapshots, and ZIP contents
- `zip.ts`: small stored ZIP writer with no extra client dependency
- `types.ts`: archive, live-state, and browser completion contracts

## Behavior

- snapshot mode is intended for the real mounted client runtime, not for the persisted JSON export path
- the workspace edit toolbar also reuses this same controller for a manual `Create snapshot`
  action, so route-driven and in-canvas capture stay on one implementation
- snapshot mode forces the selected workspace into normal dashboard view before capture
- snapshot mode expands collapsed workspace rows in the mounted runtime by default so row-owned
  widgets are rendered as normal canvas widgets during capture; this is runtime-only and is not
  saved back to workspace persistence
- snapshot mode does not call the dashboard refresh button or create a special refresh cycle by
  itself; it mounts the normal dashboard runtime and observes the execution state that runtime
  owns
- on a fresh mount, the shared `DashboardWidgetExecutionProvider` may run its normal initial
  refresh for refresh-eligible widgets; snapshot capture waits for active refresh/execution work to
  settle before assembling the archive
- the settled-state check watches `activeRefreshCycleId` and per-widget `running` execution states,
  with a bounded timeout, then captures the current mounted runtime state
- browser automation should scroll `[data-workspace-canvas-scroll-container="true"]`, not
  `window` or `document.body`; `[data-workspace-canvas-content="true"]` marks the inner content
  root when a runner needs to measure the full rendered workspace height
- the archive is JSON-only; it does not generate screenshots, rendered graph images, hidden-widget
  report images, or CSV/text exports
- the archive includes:
  - per-widget snapshot files
- widgets without a custom `buildAgentSnapshot(...)` implementation still produce
  `widgets/<instanceId>/snapshot.json` through the generic fallback snapshot builder
- passthrough infrastructure widgets such as connection sources and transformers should emit
  metadata-only snapshots and must not dump transported datasets as agent-facing payloads
- there is one agent-oriented snapshot contract only; the runtime no longer switches between
  `evidence` and `full-data` profile variants
- the finished archive is exposed on `window.__COMMAND_CENTER_SNAPSHOT__` and announced with the
  `command-center:snapshot-ready` event; external runners must inspect `status` because the same
  event is also emitted for `running` and `error` states

## Constraints

- hidden/sidebar widgets are represented through structured snapshot data only
- this module does not implement external runner orchestration; it only prepares the client-side capture surface
