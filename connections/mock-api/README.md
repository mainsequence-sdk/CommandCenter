# Mock API Connection

This module registers the frontend-only `command_center.mock_api` connection type. It provides one
always-available local connection instance that lets users paste JSON and run it through the normal
connection-query authoring and preview surfaces without publishing a backend data source.

## Entry Points

- `index.ts`: exports the local-only connection type definition from `src/connections/mock-api.ts`.
- `src/connections/mock-api.ts`: owns registry metadata, usage guidance, query model metadata, and
  the local-only sync marker.
- `src/connections/mock-api-contract.ts`: owns the sentinel instance id, local health behavior,
  local query execution, and JSON-to-frame normalization.
- `src/connections/MockApiConnectionQueryEditor.tsx`: renders the query editor where users paste
  JSON, choose response mode, simulate status, and simulate latency.

## Behavior

- The type is marked `registrySync: "local-only"` and is excluded from backend connection-type
  publishing.
- The frontend appends the type to loaded connection types and appends a single sentinel instance to
  loaded connection instances.
- `queryConnection()` and `testConnection()` intercept the sentinel instance id and execute locally.
- No connection instance, response JSON, secret, or query payload is persisted to the backend by this
  mock path.

## Backend Contract

There is no backend adapter contract for this connection. The `type_id` is
`command_center.mock_api`, but it is deliberately local-only. It should not be implemented as a
production provider adapter or synced into the backend registry unless the product decision changes.

## Maintenance Constraints

- Keep this connection out of `connection-type-sync` backend payloads.
- Keep the sentinel instance id stable so saved workspace/widget references continue to resolve.
- Do not add secure config fields. Mock response JSON is user-authored local data, not credentials.
- Keep the query output compatible with `core.tabular_frame@v1` so existing connection-query widgets
  can consume it without special cases.
