# SQL Server Connection

This directory owns the `mssql.database` custom connection definition. It is a Command Center
connection type, not a browser-side SQL Server client. The frontend contributes metadata, schemas,
authoring UI, examples, and registry sync payloads; the backend adapter owns all network access,
credentials, pooling, health checks, SQL execution, caching, and frame normalization.

## Entry Points

- `index.ts`: exports the SQL Server connection type loaded by the root-level custom connection
  loader. It reuses the shared SQL connection builders from `src/connections/sql/` and only
  overrides SQL Server-specific engine defaults.
- `src/connections/sql/SharedSqlConnectionQueryEditor.tsx`: shared SQL and schema-metadata editor
  used by PostgreSQL, TimescaleDB, MySQL, and SQL Server.
- `src/connections/sql/sharedSqlAuthoring.tsx`: shared authoring summary and draft-default
  resolver used by SQL database connections.

## Behavior

- Public config uses Command Center field names: `host`, `port`, `database`, `username`,
  `defaultSchema`, `maxOpenConnections`, `connectionMaxLifetimeMs`, `statementTimeoutMs`,
  `rowLimit`, `queryCachePolicy`, `queryCacheTtlMs`, `metadataCacheTtlMs`, and `dedupeInFlight`.
- `host`, `database`, `username`, and `password` are required per connection instance and do not
  have environment-specific defaults.
- Secure config exposes only the write-only `password` field for the initial backend contract.
- Query behavior matches the shared SQL contract: `sql-table`, `sql-time-series`,
  `schema-tables`, and `schema-columns` return `core.tabular_frame@v1` through the backend
  connection runtime.
- SQL Server-specific differences are limited to `type_id: mssql.database`, the SQL Server icon
  and labels, default port `1433`, default schema `dbo`, default metadata seed SQL, and backend
  SQL dialect behavior.

## Backend Adapter Contract

- `type_id`: `mssql.database`
- The backend adapter should reuse common SQL adapter behavior where possible: health response
  shape, permission checks, cache policy, in-flight dedupe, row-limit enforcement, timeout
  enforcement, metadata response shape, and `core.tabular_frame@v1` normalization should match the
  PostgreSQL/MySQL adapters unless SQL Server driver or dialect behavior requires a documented
  difference.
- The backend adapter owns SQL Server driver setup, pool invalidation, password resolution, macro
  expansion, SQL execution, type mapping, transport security, and sanitized error handling.
- Do not send `database_name` or `database_user` in Command Center connection config. Those names
  belong only to physical data-source models, not connection instance public config.
- Do not add frontend TLS, Windows auth, Kerberos, Azure AD, Entra ID, or token-auth fields unless
  the backend `mssql.database` adapter contract is expanded first.

## Maintenance Constraints

- Keep shared SQL editor and authoring behavior in `src/connections/sql/`. Do not fork SQL
  Server-only editor UI unless a dialect-specific requirement is documented in ADR 078 or a
  follow-up ADR.
- Do not connect to SQL Server directly from the browser. Use `accessMode: "proxy"` and execute SQL
  through the backend adapter.
- If query models, macros, config fields, or result frame semantics change, update the shared SQL
  module, PostgreSQL/TimescaleDB/MySQL parity tests, SQL Server tests, and the backend adapter
  contract in the same change.
