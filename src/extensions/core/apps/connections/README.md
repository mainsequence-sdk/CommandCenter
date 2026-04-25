# Core Connections App

This directory owns shared page implementation for the platform Connections app. The app is
registered by `src/extensions/connections/index.ts` as a standalone extension gated by the existing
`platform_admin:access` permission.

## Entry Points

- `ConnectionsPage.tsx`: shared page implementation and surface-specific wrappers for adding,
  listing, and exploring connection-backed data sources.

## Behavior

- The Add New surface reads only backend-synced active connection types. Local frontend connection
  definitions are not shown there until Admin Settings publishes them to the backend registry.
- Add New is a two-step workflow: users first choose a connection type from the catalog, then the
  create form opens as its own full-width configuration screen.
- The Data Sources and Explore surfaces read backend-owned connection instances through
  `src/connections/api.ts`. If the backend returns no instances, the UI shows no data sources.
- The generic Explore surface uses `src/connections/ConnectionQueryWorkbench.tsx`, matching the
  workspace Connection Query widget settings path for connection path selection, typed query
  editors, generated request preview, test execution, and normalized frame preview.
- Registry publishing is owned by Admin Settings through
  `src/app/registry/connection-type-sync.ts`.
- Local fallback records are not part of this app. Data Sources and Explore show only instances
  returned by the backend.

## Maintenance Constraints

- Keep this app platform-admin only through normal `AppDefinition.requiredPermissions` and surface
  permissions in the standalone Connections extension. Do not add custom shell visibility hacks.
- Do not render or persist secret values. The UI may display only `secureFields` indicators.
