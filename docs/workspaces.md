# Workspaces

## Overview

`Workspaces` is the core extension's user-scoped workspace builder.

It is intentionally modeled as an app, not a loose dashboard utility. The app owns one surface,
`Workspaces`, and that surface handles five states:

- workspace index
- workspace canvas
- workspace graph
- widget settings
- workspace settings

The canvas and settings are not separate app destinations. They are views over a selected
workspace instance.

## Route Model

The primary route is:

- `/app/workspace-studio/workspaces`

The entire app is gated by `VITE_INCLUDE_WORKSPACES=true`. When that env flag is set to `false`, the
runtime registry does not expose `workspace-studio`, and direct app routes fall back through the
normal app-resolution redirect path.

State is selected through query params:

- `?workspace=<id>` opens the selected workspace canvas
- `?workspace=<id>&view=graph` opens the workspace graph editor
- `?workspace=<id>&view=settings` opens the settings view for that same workspace
- `?workspace=<id>&view=widget-settings&widget=<instanceId>` opens one widget instance settings view

This keeps the app model simple while still supporting instance-specific editing flows.

## Persistence Model

Workspaces are stored in browser `localStorage` during development by default.

The current implementation is:

- local to the browser
- scoped by signed-in user id
- draft-aware, with explicit save/reset behavior
- migration-capable for older grid formats

If both workspace backend URLs are configured in `config/command-center.yaml`, the studio switches
to backend persistence instead:

- `workspaces.list_url`
- `workspaces.detail_url`
- `workspaces.user_state_list_url`

If the backend validates widget ids against the registered widget catalog, a platform admin must
explicitly publish the current frontend widget registry to:

- `widget_types.sync_url`

That publication no longer happens automatically on normal user sign-in.

Blank, `null`, or `None` values keep the browser-local fallback active.

The main persistence code lives in:

- `src/features/dashboards/custom-dashboard-storage.ts`
- `src/features/dashboards/custom-workspace-studio-store.ts`
- `src/features/dashboards/workspace-api.ts`
- `src/features/dashboards/workspace-persistence.ts`

When the backend uses numeric workspace ids, the frontend normalizes them to strings in the
workspace model and URL state.
In backend mode, workspace creation waits for the backend response and adopts the backend-assigned
id instead of persisting a client-generated id.
The workspace index page uses the backend-backed saved collection as its source of truth in backend
mode only for loaded workspace documents. The list itself now comes from lightweight backend
summary rows, and full workspace detail is fetched on demand when a workspace is opened or copied.
The workspace index intentionally focuses on user-facing metadata and does not expose internal grid
column counts or similar layout-density implementation details.
Collection-level wrapper metadata such as the store `savedAt` timestamp is internal transport
state only and should not be shown as if it belongs to an individual workspace.
In backend mode, the editor keeps a local draft and only persists changes when the user explicitly
saves.
In backend mode, delete reloads the workspace collection from the backend after success instead of
computing the next list locally.
In backend mode, workspace settings also expose a `Permissions` tab backed by the standard
object-sharing endpoints for the workspace object itself. Browser-local workspaces cannot be shared
through RBAC and show an explanatory backend-only message instead.

For the recommended production backend model for shared workspaces, see:

- `docs/workspace-backend-model.md`
- `docs/adr/adr-shared-workspace-state.md`

## Workspace Model

Each workspace is a dashboard-like model with:

- id
- title
- description
- labels
- grid config
- shared dashboard controls state
- widget instances and widget geometry
- widget bindings when a widget instance declares first-class inputs

The persisted workspace document stores widget instances only. Widget definitions such as title,
description, category, settings schema, and IO/binding contracts still come from the runtime widget
registry. Backend validation should therefore rely on the separately published widget-type catalog
instead of expecting `workspace.widgets` to carry full type metadata.
In backend mode, the frontend now treats the shared workspace document and the current user's
runtime/view state as separate concerns:

- `GET workspaces.detail_url`: shared workspace structure only
- `GET workspaces.user_state_list_url?workspace=<id>`: current-user selected controls and widget
  runtime state

The client merges that user state locally after the shared workspace structure is loaded, and
shared workspace saves no longer send selected control values or widget `runtimeState` back to the
main workspace endpoint.

