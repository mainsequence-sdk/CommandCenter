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
  create form opens as its own full-width configuration screen. After a successful create, the app
  redirects to the Data Sources list so the new backend-owned instance appears in the normal
  operator-facing table instead of leaving the user on the creation form.
- The Data Sources and Explore surfaces read backend-owned connection instances through
  `src/connections/api.ts`. If the backend returns no instances, the UI shows no data sources.
- New connection instances rely on backend-assigned `id` values. The create form must not ask the
  user for a custom identifier.
- The Data Sources list keeps backend `id` values out of the main operator-facing table. IDs stay
  available in edit/detail flows, but the list should emphasize the user-facing name, type, health,
  and secret metadata.
- The generic Explore surface uses `src/connections/ConnectionQueryWorkbench.tsx`, matching the
  workspace Connection Query widget settings path for connection path selection, typed query
  editors, generated request preview, test execution, and normalized frame preview.
- The data-source edit/detail screen supports deleting one backend-owned connection instance
  through a confirmation modal before returning to the list.
- The Explore surface renders a shared health-test action next to the selected data source before
  any connector-specific Explore shell, so all Explore views can validate backend connection health
  through the same `testConnection` route.
- The Explore surface also renders a shared connection detail panel. It is opened from the selected
  data-source header and shows instance metadata, connection type description, query models,
  examples, and the Markdown `usageGuidance` published by the connection definition.
- Registry publishing is owned by Admin Settings through
  `src/app/registry/connection-type-sync.ts`.
- Local fallback records are not part of this app. Data Sources and Explore show only instances
  returned by the backend.

## Maintenance Constraints

- Keep this app platform-admin only through normal `AppDefinition.requiredPermissions` and surface
  permissions in the standalone Connections extension. Do not add custom shell visibility hacks.
- Do not render or persist secret values. The UI may display only `secureFields` indicators.
