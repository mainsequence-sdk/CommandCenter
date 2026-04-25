# Custom Connections

This root-level directory contains custom connection implementations. It is separate from
`src/connections/`, which owns the shared platform framework for connection types, instances,
API clients, hooks, and picker components.

## Entry Points

- `*/index.ts`: each custom connection entrypoint exports a `ConnectionTypeDefinition`, an array of
  definitions, or an object with a `connections` array.
- `prometheus/`: Prometheus connection metadata and its custom Explore shell.
- `postgresql/`: PostgreSQL connection metadata and its custom SQL Explore shell.

## Behavior

- The app registry auto-loads `connections/*/index.ts` and folds those definitions into
  `appRegistry.connections`.
- Custom connections do not create sidebar apps by themselves. Users interact with them through the
  shared Connections app after the backend registry has synced and activated the type.
- Connection instances, secrets, health, query execution, and authorization remain backend-owned.

## Maintenance Constraints

- Keep connector-specific UI limited to connection-owned editors or Explore components.
- Do not register apps, widgets, dashboards, or shell menu entries from this directory.
- Add a README beside every custom connection implementation so ownership and backend expectations
  are clear.
