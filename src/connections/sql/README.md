# Shared SQL Connections

This module owns reusable frontend primitives for SQL-backed Command Center connection types.
Provider-specific connection folders such as `connections/postgresql/`, `connections/timescaledb/`,
`connections/mysql/`, and `connections/mssql/` import these helpers instead of duplicating SQL
query authoring behavior.

## Entry Points

- `sharedSqlConnection.ts`: shared public/secure config types, query payload types, config-schema
  builders, query-model builders, usage-guidance helpers, and connection-definition factory.
- `SharedSqlConnectionQueryEditor.tsx`: shared SQL query editor for SQL table, SQL time-series,
  schema-tables, and schema-columns query payloads.
- `sharedSqlAuthoring.tsx`: shared connection authoring summary and draft-default resolver for SQL
  database connections.

## Maintenance Constraints

- Keep user-facing SQL authoring behavior here unless a provider has a documented dialect-specific
  need to diverge.
- Provider folders should override only engine-specific details such as type id, branding, default
  port, optional SSL modes, metadata seed query, system schemas, permissions, and backend adapter
  type.
- Do not connect to databases from the browser. All SQL execution, credentials, health checks,
  pooling, caching, and frame normalization remain backend adapter responsibilities.
- When query model semantics or shared config fields change, update the PostgreSQL, TimescaleDB,
  MySQL, and SQL Server docs/tests together so the SQL connection surface stays aligned.