The canvas uses a fine-grained grid and stores widget placement directly in the workspace model.
`Custom` workspaces currently normalize onto one canonical dense manual grid: `48` columns,
`15px` row units, and `8px` visual gutters. Older `12`-, `24`-, and `96`-column custom layouts are
migrated into that model on load so the studio no longer inherits legacy resize steps.
The studio now uses the root `react-grid-layout` v2 API directly through grouped
`gridConfig` / `dragConfig` / `resizeConfig` props instead of the old flat prop surface.
In `custom` edit mode, the editor intentionally uses only the bottom-right `se` resize handle so
width and height resize together from one corner.
Labels are edited in workspace settings as pill chips with enter-to-add behavior.
Widget runtime state can also be stored per instance when the widget reports it through the shared
widget contract.
Widget instances can also persist canonical `bindings` separately from props. Binding changes clear
that widget's runtime state by default so stale upstream-derived caches do not survive rebinding.
Workspace edit mode is not persisted with the workspace document. It is client-side per-workspace
UI state and should survive route changes between the canvas and widget settings for the same
workspace during the current session.
In canvas edit mode, widget cards keep the same header height as normal viewing, use the existing
header area as the drag target, and reveal edit actions on hover instead of adding a separate move
control.
Widget instances may hide their header during normal viewing, but the canvas forces headers visible
again in edit mode so widget controls remain reachable.
Non-row widgets in `custom` can resize down to a single column and a single row; only row widgets
keep the fixed full-width structural sizing rules.
Freshly inserted non-row widgets now all start from one shared workspace footprint instead of
deriving their starting geometry from each widget definition's `defaultSize`.
The canvas `Components` browser supports large widget catalogs with search, category/kind/source
filters, favorites, recent widgets, and grouped category browse when search is empty.
If a workspace still contains a widget id that is no longer available in the current client build,
the canvas explains that the widget is a legacy/unavailable instance and offers a direct delete
action.
Workspace deletion from settings uses the app's destructive confirmation dialog. In backend mode,
the workspace remains in the UI until the backend confirms the delete.
The dedicated widget settings page now also hosts a `Bindings` tab for widgets that declare
dependency inputs, so inter-widget edges are edited separately from normal settings rather than
hidden in raw props JSON. The binding UI is explicit per input: users select both the upstream
widget and the upstream output port, then see the final `output -> input` mapping directly.
Unsaved state is tracked per workspace mutation, not derived by deep-comparing serialized
workspace objects during render. Workspace-scoped pages should therefore use the selected
workspace dirty flag, and reset actions should only revert the current workspace rather than the
entire in-memory collection.
The shared studio store now keeps loaded workspace documents keyed by workspace id instead of
wrapping them in one in-memory collection model. `updateWorkspaceDraft(workspaceId, updater)` is
the standard path for editing one loaded workspace, while `workspaceListItems` remains the
lightweight list/index state and `selectedWorkspaceId` tracks the currently active workspace.
The widget settings route now keeps only the shared dashboard runtime providers alive. It no
longer hidden-mounts the whole workspace widget tree just to make sibling runtime available.
Headless source publication now comes from executable widgets through the shared execution layer,
including `main-sequence-data-node`, which still respects the active workspace time range while
settings are open.
The `dashboard` and `widget-settings` views now also share one mounted workspace studio host.
Opening widget settings keeps the canvas/runtime mounted underneath and shows settings as the
active overlay surface, so returning to the workspace does not trigger a full canvas boot.
The settings shell should appear immediately. Heavy widget-specific configuration such as schema
resolution, upstream preview work, or API discovery now hydrates asynchronously with local loading
states instead of blocking the full overlay.
Opening a workspace should follow the same rule. The client should fetch shared workspace detail
first so the shell and canvas can render as soon as the structure is available, then hydrate
current-user controls/runtime locally from `workspaces.user_state_list_url` and let widgets load
their own data asynchronously. Full-page loading is reserved for the case where there is no usable
shared workspace document yet.
For direct backend routes like `?workspace=<id>`, the client should start from
`GET /workspaces/:id/` immediately instead of waiting for the workspace list to confirm that id
first. A `404` from the detail endpoint is the authoritative "workspace does not exist" signal for
that route. The per-user `workspace-user-states` fetch is secondary hydration only and must not
block the canvas shell.
The workspace graph is a dedicated React Flow view over those same canonical bindings. It renders
all widget instances as nodes, including sidebar-only widgets and collapsed-row children, and lets
users create or remove bindings visually without changing the saved canvas layout. The graph stays
inside the normal Workspaces shell so the standard app navigation remains visible, keeps the shared
dashboard control strip at the top of the page, reuses the same workspace toolbar language and
left widget rail as the canvas, keeps the `Components` drawer available for adding widgets without
leaving graph mode, and adds only a matching return-to-workspace action for graph mode.

## JSON Snapshots

Workspaces can now be exported and recovered through a versioned JSON snapshot from workspace
settings.

The snapshot includes:

- workspace metadata
- labels
- controls state
- grid configuration
- widget layout and props
- widget bindings
- widget runtime state when the widget supports it

The current envelope is `mainsequence.workspace` version `1`.

Import supports two recovery paths:

- create a new workspace from the snapshot
- replace the current workspace draft with the snapshot

Import changes the draft model first. Users still save explicitly if they want the recovered
workspace written to the active persistence target.

In a production backend, this snapshot shape should map to revision/export transport rather than
the primary `Workspace` row itself.

This JSON snapshot is intentionally separate from the live workspace agent snapshot archive. The
JSON export remains the canonical workspace document export/import format, while the agent snapshot
archive is a separate live-runtime zip artifact for automation,
screenshots, graph capture, and widget-output inspection. See
[`docs/adr/adr-live-workspace-agent-snapshot-archive.md`](./adr/adr-live-workspace-agent-snapshot-archive.md).

## Live Agent Snapshot Archive

The live workspace agent snapshot archive is a different artifact from the JSON export.

Its purpose is to capture what the mounted workspace runtime is actually showing, including:

