# Connections Extension

This extension registers the standalone `Connections` application in the left sidebar. It is gated
by the normal `platform_admin:access` permission, so only platform administrators can see or open it.

## Entry Points

- `index.ts`: registers the `Connections` app with three surfaces.
- `Add A New Connection`: dense searchable catalog of backend-synced connection types. Selecting a
  type opens a separate full-width data-source configuration screen.
- `Data Sources`: the configured data-source instance inventory backed by connection instances.
- `Explore`: live query playground for configured data sources.

## Dependencies

- Page implementation is currently shared from `src/extensions/core/apps/connections/ConnectionsPage.tsx`.
- Connection contracts and API clients live under `src/connections/`.
- Connection type sync lives in `src/app/registry/connection-type-sync.ts` and is exposed from
  platform Admin Settings, not from this app.

## Maintenance Constraints

- Keep this app visible through standard app/surface `requiredPermissions`; do not add custom shell
  visibility checks.
- Keep this app focused on user-facing connection workflows: add a data source, list data sources,
  and explore a configured data source. Registry publishing belongs to Admin Settings.
- Do not render or persist secret values. Data sources may display only backend-returned
  `secureFields` indicators.
