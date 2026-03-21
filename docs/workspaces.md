# Workspaces

## Overview

`Workspaces` is the core extension's user-scoped workspace builder.

It is intentionally modeled as an app, not a loose dashboard utility. The app owns one surface,
`Workspaces`, and that surface handles three states:

- workspace index
- workspace canvas
- workspace settings

The canvas and settings are not separate app destinations. They are views over a selected
workspace instance.

## Route Model

The primary route is:

- `/app/workspace-studio/workspaces`

State is selected through query params:

- `?workspace=<id>` opens the selected workspace canvas
- `?workspace=<id>&view=settings` opens the settings view for that same workspace

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
mode rather than rendering the current draft collection.
In backend mode, the editor autosaves changes to the backend and does not expose save/reset draft
controls.
In backend mode, delete reloads the workspace collection from the backend after success instead of
computing the next list locally.

For the recommended production backend model for shared workspaces, see:

- `docs/workspace-backend-model.md`
- `docs/adr-shared-workspace-state.md`

## Workspace Model

Each workspace is a dashboard-like model with:

- id
- title
- description
- labels
- grid config
- shared dashboard controls state
- widget instances and widget geometry

The canvas uses a fine-grained grid and stores widget placement directly in the workspace model.
Labels are edited in workspace settings as pill chips with enter-to-add behavior.
Widget runtime state can also be stored per instance when the widget reports it through the shared
widget contract.
In canvas edit mode, widget cards keep the same header height as normal viewing, use the existing
header area as the drag target, and reveal edit actions on hover instead of adding a separate move
control.
Widget instances may hide their header during normal viewing, but the canvas forces headers visible
again in edit mode so widget controls remain reachable.
The canvas `Components` browser supports large widget catalogs with search, category/kind/source
filters, favorites, recent widgets, and grouped category browse when search is empty.
If a workspace still contains a widget id that is no longer available in the current client build,
the canvas explains that the widget is a legacy/unavailable instance and offers a direct delete
action.
Workspace deletion from settings uses the app's destructive confirmation dialog. In backend mode,
the workspace remains in the UI until the backend confirms the delete.

## JSON Snapshots

Workspaces can now be exported and recovered through a versioned JSON snapshot from workspace
settings.

The snapshot includes:

- workspace metadata
- labels
- controls state
- grid configuration
- widget layout and props
- widget runtime state when the widget supports it

The current envelope is `mainsequence.workspace` version `1`.

Import supports two recovery paths:

- create a new workspace from the snapshot
- replace the current workspace draft with the snapshot

Import changes the draft model first. Users still save explicitly if they want the recovered
workspace written to the active persistence target.

In a production backend, this snapshot shape should map to revision/export transport rather than
the primary `Workspace` row itself.

## Favorites

Workspaces support instance-level favorites in addition to the shell's existing surface favorites.

That means users can:

- favorite the `Workspaces` app surface like any other surface
- favorite a specific workspace instance from the workspace table
- open those favorited workspace instances from the global favorites menu

Workspace favorites are stored in shell-local persisted state, then resolved against the current
workspace collection.

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