- current workspace view and controls
- widget relationship graph
- screenshots
- hidden/sidebar/collapsed widget content
- per-widget structured live summaries
- optional raw data exports for large data widgets

The current trigger model is the snapshot route:

- `/app/workspace-studio/workspaces?workspace=<id>&snapshot=true`

This route is still a normal SPA route, not an API endpoint. The archive is generated by the real
client runtime in a browser engine.

The current client-side behavior is:

- snapshot mode forces the selected workspace into dashboard view
- the mounted runtime waits for widgets to settle
- the client captures structured widget snapshots plus PNG artifacts
- the client assembles one zip archive locally
- the archive is exposed on `window.__COMMAND_CENTER_SNAPSHOT__`
- the client dispatches `command-center:snapshot-ready`
- the workspace edit toolbar also exposes `Create snapshot`, which triggers the same archive
  pipeline from the currently open workspace and downloads the generated zip directly

Authentication for this flow reuses the existing local-storage JWT session contract instead of
inventing a second snapshot-only auth model.

The current archive includes:

- `manifest.json`
- `workspace-definition.json`
- `workspace-live-state.json`
- `controls.json`
- `relationships/widget-graph.json`
- `relationships/widget-graph.png`
- `screenshots/viewport.png`
- `screenshots/full-canvas.png` from the actual workspace canvas root
- `screenshots/hidden-widgets-sheet.png`
- `widgets/<instanceId>/snapshot.json`
- `widgets/<instanceId>/screenshot.png` when DOM capture succeeds
- widget data exports such as `data.json`, `data.csv`, `chart-data.json`, or `response.json` when
  the widget snapshot exposes that content

The important structure is:

- `workspace-definition.json`
  - the normal sanitized JSON workspace snapshot from `createWorkspaceSnapshot(...)`
- `workspace-live-state.json`
  - schema: `mainsequence.workspace-agent-live-state`
  - current live controls
  - resolved dependency graph
  - one widget record per workspace instance, including hidden/sidebar state, optional layout,
    screenshot path, artifact paths, and the widget's structured live snapshot
- `manifest.json`
  - schema: `mainsequence.workspace-agent-archive`
  - capture profile
  - warnings and errors
  - one manifest entry per file with media type, byte size, and description

Per-widget snapshot behavior is intentionally conditional:

- every widget gets `widgets/<instanceId>/snapshot.json`
- widgets with visible canvas DOM also get `widgets/<instanceId>/screenshot.png`
- widgets that expose rows, series, or response payloads through `buildAgentSnapshot(...)` may also
  emit `data.json`, `data.csv`, `chart-data.json`, or `response.json`
- widgets without a custom snapshot builder still emit a generic fallback snapshot with rendered
  text summary when available

The capture profile controls how much widget data is included:

- `snapshotProfile=full-data`
  - allows widget snapshot builders to include deeper row/series payloads
- `snapshotProfile=evidence`
  - keeps the same archive structure but allows widgets to truncate large data-heavy payloads

The existing JSON export/import flow remains unchanged and is still the canonical persisted
workspace document transport.

## Favorites

Workspaces support instance-level favorites in addition to the shell's existing surface favorites.

That means users can:

- favorite the `Workspaces` app surface like any other surface
- favorite a specific workspace instance from the workspace table
- open those favorited workspace instances from the global favorites menu

Workspace favorites are stored in shell-local persisted state, then resolved against the current
workspace collection.

## Copying Workspaces

The workspace index also exposes a direct `Copy` action for each workspace row.

Copy works by cloning the current workspace document into a fresh workspace instance and then
routing through the normal create flow:

- local mode creates a new browser-local workspace
- backend mode first hydrates the source workspace detail on demand, then issues a normal
  workspace create request so the copy is stored as a new backend workspace rather than updating
  the original one

The copied workspace gets a fresh workspace id and a default title prefixed with `Copy of`.

## Recommended Production Split

For shared workspaces, the recommended backend split is:

- shared workspace content in `Workspace`
- direct and team access in object-level grant tables
- per-user temporary viewing state in `WorkspaceUserState`
- immutable snapshots in `WorkspaceRevision`

That split exists because a shared editable workspace should still avoid collaboration conflicts on
temporary interactions such as:

- zoom / pan
- selected date range
- selected refresh interval
- selected graph node

## Main Entry Points

- `src/features/dashboards/WorkspacesPage.tsx`
- `src/features/dashboards/CustomDashboardStudioPage.tsx`
- `src/features/dashboards/CustomWorkspaceGraphPage.tsx`
- `src/features/dashboards/CustomWorkspaceSettingsPage.tsx`
- `src/features/dashboards/useCustomWorkspaceStudio.ts`

The app registration lives in:

- `src/extensions/core/index.ts`

## Maintenance Notes

Update this page whenever any of the following change:

- route/query-param model
- local-storage schema or migration behavior
- JSON snapshot schema or import/export behavior
- favorites behavior
- workspace list, canvas, or settings ownership boundaries
- saved control state or widget layout behavior

Keep `src/features/dashboards/README.md` aligned with this page so code-local docs and product docs
do not drift.
