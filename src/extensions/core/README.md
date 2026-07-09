# Core Extension

This extension owns the built-in registry entries that ship with Command Center by default.

## Entry Points

- `index.ts`: registers the Workspaces app, the routed Settings catalog, theme presets, and current widget catalog state.
- `apps/`: page surfaces that are owned by the core extension, including Access RBAC and the
  organization-admin surfaces embedded by the routed Settings module.
- `UserCreditsSettingsSection.tsx`: routed Account `Usage Detail` settings section for personal
  credits and billing state.

## Current Responsibilities

- the `Workspaces` app and its local-development workspace builder flows
- the routed `Settings` catalog that unifies account, billing, organization, organization-owned
  application settings, extension-contributed settings, and platform diagnostics without changing
  the existing access gates
- the admin-facing built-in pages now reached through Settings
- the shared Settings `Usage Detail` section for personal credit state
- the live core widget catalog, including the shared `table` and additive `pro-table` widgets
- bundled theme presets that belong to the shell

## Bundled themes

- Core owns the built-in shell presets such as `Sapphire`, `Main Sequence`, `Cyberpunk`,
  and `Neon Mint`.
- Theme registration belongs in `index.ts`; preset definitions belong under `src/themes/presets/`.

## Dependencies

- Core widget source still lives under `src/widgets/core/`.
- This extension currently registers the built-in core widget catalog, including `table` and
  `pro-table`, in the live widget catalog.
- Treat `AppComponent`, `Markdown`, and `Row` as core shell widgets. Their stable widget ids,
  props, and runtime behavior should stay generic and must not be reclassified as Main Sequence
  product widgets.
- In the workspace component browser these widgets should stay grouped under the `Core` category.
- The core app shell composes optional capabilities through the shared registry instead of
  re-owning them locally.

## Maintenance Notes

- Keep core focused on shell-level building blocks and default sample surfaces.
- Core-owned app surfaces now also own assistant-facing summaries and action lists through
  `assistantContext` in `index.ts`; keep that metadata aligned with the real UX when surface
  behavior changes.
- Core renders the shared Settings `Usage Detail` section directly in the routed Settings catalog;
  keep that section user-scoped and separate from organization-admin billing and credit-management
  screens. Its visible route belongs to Account, but its shell-access key remains
  `settings.billing.credits`.
- Workspaces feature implementation lives in `src/features/dashboards/`; keep that folder's
  `README.md` and `docs/workspaces.md` updated when the workspace model or UX changes.
- The `Workspaces` app is feature-flagged at runtime through `VITE_INCLUDE_WORKSPACES`; keep registry behavior and docs aligned if that flag changes scope.
- Optional or vendor-specific capabilities should stay in separate extensions and be composed
  through the registry instead of being re-owned here.
