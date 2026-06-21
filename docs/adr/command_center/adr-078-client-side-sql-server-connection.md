# ADR 078: Client-Side SQL Server Connection Type

- Status: Accepted
- Date: 2026-06-15
- Related:
  - [ADR 077: Client-Side MySQL Connection Type](./adr-077-client-side-mysql-connection.md)
  - [ADR: PostgreSQL Custom Connection](./adr-postgresql-connection.md)
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [Connection Adapters](../../connections/adapters/README.md)

## Context

Command Center has a shared SQL connection layer used by PostgreSQL, TimescaleDB, and MySQL. That
layer owns the common frontend behavior for SQL database connections: config schemas, query models,
SQL authoring, usage guidance, examples, registry sync payloads, and backend-routed query
contracts.

SQL Server should be added as another first-class SQL database connection. It must not fork the
MySQL or PostgreSQL implementations. The user-facing behavior should remain the same wherever the
engine semantics are portable: configure a backend-owned SQL database, test it, browse metadata,
author SQL table queries, author SQL time-series queries, and return `core.tabular_frame@v1`.

The backend adapter contract uses `mssql.database`. The frontend must use that exact type id and
must not invent a parallel `sqlserver.database` alias.

## Decision

Add a root-level custom connection implementation under `connections/mssql/`.

The connection type id is:

```text
mssql.database
```

The frontend connection definition will contribute:

- public and secure config schemas for SQL Server connection instances
- complete schema field descriptions for `(i)` help and usage guidance
- query models for SQL table queries, SQL time-series queries, table metadata, and column metadata
- shared SQL query editor integration with SQL Server-specific default SQL only where the dialect
  differs
- an authoring contract that seeds a safe SQL Server metadata query
- examples and `usageGuidance`
- a SQL Server icon under `src/connections/assets/`

It will not register a sidebar app, widget, dashboard, shell menu, browser-side runtime, or direct
browser database client.

## Shared SQL DRY Requirement

SQL Server must reuse the shared SQL layer in `src/connections/sql/`. The implementation target is
one shared SQL authoring surface with provider-specific adapters, not separate PostgreSQL, MySQL,
and SQL Server UX branches.

Reuse these existing shared primitives:

- shared SQL query payload types for `sql-table`, `sql-time-series`, `schema-tables`, and
  `schema-columns`
- shared query model definitions and output contract declarations
- shared SQL query editor UI for SQL text and schema metadata lookups
- shared authoring contract behavior for query-model defaults, default row limits, and Explore
  copy
- shared pooling, statement timeout, row limit, cache TTL, metadata cache TTL, and in-flight dedupe
  config fields
- shared usage-guidance structure and field-guidance generation
- shared tests that assert SQL connection parity across PostgreSQL, TimescaleDB, MySQL, and SQL
  Server

Before adding `connections/mssql/`, refactor the shared SQL config builders so `sslMode` is
optional. PostgreSQL and MySQL should keep their existing `sslMode` behavior after the refactor,
but SQL Server must not expose `sslMode`, `encrypt`, `trustServerCertificate`,
`hostNameInCertificate`, TLS client certificates, or TLS client keys unless the backend contract is
expanded in a follow-up ADR.

The only intentional frontend differences between PostgreSQL, MySQL, and SQL Server should be:

- connection type id
- title, source, tags, icon, and branding copy
- default port
- default schema
- default metadata seed SQL
- time-series seed SQL quoting
- permission id
- backend adapter `type_id` and SQL dialect behavior

Any additional divergence must be documented in this ADR or a follow-up ADR.

## Frontend Contract

The initial public config shape must match the backend contract:

