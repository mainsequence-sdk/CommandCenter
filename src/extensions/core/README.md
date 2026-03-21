# Core Extension

This extension owns the built-in registry entries that ship with Command Center by default.

## Entry Points

- `index.ts`: registers the core apps, dashboard surfaces, theme presets, and current widget catalog state.
- `apps/`: page surfaces that are owned by the core extension, including Access RBAC and Admin.

## Current Responsibilities

- the `Demo` app and its shipped surfaces
- the `Workspaces` app and its local-development workspace builder flows
- the admin-facing built-in apps
- the live core widget catalog, currently `news-feed` and `workspace-row`
- bundled theme presets that belong to the shell

## Dependencies

- Core widget source still lives under `src/widgets/core/`.
- This extension currently registers `news-feed` and `workspace-row` in the live widget catalog.
- The shipped dashboards now depend on only two registered widget ids:
  `data-node-table-visualizer` from `flow-lab` and `yield-curve-plot` from `main_sequence_markets`.

## Maintenance Notes

- Keep core focused on shell-level building blocks and default sample surfaces.
- Workspaces feature implementation lives in `src/features/dashboards/`; keep that folder's
  `README.md` and `docs/workspaces.md` updated when the workspace model or UX changes.
- Optional or vendor-specific capabilities should stay in separate extensions and be composed
  through the registry instead of being re-owned here.
