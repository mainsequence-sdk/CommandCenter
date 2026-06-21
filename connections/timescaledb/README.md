# TimescaleDB Connection

This directory owns the `timescaledb.database` custom connection definition. It is a Command
Center connection type, not the physical data-source editor. The backend may project a configured
connection into a physical `TimeScaleDB` data source only after health, write, and Timescale
extension probes succeed.

## Entry Points

- `index.ts`: exports the TimescaleDB connection type loaded by the root-level custom connection
  loader. It reuses the PostgreSQL-compatible public config schema, secure config schema, query
  models, examples, and usage-guidance builder from `connections/postgresql/`, which delegates
  shared SQL authoring behavior to `src/connections/sql/`.
- `src/connections/sql/SharedSqlConnectionQueryEditor.tsx`: shared SQL and schema-metadata editor
  used by PostgreSQL, TimescaleDB, and MySQL.

## Behavior

- Public config uses Command Center field names: `host`, `port`, `database`, `username`,
  `sslMode`, `defaultSchema`, `maxOpenConnections`, `connectionMaxLifetimeMs`,
  `statementTimeoutMs`, `rowLimit`, `queryCachePolicy`, `queryCacheTtlMs`,
  `metadataCacheTtlMs`, and `dedupeInFlight`.
- Secure config fields are write-only: `password`, `tlsCaCertificate`,
  `tlsClientCertificate`, and `tlsClientKey`. The frontend should only rely on `secureFields`
  indicators such as `{ "password": true }` after save.
- Query behavior is PostgreSQL-compatible: `sql-table`, `sql-time-series`, `schema-tables`, and
  `schema-columns` return `core.tabular_frame@v1` through the backend connection runtime.
- `physicalDataSource` metadata declares `dataSourceClassType: "timescale_db"`,
  `requiresCapabilities: ["sql-write", "timescale-extension"]`,
  `defaultRegistrationMode: "auto-when-write-capable"`, and `managedLifecycle: false`.

## Backend Adapter Contract

- `type_id`: `timescaledb.database`
- The backend adapter subclasses or reuses PostgreSQL adapter behavior for connection pooling, TLS
  material, query policy, metadata cache, SQL macro expansion, row-limit enforcement, resources,
  health checks, and frame normalization.
- Projection runs after connection create/update or a successful `POST
  /api/v1/command_center/connections/{id}/test/` call. The backend creates the physical
  TimeScaleDB data source only when the connection test works, the write probe works, and the
  `timescaledb` extension exists in `pg_extension`.
- Do not send `database_name` or `database_user` in Command Center connection config. Those names
  belong only to the physical data-source model and are translated by the backend projection
  service.