```ts
export interface MssqlPublicConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  defaultSchema?: string;
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

The first five fields map to the backend example shape:

```json
{
  "typeId": "mssql.database",
  "publicConfig": {
    "host": "<sql-server-host>",
    "port": 1433,
    "database": "<database-name>",
    "username": "<database-user>",
    "defaultSchema": "dbo"
  },
  "secureConfig": {
    "password": "<password>"
  }
}
```

The example above documents the payload shape only. `host`, `database`, `username`, and `password`
must never be treated as default values.

The initial secure config shape must match the backend contract:

```ts
export interface MssqlSecureConfig {
  password?: string;
}
```

Required instance fields:

| Field | Default | Notes |
| --- | --- | --- |
| `host` | none | Required per connection instance. Never hard-code an environment host as a default. |
| `database` | none | Required per connection instance. |
| `username` | none | Required per connection instance. |
| `password` | none | Required secure value; write-only. |

Defaultable fields:

| Field | Default | Notes |
| --- | --- | --- |
| `port` | `1433` | SQL Server default TCP port. |
| `defaultSchema` | `dbo` | Used by metadata lookups and unqualified authoring helpers. |
| `queryCachePolicy` | `safe` | Same shared SQL behavior as MySQL and PostgreSQL. |
| `statementTimeoutMs` | `30000` | Same shared SQL behavior as MySQL and PostgreSQL. |
| `rowLimit` | `1000` | Same shared SQL behavior as MySQL and PostgreSQL. |

The frontend query payload should mirror the shared SQL connection shape:

```ts
export type MssqlConnectionQuery =
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

Do not add `catalog` or cross-database query fields in the first release. A SQL Server connection
instance is scoped to one configured `database`; `schema` plus `table` is enough for metadata
queries. Add a follow-up ADR if cross-database metadata becomes required.

The default `sql-table` seed should be a safe metadata query:

```sql
select top (100) table_catalog, table_schema, table_name
from information_schema.tables
where table_catalog not in ('master', 'model', 'msdb', 'tempdb')
order by table_catalog, table_schema, table_name
```

The default `sql-time-series` seed should use SQL Server identifier quoting:

```sql
select [time], [value]
from dbo.metrics
where $__timeFilter([time])
order by [time]
```

## Query Models

The frontend should advertise these query models:

| Query model id | Payload discriminator | Time range aware | Output contract |
| --- | --- | --- | --- |
| `sql-table` | `kind: "sql-table"` | No | `core.tabular_frame@v1` |
| `sql-time-series` | `kind: "sql-time-series"` | Yes | `core.tabular_frame@v1` |
| `schema-tables` | `kind: "schema-tables"` | No | `core.tabular_frame@v1` |
| `schema-columns` | `kind: "schema-columns"` | No | `core.tabular_frame@v1` |

The query model ids and `query.kind` values must stay identical to the other shared SQL
connections so registry sync, authoring, widgets, and backend dispatch do not drift.

## Backend Adapter Requirements

The backend must implement a connection adapter whose `type_id` exactly matches:

```text
mssql.database
```

The adapter owns:

- resolving and decrypting secure config
- creating and invalidating SQL Server connection pools per connection instance
- SQL username/password authentication for the first release
- health checks
- SQL execution
- metadata resources
- permission checks
- row limits and statement timeouts
- result caching and in-flight dedupe
- SQL macro expansion
- conversion to `core.tabular_frame@v1`
- sanitized error and audit logging

The first release should not support Windows integrated auth, Kerberos, Azure AD, Entra ID,
token-based authentication, or frontend-configured TLS options. Add a follow-up ADR before
introducing those modes because they change public config, secure config, backend secret handling,
and user guidance.

The backend adapter should reuse common SQL adapter behavior where possible: health response shape,
cache policy, cache-key dimensions, in-flight dedupe, row-limit enforcement, permission checks,
metadata response shape, and frame normalization should match PostgreSQL/MySQL unless SQL Server
driver or dialect behavior requires a documented difference.

The frontend must never open SQL Server sockets, parse SQL Server credentials, or expand SQL
Server-specific SQL macros locally.

## SQL Macro Contract

The backend adapter should support the same Command Center macro surface as PostgreSQL and MySQL
where semantics are portable:

- `$__timeFilter(column)`
- `$__timeFrom()`
- `$__timeTo()`
- `$__interval`
- `$__interval_ms`

Macro expansion must be backend-owned because SQL Server timestamp syntax, quoting, timezone
handling, and parameter binding belong to the database adapter. SQL Server parameter binding should
use the backend driver's safe parameter API. Do not concatenate variable values into SQL text.

## Result Mapping

The backend adapter should normalize SQL Server result columns into `CommandCenterFrameField`
values.

Initial mapping:

- `date`, `datetime`, `datetime2`, `datetimeoffset`, `smalldatetime`, and `time` map to `time`
  fields when selected as the time column; otherwise they map to strings with temporal metadata.
- `int`, `bigint`, `smallint`, `tinyint`, `float`, `real`, and safe numeric values map to
  `number`.
