# ADR 077: Client-Side MySQL Connection Type

- Status: Accepted
- Date: 2026-06-15
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: PostgreSQL Custom Connection](./adr-postgresql-connection.md)
  - [Connection Adapters](../../connections/adapters/README.md)

## Context

Command Center already supports first-class connection types, including PostgreSQL and TimescaleDB.
Those connection types are client-side definitions for configuration, authoring, query models,
usage guidance, registry sync, and editor UI. Actual network access, credentials, pooling,
authorization, execution, caching, and response normalization stay backend-owned.

There is currently no first-class MySQL or MariaDB connection type in the client repository. Adding
MySQL support should follow the PostgreSQL model instead of introducing a browser-side database
client or a one-off widget-specific integration.

In this ADR, "client-side MySQL support" means the frontend can define, configure, select, author,
and sync a MySQL connection type. It does not mean opening MySQL sockets from the browser.

## Decision

Add a root-level custom connection implementation under `connections/mysql/`.

The connection type id is:

```text
mysql.database
```

The frontend connection definition will contribute:

- public and secure config schemas for MySQL connection instances
- complete schema field descriptions for `(i)` help and usage guidance
- query models for SQL table queries, SQL time-series queries, table metadata, and column metadata
- shared SQL query editor integration with MySQL-specific labels only where the engine differs
- an authoring contract that seeds a safe metadata query
- examples and `usageGuidance`
- a crisp MySQL icon under `src/connections/assets/`

It will not register a sidebar app, widget, dashboard, shell menu, or browser-side runtime.

## Shared SQL Connection Layer

MySQL must not be implemented as a copy-paste fork of PostgreSQL. The required user-facing
functionality is the same as PostgreSQL: configure a SQL database, test it, browse metadata, author
SQL table queries, author SQL time-series queries, return `core.tabular_frame@v1`, and bind the
result into the same widgets.

The implementation should extract or reuse shared SQL connection primitives before adding MySQL:

- shared SQL query payload types for `sql-table`, `sql-time-series`, `schema-tables`, and
  `schema-columns`
- shared query model definitions and output contract declarations
- shared SQL query editor UI for SQL text, parameters, row limits, time field, value fields, series
  fields, unit, and metadata lookups
- shared authoring contract behavior for default query seeds, query-model filtering, default row
  limits, and Explore/test-query copy
- shared public config schema builders for common fields such as host, port, database, username,
  pooling, statement timeout, row limit, cache TTL, metadata cache TTL, and in-flight dedupe
- shared secure config schema builders for password and TLS material
- shared usage-guidance structure and field-guidance generation
- shared tests that assert SQL connection parity across PostgreSQL, TimescaleDB, and MySQL

The only intentional frontend differences between PostgreSQL and MySQL should be:

- connection type id: `postgresql.database` vs `mysql.database`
- title, source, tags, icon, and branding copy
- default port: `5432` vs `3306`
- SSL mode option labels and values where the drivers differ
- default metadata seed query and excluded system schemas
- physical data-source projection metadata, if MySQL later participates in those Main Sequence
  flows
- backend adapter `type_id` and SQL dialect behavior

Any additional divergence must be documented in this ADR or a follow-up ADR before implementation.
The maintenance target is one SQL connection authoring surface with engine-specific adapters, not
separate PostgreSQL and MySQL UX branches.

## Frontend Contract

The initial frontend public config shape should be:

```ts
export interface MySqlPublicConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  sslMode?: "disabled" | "preferred" | "required" | "verify-ca" | "verify-identity";
  defaultSchema?: string;
  defaultCharset?: string;
  connectionTimezone?: string;
  maxOpenConnections?: number;
  connectionMaxLifetimeMs?: number;
  statementTimeoutMs?: number;
  rowLimit?: number;
  queryCachePolicy?: "disabled" | "safe";
  queryCacheTtlMs?: number;
  metadataCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}
```

`database` is required because MySQL commonly scopes tables by database/catalog. `defaultSchema`
is an optional compatibility alias for shared SQL authoring UI. When both are present, backend
execution should treat `database` as the authoritative selected database and `defaultSchema` as the
metadata/query-editor default only.

The initial secure config shape should be:

```ts
export interface MySqlSecureConfig {
  password?: string;
  tlsCaCertificate?: string;
  tlsClientCertificate?: string;
  tlsClientKey?: string;
}
```

The frontend query payload should mirror the shared SQL connection shape:

```ts
export type MySqlConnectionQuery =
  | {
      kind: "sql-table" | "sql-time-series";
      sql: string;
      maxRows?: number;
      parameters?: Record<string, unknown>;
      timeField?: string;
      valueField?: string;
      valueFields?: string[];
      seriesFields?: string[];
      unit?: string;
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

The default `sql-table` seed should be a safe metadata query:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
order by table_schema, table_name
limit 100
```

## Query Models

The frontend should advertise these query models:

| Query model id | Payload discriminator | Time range aware | Output contract |
| --- | --- | --- | --- |
| `sql-table` | `kind: "sql-table"` | No | `core.tabular_frame@v1` |
| `sql-time-series` | `kind: "sql-time-series"` | Yes | `core.tabular_frame@v1` |
| `schema-tables` | `kind: "schema-tables"` | No | `core.tabular_frame@v1` |
| `schema-columns` | `kind: "schema-columns"` | No | `core.tabular_frame@v1` |

