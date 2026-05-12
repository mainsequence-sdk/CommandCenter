# PostgreSQL Connection

This directory owns the PostgreSQL custom connection implementation. It contributes a connection
type and shared authoring contract; it does not register a Command Center app, widget, or sidebar
entry.

## Entry Points

- `index.ts`: exports the `postgresql.database` connection type definition plus reusable
  PostgreSQL-compatible public config schema, secure config schema, query models, usage-guidance
  builder, and connection-definition factory. `connections/timescaledb/` imports these exports so
  the shared database settings stay dry.
- `PostgreSqlConnectionQueryEditor.tsx`: typed Connection Query widget editor for SQL table,
  SQL time-series, schema-tables, and schema-columns payloads.
- `postgreSqlAuthoring.tsx`: defines the shared `authoringContract` factory used by both Data
  Sources Explore and widget-managed/standalone `connection-query` settings for source summary
  cards and provider-specific Explore copy.

## Behavior

- The connection type exposes database target fields, SSL mode, backend pool settings, write-only
  password and TLS material, and data-source-level query policy fields. The same config schema is
  reused by TimescaleDB. Command Center public config uses `database` and `username`; do not send
  physical data-source model fields such as `database_name` or `database_user`.
- PostgreSQL-compatible query models are `sql-table`, `sql-time-series`, `schema-tables`, and
  `schema-columns`. Legacy backend compatibility for `sql` and `sql-timeseries` may remain, but
  new frontend-authored requests use the canonical query kinds.
- Connection instances are backend-owned data sources. The frontend sends secret values only during
  create/update and expects to read only `secureFields` indicators back.
- Query caching is configured on the data source through public config. `cacheTtlMs` on individual
  query requests is only an override; backend adapters should default to the instance-level
  `queryCachePolicy`, `queryCacheTtlMs`, `metadataCacheTtlMs`, and `dedupeInFlight` settings.
- The generic Explore surface uses `src/connections/ConnectionQueryWorkbench.tsx`, the same
  PostgreSQL `queryModels`, the same `queryEditor`, and the same `authoringContract` as the
  Connection Query widget. The shared authoring contract seeds `sql-table` on first load with a
  table-list query against `information_schema.tables` and `maxRows = 100` so Explore and widget
  settings start from the same safe default. SQL authoring, generated request preview, test
  execution, and normalized frame preview must not fork from the widget path.
- SQL query payloads use the shared CodeMirror-backed `QuerySqlField` from connection components.
  Keep SQL editing behavior there rather than adding PostgreSQL-only text areas.
- Explore and widget settings both call the shared Connection Query workbench, which builds the
  standard `ConnectionQueryRequest` and executes it through the widget runtime helper. The backend
  adapter owns SQL macro expansion, connection pooling, query execution, row limits, health checks,
  and normalized frame conversion.

## Backend Query Contract

The backend adapter must switch on `request.query.kind`; PostgreSQL accepts the canonical
PostgreSQL-compatible query kinds below.

- `sql-table`: accepts `{ kind: "sql-table", sql: string, maxRows?: number }`. Execute SQL through
  the configured backend pool, apply authorization, variables, statement timeout, cache policy,
  in-flight dedupe, and row-limit enforcement. Return `core.tabular_frame@v1`.
- `sql-time-series`: accepts
  `{ kind: "sql-time-series", sql: string, maxRows?: number, timeField?: string }`. Use the
  top-level `ConnectionQueryRequest.timeRange`, expand SQL time macros on the backend, and return
  `core.tabular_frame@v1` with time-series hints when available.
- `schema-tables`: accepts `{ kind: "schema-tables", schema?: string }`. Read safe
  `information_schema.tables` metadata for the requested schema or configured `defaultSchema` and
  return `core.tabular_frame@v1`.
- `schema-columns`: accepts `{ kind: "schema-columns", schema?: string, table: string }`. Read
  safe `information_schema.columns` metadata for the requested table and return
  `core.tabular_frame@v1`.

Backend implementations should reject unknown `kind` values with a typed bad-request error and
should include the query kind in audit logs and response metadata.

## Maintenance Constraints

- PostgreSQL must remain a custom connection under `connections/`, not an app extension.
- Keep connection-specific Explore/query summary behavior in `postgreSqlAuthoring.tsx`. Do not
  reintroduce a PostgreSQL-only Explore shell.
- Do not connect to PostgreSQL directly from the browser. Use `accessMode: "proxy"` and execute SQL
  through the backend adapter.
- Treat SQL as trusted user-authored input executed by the configured database identity. Production
  data sources should use database-side permissions appropriate for the connection's intended
  scope.
- If query models, macros, or result frame semantics change, update the backend adapter contract and
  the connection ADR in the same change.
