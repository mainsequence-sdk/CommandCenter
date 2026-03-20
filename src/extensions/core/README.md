# Core Extension

This extension owns the built-in registry entries that ship with Command Center by default.

## Entry Points

- `index.ts`: registers the default core widgets, apps, and theme presets.
- `apps/`: page surfaces that are owned by the core extension, including Access RBAC and Admin.

## Current Responsibilities

- the `Demo` app and its shipped surfaces
- the `Workspaces` app and its local-development workspace builder flows
- the admin-facing built-in apps
- the default core widget catalog
- bundled theme presets that belong to the shell

## Dependencies

- Core widgets are defined under `src/widgets/core/`.
- Some core dashboards intentionally compose extension-owned widgets, such as the `Demo / Flow Lab`
  surface using the `flow-lab` order-book widget.

## Maintenance Notes

- Keep core focused on shell-level building blocks and default sample surfaces.
- Workspaces feature implementation lives in `src/features/dashboards/`; keep that folder's
  `README.md` and `docs/workspaces.md` updated when the workspace model or UX changes.
- Optional or vendor-specific capabilities should stay in separate extensions and be composed
  through the registry instead of being re-owned here.