The query model ids and the `query.kind` values must stay identical so the registry, authoring
contract, query editor, and backend adapter dispatch table do not drift.

## Backend Adapter Requirements

The backend must implement a connection adapter whose `type_id` exactly matches:

```text
mysql.database
```

The adapter owns:

- resolving and decrypting secure config
- creating and invalidating MySQL connection pools per connection instance
- health checks
- SQL execution
- metadata resources
- permission checks
- row limits and statement timeouts
- result caching and in-flight dedupe
- SQL macro expansion
- conversion to `core.tabular_frame@v1`
- sanitized error and audit logging

The frontend must never open MySQL sockets, parse MySQL credentials, or expand MySQL-specific SQL
macros locally.

The backend adapter should also follow the same parity rule where possible: common SQL adapter
behavior such as health response shape, cache policy, in-flight dedupe, row-limit enforcement,
permission checks, frame normalization, and metadata response shape should match PostgreSQL unless
MySQL dialect or driver behavior forces a documented difference.

## SQL Macro Contract

The backend adapter should support the same Command Center macro surface as PostgreSQL where the
semantics are portable:

- `$__timeFilter(column)`
- `$__timeFrom()`
- `$__timeTo()`
- `$__interval`
- `$__interval_ms`

Macro expansion must be backend-owned because MySQL timestamp syntax, quoting, timezone handling,
and parameter binding belong to the database adapter.

## Result Mapping

The backend adapter should normalize MySQL result columns into `CommandCenterFrameField` values.

Initial mapping:

- `DATE`, `DATETIME`, `TIMESTAMP`, and `TIME` map to `time` fields when selected as the time column;
  otherwise they map to strings with temporal metadata.
- `INT`, `BIGINT`, `FLOAT`, `DOUBLE`, and safe numeric values map to `number`.
- `DECIMAL` and `NUMERIC` map to `number` only when precision can be represented safely; otherwise
  they map to strings with numeric metadata.
- `BOOLEAN`, `BOOL`, `BIT(1)`, and equivalent tinyint booleans map to `boolean` when unambiguous.
- `CHAR`, `VARCHAR`, `TEXT`, enum, set, and similar values map to `string`.
- `JSON` maps to `json`.
- Binary/blob values should be omitted or returned as safe strings only when explicitly requested.

The adapter should include response metadata for row count, query kind, elapsed time, database,
schema/table context when known, and backend trace id.

## Security

MySQL is a SQL execution bridge. Frontend validation is not a security boundary.

Security depends on:

- backend authorization before query execution, cache reads, or in-flight joins
- backend secret storage
- least-privilege MySQL users
- read-only credentials for production analytics connections
- statement timeouts
- row limits
- audit logs that include connection uid, user uid, query kind, duration, and trace id
- no decrypted secrets in frontend responses, logs, traces, cache keys, warnings, examples, or
  frame metadata

The adapter should reject unsupported query kinds and unsafe operations explicitly. It should not
return empty frames for unsupported operations.

## MySQL And MariaDB Compatibility

The initial frontend type is named MySQL and uses `mysql.database`.

MariaDB-compatible servers may be supported by the backend adapter only if the adapter validates
the same config, query, metadata, and result-normalization behavior. If MariaDB needs divergent
configuration, result mapping, or feature flags, add a separate ADR before introducing
`mariadb.database`.

## Implementation Tasks

- [ ] Extract reusable SQL connection primitives from PostgreSQL before adding MySQL-specific files.
- [ ] Add `connections/mysql/README.md`.
- [ ] Add `connections/mysql/index.ts` with `mysql.database`.
- [ ] Add MySQL public and secure config TypeScript types.
- [ ] Build MySQL config schema fields from the shared SQL schema builders, overriding only
  engine-specific defaults and option values.
- [ ] Add realistic examples and complete `usageGuidance` using the shared SQL guidance structure.
- [ ] Add a MySQL icon under `src/connections/assets/` and document it in the asset README.
- [ ] Reuse the shared SQL query editor without PostgreSQL-specific copy.
- [ ] Add an authoring contract that reuses shared SQL behavior and only overrides the safe
  `information_schema.tables` seed query.
- [ ] Register and verify the connection definition through the app registry.
- [ ] Add frontend tests for registry loading, field schema, authoring seed, query model ids, and
  PostgreSQL/MySQL SQL feature parity.
- [ ] Implement backend `mysql.database` adapter.
- [ ] Implement backend health check, pool caching, invalidation, metadata resources, SQL macro
  expansion, result normalization, row limits, timeouts, cache, and in-flight dedupe.
- [ ] Add backend tests for health, table query, time-series query, metadata, cache, timeout,
  permission, and unsupported operation behavior.

## Storage Contract Assessment

This ADR adds a new connection type and therefore changes the backend connection-type registry
sync payload once implemented. It does not change workspace storage by itself.

Persisted backend connection instances for MySQL must store:

- `type_id: "mysql.database"`
- public config in backend `public_config`
- encrypted password and TLS material in backend secure config
- secure field masks in frontend responses

Widgets should continue to store only stable `ConnectionRef` values. They must not store MySQL
hostnames, credentials, mutable connection names, or copied public config.

## Consequences

MySQL becomes a first-class configured data source in Command Center using the same connection
model as PostgreSQL and TimescaleDB. Users can create, select, test, and author MySQL connection
queries through shared connection UI, while the backend remains responsible for all network,
credential, permission, execution, and normalization behavior.