- `decimal`, `numeric`, `money`, and `smallmoney` map to `number` only when precision can be
  represented safely; otherwise they map to strings with numeric metadata.
- `bit` maps to `boolean`.
- `char`, `varchar`, `nchar`, `nvarchar`, `text`, and `ntext` map to `string`.
- `uniqueidentifier` maps to `string` with UUID metadata when possible.
- `xml` maps to `string` or `json` only if explicitly normalized by the backend.
- `varbinary`, `binary`, `image`, `rowversion`, and `timestamp` should be omitted or returned as
  safe strings only when explicitly requested.

The adapter should include response metadata for row count, query kind, elapsed time, database,
schema/table context when known, and backend trace id.

## Security

SQL Server is a SQL execution bridge. Frontend validation is not a security boundary.

Security depends on:

- backend authorization before query execution, cache reads, or in-flight joins
- backend secret storage
- least-privilege SQL Server users
- read-only credentials for production analytics connections
- backend-owned transport security according to the adapter/runtime environment
- statement timeouts
- row limits
- audit logs that include connection uid, user uid, query kind, duration, and trace id
- no decrypted secrets in frontend responses, logs, traces, cache keys, warnings, examples, or
  frame metadata

The adapter should reject unsupported query kinds and unsafe operations explicitly. It should not
return empty frames for unsupported operations.

## Implementation Tasks

- [x] Refactor `src/connections/sql/sharedSqlConnection.ts` so `sslMode` is optional and SQL
  Server can omit it while PostgreSQL and MySQL keep their existing field.
- [x] Refactor shared secure config generation so SQL Server can expose only `password`.
- [x] Keep PostgreSQL and MySQL schema output unchanged after the shared config refactor.
- [x] Add `connections/mssql/README.md`.
- [x] Add `connections/mssql/index.ts` with `mssql.database`.
- [x] Add SQL Server public and secure config TypeScript types.
- [x] Build SQL Server config schema fields from the shared SQL schema builders, overriding only
  engine-specific defaults and omitting unsupported transport fields.
- [x] Add realistic examples and complete `usageGuidance` using the shared SQL guidance structure;
  examples must use placeholders, not environment-specific hostnames, usernames, databases, or
  passwords as defaults.
- [x] Add a SQL Server icon under `src/connections/assets/` and document it in the asset README.
- [x] Reuse the shared SQL query editor without SQL Server-only editor UI.
- [x] Add an authoring contract that reuses shared SQL behavior and only overrides SQL Server safe
  seed queries.
- [x] Register and verify the connection definition through the app registry.
- [x] Add `mssql:query` to frontend permission constants and platform-admin effective permissions.
- [x] Add frontend tests for registry loading, field schema, authoring seed, query model ids,
  PostgreSQL/MySQL/SQL Server parity, and SQL Server dialect seeds.
- [x] Ensure SQL Server tests fail if the default metadata query uses MySQL/PostgreSQL `limit`.
- [ ] Implement backend `mssql.database` adapter.
- [ ] Implement backend health check, pool caching, invalidation, metadata resources, SQL macro
  expansion, result normalization, row limits, timeouts, cache, and in-flight dedupe.
- [ ] Add backend tests for health, table query, time-series query, metadata, cache, timeout,
  permission, unsupported operation behavior, and SQL Server type normalization.

## Storage Contract Assessment

This ADR adds a new connection type and therefore changes the backend connection-type registry sync
payload once implemented. It does not change workspace storage by itself.

Persisted backend connection instances for SQL Server must store:

- `type_id: "mssql.database"`
- public config in backend `public_config`
- encrypted password in backend secure config
- secure field masks in frontend responses

Widgets should continue to store only stable `ConnectionRef` values. They must not store SQL Server
hostnames, credentials, mutable connection names, or copied public config.

## Consequences

SQL Server becomes a first-class configured data source in Command Center using the same connection
model as PostgreSQL, TimescaleDB, and MySQL. Users can create, select, test, and author SQL Server
connection queries through shared connection UI, while the backend remains responsible for all
network, credential, permission, execution, and normalization behavior.

The required shared SQL refactor prevents SQL Server from polluting the common SQL contract with a
fake `sslMode` abstraction and makes future SQL providers easier to add without copying frontend
connection code.
