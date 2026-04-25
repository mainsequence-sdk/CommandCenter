# ADR: PostgreSQL Custom Connection

- Status: Accepted
- Date: 2026-04-24
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)

## Context

Command Center now has a first-class connection model: connection types are code-owned metadata,
connection instances are backend-owned data sources, secrets stay on the backend, and widgets or
Explore surfaces consume normalized query results through the shared connection runtime.

PostgreSQL should fit that model as a live external database connection. It must not be treated as
ETL, ingestion, replication, or browser-side database access. Command Center should keep PostgreSQL
external, send SQL requests through the backend connection adapter, receive rows, normalize them
into `CommandCenterFrame` results, and let widgets or Explore render those frames.

## Decision

Add a root-level custom connection implementation under `connections/postgresql/`.

The connection type id is `postgresql.database`. It contributes:

- public configuration schema for host, port, database, username, SSL mode, default schema, pool
  size, connection lifetime, statement timeout, row limits, result-cache policy, metadata-cache
  TTL, and in-flight request de-duplication
- secure configuration schema for password and optional TLS certificate material
- query models for table SQL, time-series SQL, table metadata, and column metadata
- a PostgreSQL-specific Explore component rendered by the shared `Connections > Explore` page
- required permission metadata using the existing platform permission system: `postgresql:query`

It does not register a sidebar app, widget, dashboard, or shell menu entry.

## Frontend Contract

The frontend connection type is loaded from `connections/postgresql/index.ts` by the root custom
connection loader in the app registry.

The query model is:

```ts
export type PostgreSqlConnectionQuery =
  | {
      kind: "sql-table";
      sql: string;
      maxRows?: number;
    }
  | {
      kind: "sql-timeseries";
      sql: string;
      maxRows?: number;
    }
  | {
      kind: "schema-tables";
      schema?: string;
    }
  | {
      kind: "schema-columns";
      schema?: string;
      table: string;
    };
```

The Explore component sends `queryConnection(...)` requests. It does not open database sockets and
does not expand SQL macros locally. The backend adapter owns execution, macro expansion, row
limits, authorization, and frame conversion.

## Backend Adapter Requirements

The backend should implement an adapter for `postgresql.database` using the existing connection
runtime interface:

```ts
interface ConnectionAdapter {
  typeId: "postgresql.database";

  test(instance: RuntimeConnectionInstance): Promise<ConnectionHealthResult>;

  query(
    instance: RuntimeConnectionInstance,
    request: ConnectionQueryRequest<PostgreSqlConnectionQuery>,
    context: RequestContext,
  ): Promise<ConnectionQueryResponse>;

  resource?(
    instance: RuntimeConnectionInstance,
    resource: string,
    params: Record<string, unknown>,
    context: RequestContext,
  ): Promise<unknown>;
}
```

The adapter should maintain a cached connection pool per connection instance. When public config or
secure config changes, the backend must invalidate and rebuild the pool.

Pool behavior should include:

- parse and validate host, port, database, username, SSL mode, and timeout settings
- read password and TLS material from decrypted secure config only
- never return secret values to the frontend
- create a bounded pool using `maxOpenConnections`
- apply `connectionMaxLifetimeMs`
- apply `statementTimeoutMs` per query where supported
- apply instance-level query policy defaults: `rowLimit`, `queryCachePolicy`, `queryCacheTtlMs`,
  `metadataCacheTtlMs`, and `dedupeInFlight`
- close pools when instances are disabled, deleted, or reconfigured

Query cache behavior is data-source-level configuration. `ConnectionQueryRequest.cacheTtlMs` is a
request override, not the primary policy source. The adapter should use the configured instance
defaults unless the request explicitly bypasses or refreshes cache behavior.

## Query Execution

The adapter must treat `request.query.kind` as the runtime discriminator. Query model ids in
`connections/postgresql/index.ts` are intentionally identical to these `kind` values so the
frontend catalog, Explore UI, synced backend metadata, and backend adapter dispatch table stay
aligned.

The backend dispatch table is:

| `request.query.kind` | Required payload | Required request fields | Adapter behavior | Response contract |
| --- | --- | --- | --- | --- |
| `sql-table` | `{ sql: string; maxRows?: number }` | `connectionUid`, `query` | Execute user-authored SQL through the configured pool after authorization, variable expansion, timeout, and row-limit enforcement. | `core.tabular_frame@v1` |
| `sql-timeseries` | `{ sql: string; maxRows?: number }` | `connectionUid`, `query`, `timeRange` | Expand time macros, execute SQL, validate a usable time column, sort by time when possible, and shape rows as time series. | `core.time_series_frame@v1`, with warning/fallback behavior when shaping fails |
| `schema-tables` | `{ schema?: string }` | `connectionUid`, `query` | Read safe PostgreSQL catalog metadata for the requested schema or configured default schema. | `core.option_list@v1` |
| `schema-columns` | `{ schema?: string; table: string }` | `connectionUid`, `query` | Read safe PostgreSQL catalog metadata for the requested table. | `core.option_list@v1` |

