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

Workspaces are stored in browser `localStorage` during development.

The current implementation is:

- local to the browser
- scoped by signed-in user id
- draft-aware, with explicit save/reset behavior
- migration-capable for older grid formats

The main persistence code lives in:

- `src/features/dashboards/custom-dashboard-storage.ts`
- `src/features/dashboards/custom-workspace-studio-store.ts`

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
workspace written into local browser storage.

## Favorites

Workspaces support instance-level favorites in addition to the shell's existing surface favorites.

That means users can:

- favorite the `Workspaces` app surface like any other surface
- favorite a specific workspace instance from the workspace table
- open those favorited workspace instances from the global favorites menu

Workspace favorites are stored in shell-local persisted state, then resolved against the current
workspace collection.

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
