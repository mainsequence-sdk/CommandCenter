# PostgreSQL Connection

This directory owns the PostgreSQL custom connection implementation. It contributes a connection
type and shared authoring contract; it does not register a Command Center app, widget, or sidebar
entry.

## Entry Points

- `index.ts`: exports the `postgresql.database` connection type definition loaded by the app
  registry's root-level custom connection loader.
- `PostgreSqlConnectionQueryEditor.tsx`: typed Connection Query widget editor for one SQL payload.
- `postgreSqlAuthoring.tsx`: defines the shared `authoringContract` used by both Data Sources
  Explore and widget-managed/standalone `connection-query` settings for source summary cards and
  Explore copy.

## Behavior

- The connection type exposes database target fields, SSL mode, backend pool settings, write-only
  password and TLS material, and data-source-level query policy fields. PostgreSQL has one
  user-facing query model: SQL.
- Connection instances are backend-owned data sources. The frontend sends secret values only during
  create/update and expects to read only `secureFields` indicators back.
- Query caching is configured on the data source through public config. `cacheTtlMs` on individual
  query requests is only an override; backend adapters should default to the instance-level
  `queryCachePolicy`, `queryCacheTtlMs`, `metadataCacheTtlMs`, and `dedupeInFlight` settings.
- The generic Explore surface uses `src/connections/ConnectionQueryWorkbench.tsx`, the same
  PostgreSQL `queryModels`, the same `queryEditor`, and the same `authoringContract` as the
  Connection Query widget. Because PostgreSQL has one SQL model, the workbench auto-selects it and
  does not show a path selector. SQL authoring, generated request preview, test execution, and
  normalized frame preview must not fork from the widget path.
- SQL query payloads use the shared CodeMirror-backed `QuerySqlField` from connection components.
  Keep SQL editing behavior there rather than adding PostgreSQL-only text areas.
- Explore and widget settings both call the shared Connection Query workbench, which builds the
  standard `ConnectionQueryRequest` and executes it through the widget runtime helper. The backend
  adapter owns SQL macro expansion, connection pooling, query execution, row limits, health checks,
  and normalized frame conversion.

## Backend Query Contract

The backend adapter must switch on `request.query.kind`; PostgreSQL accepts one query kind.

- `sql`: accepts
  `{ kind: "sql", sql: string }`. Execute the SQL through the configured backend pool, apply
  authorization, statement timeout, and data-source-level row limits. Return one
  `core.tabular_frame@v1`. When the backend can validate chart semantics, publish them inside
  normalized graph semantics on that tabular frame instead of switching contracts.

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
