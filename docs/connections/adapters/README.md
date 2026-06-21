# Connection Adapters

Connection adapters are backend runtime implementations for frontend connection types. The
frontend definition says what a connection can do; the adapter performs the health checks, queries,
resource calls, streaming, permission checks, secret access, provider calls, caching, and response
normalization.

## Required Relationship

Every adapter has a `type_id`. It must exactly match the frontend `ConnectionTypeDefinition.id`.

```text
frontend id:  postgresql.database
backend type: postgresql.database
```

TimescaleDB is a separate Command Center connection type with a PostgreSQL-compatible runtime
contract:

```text
frontend id:  timescaledb.database
backend type: timescaledb.database
```

MySQL follows the same first-class connection pattern, with its adapter contract documented in
[ADR 077: Client-Side MySQL Connection Type](../../adr/command_center/adr-077-client-side-mysql-connection.md):

```text
frontend id:  mysql.database
backend type: mysql.database
```

SQL Server follows the shared SQL connection pattern, with its adapter contract documented in
[ADR 078: Client-Side SQL Server Connection Type](../../adr/command_center/adr-078-client-side-sql-server-connection.md):

```text
frontend id:  mssql.database
backend type: mssql.database
```

If the ids do not match, the backend cannot dispatch configured connection instances to the right
runtime implementation.

## Adapter Lifecycle

1. Frontend publishes a connection type manifest through registry sync.
2. Backend stores the active connection type metadata.
3. Administrator creates a connection instance.
4. Backend stores public config and secret references.
5. Frontend calls test/query/resource/stream endpoints with `connectionId`.
6. Backend loads the instance, decrypts required secret material, builds request context, and
   dispatches to the adapter by `type_id`.
7. Adapter validates config and request payloads.
8. Adapter enforces permissions before cache reads, in-flight joins, or provider calls.
9. Adapter calls the provider and normalizes the result.
10. Backend serializes the normalized response back to the frontend.

## Adapter Operations

Adapters may implement:

- `test`: health check for one connection instance
- `query`: widget-bound or Explore-bound data execution
- `resource`: metadata or auxiliary lookups, often used by query editors
- `stream`: long-running or subscription-style channels
- `invalidate`: clear pools, tokens, caches, and in-flight operations after instance changes

Unsupported operations must fail explicitly. Do not silently return empty results for unsupported
resources, streams, or query kinds.

## Adapter Responsibilities

Adapters own:

- public config validation
- secure config validation after backend secret resolution
- provider clients, SDKs, connection pools, OAuth tokens, TLS material, and service credentials
- permission checks against platform and provider object-level access
- health checks
- query/resource/stream dispatch
- provider-specific escaping, parameterization, and macro expansion
- row limits, timeouts, pagination, and rate-limit handling
- completed-result cache policy
- in-flight dedupe policy
- provider error normalization
- response frame normalization
- sanitized audit summaries
- unsafe operation rejection

Adapters must not:

- return decrypted secrets
- trust query payloads over authoritative instance public config
- cache permission errors or provider errors
- include raw secret values in logs, traces, cache keys, warnings, examples, or metadata
- return provider-native payloads from widget-bound query models unless that model advertises an
  explicit raw JSON contract
- rely on frontend validation as a security boundary

## Request Contract

Widget-bound queries receive a `ConnectionQueryRequest`:

```ts
{
  connectionId: string | number;
  query: Record<string, unknown>;
  requestedOutputContract?: string;
  timeRange?: { from: string; to: string };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  cacheMode?: "default" | "bypass" | "refresh";
  cacheTtlMs?: number;
}
```

Adapters should dispatch on `query.kind`. Unknown kinds must be rejected with a typed bad-request
error.

## Response Contract

Widget-bound query responses must use:

```ts
{
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}
```

Use `core.tabular_frame@v1` for generic rows. Use semantic metadata or semantic contracts when the
adapter knows time, series, value, unit, chart, or primary-key meaning.

Resource endpoints may return raw structured provider metadata when the payload is for editors or
Explore workflows rather than widget binding.

## Cache And Dedupe

Cache and dedupe policy is part of the adapter contract. Keys should include:

- organization id
- user id or auth scope
- connection id
- connection type id and version
- instance update marker or config generation
- query kind or resource name
- normalized query/resource payload
- effective time range
- variables
- effective row limit
- relevant public config fields
- provider resource identity

Keys must not include raw secret values.

Permission checks must happen before returning cached results or joining an in-flight request.
Cache only successful complete responses.

## Current Backend Reference

The existing backend reference is:

```text
/Users/jose/code/MainSequenceServerSide/tdag-django/timeseries_orm/command_center/adapters/connections
```

It is useful for behavior and examples:

- base adapter and context
- registry
- frame helpers
- PostgreSQL cache/pool/dedupe behavior
- Prometheus provider/resource handling
- Main Sequence Data Node and Simple Table resource-scoped behavior
- market-data adapter query models

## TimescaleDB Adapter Contract

`timescaledb.database` reuses PostgreSQL adapter behavior for public config, secure config, query
kinds, resources, health checks, cache policy, in-flight dedupe, and `core.tabular_frame@v1`
normalization. The frontend sends Command Center public config keys such as `database` and
`username`; `database_name` and `database_user` remain physical data-source model fields only.

The type advertises `physicalDataSource.dataSourceClassType = "timescale_db"`,
`requiresCapabilities = ["sql-write", "timescale-extension"]`,
`defaultRegistrationMode = "auto-when-write-capable"`, and `managedLifecycle = false`. The backend
may create the physical TimeScaleDB source after create/update or successful test only when the
connection test works, the write probe works, and the `timescaledb` extension exists in
`pg_extension`.

New Python adapter documentation should follow the FastAPI/Pydantic contract for the owning
project, not the Django/DRF framework shape documented here.

## Adapter Documentation Checklist

Every adapter doc should name:

- `type_id`
- public config model and defaults
- secure config model and secret handling
- query kinds and payloads
- resource names and payloads
- stream channels, if any
- health-check behavior
- permission checks
- cache policy and cache-key dimensions
- in-flight dedupe policy
- response normalization and output contracts
- unsafe operations that must be rejected
- invalidation triggers
- tests required for the adapter
