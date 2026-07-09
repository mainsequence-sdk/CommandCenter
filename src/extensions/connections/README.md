# Connections Extension

This extension registers the standalone `Connections` application in the left sidebar. Runtime
visibility is controlled by the backend shell-access response; users only see it when the backend
returns the `connections` app and its surfaces.

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

- Keep this app visible only through backend shell access; do not add custom frontend shell
  visibility checks or local permission fallbacks.
- Keep this app focused on user-facing connection workflows: add a data source, list data sources,
  and explore a configured data source. Registry publishing belongs to Admin Settings.
- Do not render or persist secret values. Data sources may display only backend-returned
  `secureFields` indicators.
