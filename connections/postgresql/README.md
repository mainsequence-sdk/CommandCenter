# PostgreSQL Connection

This directory owns the PostgreSQL custom connection implementation. It contributes a connection
type and a connection-specific Explore shell; it does not register a Command Center app, widget, or
sidebar entry.

## Entry Points

- `index.ts`: exports the `postgresql.database` connection type definition loaded by the app
  registry's root-level custom connection loader.
- `PostgreSqlConnectionExplore.tsx`: adaptive PostgreSQL Explore shell rendered by
  `Connections > Explore` when the selected data source uses the PostgreSQL connection type.
- `PostgreSqlConnectionQueryEditor.tsx`: typed Connection Query widget editor for SQL table,
  SQL time-series, schema table, and schema column query payloads.

## Behavior

- The connection type exposes database target fields, SSL mode, backend pool settings, write-only
  password and TLS material, data-source-level query policy fields, table query models,
  time-series query models, and schema metadata query models.
- Connection instances are backend-owned data sources. The frontend sends secret values only during
  create/update and expects to read only `secureFields` indicators back.
- Query caching is configured on the data source through public config. `cacheTtlMs` on individual
  query requests is only an override; backend adapters should default to the instance-level
  `queryCachePolicy`, `queryCacheTtlMs`, `metadataCacheTtlMs`, and `dedupeInFlight` settings.
- The Explore shell provides a PostgreSQL-owned query builder plus a direct SQL editor. It calls the
  shared `queryConnection` endpoint with `sql-table` or `sql-timeseries` payloads. The backend
  adapter owns SQL macro expansion, connection pooling, query execution, row limits, health checks,
  and normalized frame conversion.
- The Connection Query widget uses the PostgreSQL `queryEditor` to render SQL, parameters,
  schema/table metadata kwargs, and time-series field mapping. These fields are connection-specific
  payload fields and should not become static fields on the generic widget.

## Backend Query Contract

The backend adapter must switch on `request.query.kind`; query model labels are UI/catalog metadata
only and are not a runtime protocol by themselves.

- `sql-table`: accepts
  `{ kind: "sql-table", sql: string, maxRows?: number, parameters?: Record<string, unknown> }`.
  Execute the SQL through the configured backend pool, apply authorization, bound parameters,
  variable expansion, statement timeout, and row limits, then return `core.tabular_frame@v1`.
- `sql-timeseries`: accepts
  `{ kind: "sql-timeseries", sql: string, maxRows?: number, parameters?: Record<string, unknown>, timeField?: string, valueField?: string, valueFields?: string[], seriesFields?: string[] }`
  plus `ConnectionQueryRequest.timeRange`. Expand PostgreSQL time macros, validate declared or
  inferable time/value fields, and return `core.time_series_frame@v1` when the result can be shaped
  as time series. The builder sends `timeField: "time"` and `valueField: "value"` because
  `$__timeGroupAlias(...)` expands to `AS time` and the value expression is aliased as `value`.
- `schema-tables`: accepts `{ kind: "schema-tables", schema?: string }`. Read safe catalog
  metadata for the requested schema or configured default schema and return table options for
  editors.
- `schema-columns`: accepts `{ kind: "schema-columns", schema?: string, table: string }`. Read safe
  catalog metadata for the table and return column options for editors.

Backend implementations should reject unknown `kind` values with a typed bad-request error and
should include the query kind in audit logs and response metadata.

## Maintenance Constraints

- PostgreSQL must remain a custom connection under `connections/`, not an app extension.
- Do not connect to PostgreSQL directly from the browser. Use `accessMode: "proxy"` and execute SQL
  through the backend adapter.
- Treat SQL as trusted user-authored input executed by the configured database identity. Production
  data sources should use dedicated read-only database users and database-side permissions.
- If query models, macros, or result frame semantics change, update the backend adapter contract and
  the connection ADR in the same change.
