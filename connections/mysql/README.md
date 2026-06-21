# MySQL Connection

This directory owns the `mysql.database` custom connection definition. It is a Command Center
connection type, not a browser-side MySQL client. The frontend contributes metadata, schemas,
authoring UI, examples, and registry sync payloads; the backend adapter owns all network access,
credentials, pooling, health checks, SQL execution, caching, and frame normalization.

## Entry Points

- `index.ts`: exports the MySQL connection type loaded by the root-level custom connection loader.
  It reuses the shared SQL connection builders from `src/connections/sql/` and only overrides
  MySQL-specific engine defaults.
- `src/connections/sql/SharedSqlConnectionQueryEditor.tsx`: shared SQL and schema-metadata editor
  used by PostgreSQL, TimescaleDB, and MySQL.
- `src/connections/sql/sharedSqlAuthoring.tsx`: shared authoring summary and draft-default
  resolver used by SQL database connections.

## Behavior

- Public config uses Command Center field names: `host`, `port`, `database`, `username`,
  `sslMode`, `defaultSchema`, `defaultCharset`, `connectionTimezone`, `maxOpenConnections`,
  `connectionMaxLifetimeMs`, `statementTimeoutMs`, `rowLimit`, `queryCachePolicy`,
  `queryCacheTtlMs`, `metadataCacheTtlMs`, and `dedupeInFlight`.
- Secure config fields are write-only: `password`, `tlsCaCertificate`,
  `tlsClientCertificate`, and `tlsClientKey`. The frontend should only rely on `secureFields`
  indicators such as `{ "password": true }` after save.
- Query behavior matches the shared SQL contract: `sql-table`, `sql-time-series`,
  `schema-tables`, and `schema-columns` return `core.tabular_frame@v1` through the backend
  connection runtime.
- MySQL-specific differences are limited to `type_id: mysql.database`, the MySQL icon and labels,
  default port `3306`, MySQL SSL mode values, default metadata seed SQL, and backend SQL dialect
  behavior.

## Backend Adapter Contract

- `type_id`: `mysql.database`
- The backend adapter should reuse common SQL adapter behavior where possible: health response
  shape, permission checks, cache policy, in-flight dedupe, row-limit enforcement, timeout
  enforcement, metadata response shape, and `core.tabular_frame@v1` normalization should match the
  PostgreSQL adapter unless MySQL driver or dialect behavior requires a documented difference.
- The backend adapter owns MySQL driver setup, pool invalidation, TLS material, password
  resolution, macro expansion, SQL execution, and type mapping.
- Do not send `database_name` or `database_user` in Command Center connection config. Those names
  belong only to physical data-source models, not connection instance public config.

## Maintenance Constraints

- Keep shared SQL editor and authoring behavior in `src/connections/sql/`. Do not fork MySQL-only
  editor UI unless a dialect-specific requirement is documented in ADR 077 or a follow-up ADR.
- Do not connect to MySQL directly from the browser. Use `accessMode: "proxy"` and execute SQL
  through the backend adapter.
- If query models, macros, config fields, or result frame semantics change, update the shared SQL
  module, PostgreSQL/TimescaleDB parity tests, MySQL tests, and the backend adapter contract in the
  same change.