Unknown `kind` values must be rejected with a typed bad-request error. The adapter should include
the query kind in audit logs and response metadata.

For `sql-table`:

- apply platform authorization checks
- apply backend-owned variable and macro expansion
- execute SQL with the configured statement timeout
- enforce `maxRows`
- return one or more `CommandCenterFrame` objects with `contract: "core.tabular_frame@v1"`

For `sql-timeseries`:

- require a time range from `ConnectionQueryRequest.timeRange`
- apply time macros before execution
- require a result column named `time` or a backend-configured equivalent
- enforce sorted time output when possible
- return `CommandCenterFrame` results with `contract: "core.time_series_frame@v1"` when the result
  can be interpreted as time series data
- return warnings when the SQL result cannot be shaped as time series data

For `schema-tables` and `schema-columns`:

- query safe catalog metadata only
- respect the configured default schema
- return option-list frames or resource payloads suitable for editor autocomplete

## SQL Macro Contract

The backend adapter should support a small Command Center macro set:

- `$__timeFilter(column)` expands to a range predicate using `ConnectionQueryRequest.timeRange`
- `$__timeFrom()` expands to the request start timestamp
- `$__timeTo()` expands to the request end timestamp
- `$__interval` expands to the backend-selected bucket interval
- `$__interval_ms` expands to the same interval in milliseconds

Macro expansion must happen on the backend so browser code never needs database-specific quoting
rules, timestamp formatting, or SQL dialect behavior.

## Result Mapping

The adapter should convert PostgreSQL result columns into `CommandCenterFrameField` values.

Initial type mapping:

- timestamps and dates map to `time` fields when they are selected as the time column
- integer, floating-point, decimal, and numeric values map to `number`
- booleans map to `boolean`
- text, varchar, uuid, enum, inet, and similar values map to `string`
- json and jsonb values map to `json`
- unsupported or driver-specific values should be converted to JSON-safe strings with warnings

The adapter should include frame metadata for row count, schema/table context when known, executed
query kind, elapsed time, and backend trace id.

## Health Checks

`testConnection(uid)` should call the backend adapter health check. Health should:

- acquire or create the instance pool
- ping the database
- optionally verify the configured default schema exists
- return status, message, latency, and trace id

The success message should be concise, for example `Database connection OK`.

## Security

The connector is a SQL execution bridge. It must not pretend to be a SQL sandbox.

Security must rely on:

- existing platform and Main Sequence authorization checks before query execution
- backend-owned secrets and TLS material
- database-side permissions
- dedicated read-only database users for production data sources
- statement timeouts and row limits
- audit logging of connection uid, user, query kind, duration, and trace id

Do not attempt to parse arbitrary SQL to prove it is safe. That approach is brittle. The correct
control is least-privilege database credentials plus backend authorization and limits.

## Implementation Tasks

- [x] Add `connections/postgresql/` as a root-level custom connection implementation.
- [x] Register `postgresql.database` from `connections/postgresql/index.ts`.
- [x] Add public config schema for database target, SSL mode, pooling, and timeouts.
- [x] Add data-source-level query cache, metadata cache, row-limit, and in-flight dedupe settings.
- [x] Add secure config schema for password and TLS material.
- [x] Add query models for table SQL, time-series SQL, table metadata, and column metadata.
- [x] Add PostgreSQL-specific Explore UI using the shared `queryConnection` API.
- [x] Add `postgresql:query` permission metadata to the frontend permission catalog.
- [ ] Implement backend `postgresql.database` adapter.
- [ ] Implement backend pool caching and invalidation per connection instance.
- [ ] Implement backend health check by pinging the configured database.
- [ ] Implement backend SQL macro expansion.
- [ ] Implement backend result-to-`CommandCenterFrame` conversion.
- [ ] Implement backend schema metadata resources for tables and columns.
- [ ] Add backend tests for table, time-series, metadata, health, timeout, and row-limit behavior.

## Storage Contract Assessment

This adds a new connection type and therefore changes the connection type sync payload. It does not
change workspace storage by itself.

Persisted backend connection instances for PostgreSQL must store:

- `type_id: "postgresql.database"`
- public config in `public_config`
- encrypted password and TLS material in backend secure config
- `secure_fields` indicators only in frontend responses

Widgets should store only a stable `ConnectionRef` when they later consume PostgreSQL data.

## Consequences

PostgreSQL becomes a first-class live data source in Command Center without creating a separate app
extension. The shared Connections app owns discovery, creation, listing, testing, and exploration;
the backend owns connection pooling, secrets, query execution, and frame normalization.
