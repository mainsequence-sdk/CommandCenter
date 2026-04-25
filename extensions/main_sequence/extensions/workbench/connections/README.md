# Main Sequence Workbench Connections

This directory owns connection type definitions and compatibility runtime helpers for Main Sequence
Workbench data access.

## Entry Points

- `dataNodeConnection.ts`: registers the `mainsequence.data-node` connection type and exposes
  query helpers for Data Node metadata, date-range rows, and latest observations.
- `DataNodeConnectionConfigEditor.tsx`: connection-specific create/edit UI that reuses the
  workbench Data Node quick-search picker so a configured data source represents one concrete
  Data Node.
- `DataNodeConnectionExplore.tsx`: Data Node Explore wrapper around the shared
  `ConnectionQueryWorkbench`. It keeps Data Node source metadata in the connection instance and
  delegates query authoring, request generation, test execution, and response preview to the same
  workbench used by the core Connection Query widget.
- `DataNodeConnectionQueryEditor.tsx`: typed Connection Query widget editor for Data Node row and
  latest-observation payloads. It renders columns, unique identifier filters, inclusive range
  flags, limits, and legacy Data Node id fallback only when the selected instance has no
  configured Data Node.
- `simpleTableConnection.ts`: registers the `mainsequence.simple-table` connection type and the
  `simple-table-sql` query model for backend-scoped SQL against one configured Simple Table.
- `SimpleTableConnectionConfigEditor.tsx`: connection-specific create/edit UI that asks the user
  to select a Main Sequence Simple Table, then loads detail metadata so columns can be inspected
  before saving the data source.
- `SimpleTableConnectionExplore.tsx`: Simple Table Explore wrapper around the shared
  `ConnectionQueryWorkbench`. It shows configured table metadata and delegates SQL query
  authoring, request generation, test execution, and response preview to the same workbench used by
  the core Connection Query widget.
- `SimpleTableConnectionQueryEditor.tsx`: typed Connection Query widget editor for Simple Table
  SQL, row limits, and parameter objects.

## Behavior

- The connection type is extension-owned metadata surfaced through `appRegistry.connections`.
- The connection type uses the shared Main Sequence brand mark from `config/branding/logo_mark.png`
  for catalog and data-source UI.
- Backend-owned connection instances should handle health checks, platform permissions, and query
  execution.
- A Main Sequence Data Node connection instance is configured by selecting a concrete Data Node.
  Its public config stores `dataNodeId`, optional display metadata (`dataNodeLabel`,
  `dataNodeStorageHash`), `defaultLimit`, `queryCachePolicy`, `queryCacheTtlMs`, and
  `dedupeInFlight`. It does not expose user-entered secrets.
- `queryCachePolicy` controls completed-result caching for read operations. `queryCacheTtlMs`
  defaults to `900000` milliseconds, which is 15 minutes.
- `dedupeInFlight` is a backend request-sharing policy for identical concurrent cache misses. It
  should default to enabled when omitted.
- Until the backend connection endpoints are available, the default system Data Node connection
  falls back to the existing authenticated Main Sequence API helpers. Widgets call this connection
  module instead of importing dynamic-table fetch helpers directly.
- The Connection Query widget uses the Data Node connection's typed `queryEditor` for per-query
  kwargs. The generic widget owns the standard envelope (`connectionUid`, `query`, `timeRange`,
  variables, and row limits); Data Node-specific fields stay in the Data Node connection module.
- Data Node query models do not advertise `supportsVariables`, so the generic variables editor is
  hidden and variables are omitted from Data Node connection requests.
- Main Sequence Explore shells should stay aligned with the core Connection Query widget: select a
  connection path, edit that path through the connection query editor, build the standard
  `ConnectionQueryRequest`, and preview the normalized runtime frame through
  `ConnectionQueryWorkbench`. Do not reintroduce separate Data Node pickers, Simple Table SQL run
  paths, Unix-second inputs, or direct row/helper calls here.
- Main Sequence connection explorers should render query responses through the shared
  `ConnectionQueryResponsePreview` path. When a response normalizes as a canonical tabular frame
  with `meta.timeSeries` hints, that shared preview exposes Graph and Table views using the core
  graph model and TradingView chart renderer.
- A Main Sequence Simple Table connection instance is configured by selecting one concrete Simple
  Table. Its public config stores `simpleTableId`, optional display metadata
  (`simpleTableLabel`, `simpleTableStorageHash`, `simpleTableIdentifier`), `defaultLimit`,
  `statementTimeoutMs`, `queryCachePolicy`, `queryCacheTtlMs`, and `dedupeInFlight`.
- Simple Table Explore intentionally exposes one path: read-only SQL. The shared workbench sends
  `query.kind = "simple-table-sql"` with `sql`, optional `parameters`, and standard envelope
  fields such as `maxRows`; the backend adapter owns SQL validation, placeholder expansion,
  execution, and response normalization.
- The Simple Table Connection Query editor renders the same SQL payload shape inside the generic
  widget so saved source widgets are not forced to edit raw JSON.

## Maintenance Constraints

- Keep direct Main Sequence dynamic table endpoint construction inside this connection module or
  the backend adapter. Data Node widgets should not own backend route construction.
- Do not add connection-level secret fields for Data Node access. Authentication and authorization
  must flow through the platform/Main Sequence permission model and backend runtime context.
- Treat `queryCachePolicy`, `queryCacheTtlMs`, and `dedupeInFlight` as backend adapter behavior:
  key caches by connection uid, query/resource kind, resolved Data Node id, normalized request
  payload, user/permission context, and effective row limit.
- Preserve the Data Node row query's semantic contracts when changing connection query response
  normalization: `data-node-rows-between-dates` should publish `core.tabular_frame@v1` and include
  `meta.timeSeries` when time/value semantics are known.
- Preserve the same `core.tabular_frame@v1` output contract for Simple Table SQL results. Widgets
  should consume the normalized connection response rather than reaching directly into Simple Table
  API routes.

## Simple Table Backend Adapter Contract

The backend adapter for `type_id = "mainsequence.simple-table"` is the runtime owner for Simple
Table SQL execution. The frontend contract provides these public config fields:

- `simpleTableId?: number`
- `simpleTableLabel?: string`
- `simpleTableStorageHash?: string`
- `simpleTableIdentifier?: string`
- `defaultLimit?: number`
- `statementTimeoutMs?: number`
- `queryCachePolicy?: "disabled" | "safe"`
- `queryCacheTtlMs?: number`
- `dedupeInFlight?: boolean`

`queryCachePolicy` should default to `"safe"` when omitted. `queryCacheTtlMs` should default to
`300000` milliseconds when omitted, invalid, or less than or equal to zero. `statementTimeoutMs`
should default to `30000` milliseconds. `dedupeInFlight` should default to enabled unless the
stored public config value is exactly `false`.

### Runtime Resolution

Every adapter operation should first resolve the target Simple Table:

1. Read `configured_simple_table_id` from `public_config.simpleTableId`.
2. Reject requests when no configured Simple Table exists. Unlike the Data Node migration fallback,
   Simple Table SQL should not accept an ad hoc table id from the query payload.
3. Validate the resolved id is a positive integer.
4. Fetch `GET /orm/api/ts_manager/simple_table/{resolved_simple_table_id}/` to validate existence,
   permissions, storage hash, and column metadata before execution or health checks.

Permissions must be checked before execution and before joining any in-flight request. The minimum
permission advertised by the frontend is `main_sequence_foundry:view`; backend object-level checks
for the resolved Simple Table still apply.

### Operations

`query.kind = "simple-table-sql"`:

- Required query payload:
  - `sql: string`
- Optional query payload:
  - `maxRows?: number`
  - `parameters?: Record<string, string | number | boolean | null>`
- Resolve and validate the Simple Table id from the connection instance.
- Validate SQL as read-only. Reject writes, DDL, transaction control, unsafe function calls, and
  multi-statement payloads unless the backend parser can prove they are safe.
- Expand `{{simple_table}}` to the backend-authoritative physical table reference for the resolved
  Simple Table. Do not trust frontend-provided physical table names.
- Compute `effective_limit` from `query.maxRows`, then `request.maxRows`, then
  `public_config.defaultLimit`, then backend default. Clamp to the backend maximum.
- Apply `statementTimeoutMs` to the database statement.
- Return a `ConnectionQueryResponse` whose first frame uses the Data Node bundle tabular contract
  (`core.tabular_frame@v1`). Include warnings when row limits, SQL normalization, or cache behavior
  affected the result.

`testConnection(uid)`:

- Resolve the Simple Table id from configured public config only.
- Fetch the Simple Table detail endpoint.
- Return `ok` only when the table exists and the current backend context can view it.

### Cache And Dedupe Logic

`queryCachePolicy = "safe"` should cache successful read-only query results after permission
checks, target resolution, SQL normalization, parameter parsing, and effective limit calculation.
`"disabled"` should bypass both cache reads and writes.

Build cache and in-flight dedupe keys from:

- organization id
- user id or equivalent auth scope
- connection uid
- connection type id
- query kind
- resolved Simple Table id
- normalized SQL after placeholder handling
- normalized parameters
- effective row limit
- statement timeout
- connection instance update/version marker if available
- `simpleTableStorageHash` from public config when present

Do not cache validation errors, permission errors, upstream errors, partial failures, or unsafe SQL
rejections.

## Backend Adapter Contract

The backend adapter for `type_id = "mainsequence.data-node"` should be implemented as the runtime
owner for Data Node metadata and row access. The frontend contract provides these public config
fields:

- `dataNodeId?: number`
- `dataNodeLabel?: string`
- `dataNodeStorageHash?: string`
- `defaultLimit?: number`
- `queryCachePolicy?: "disabled" | "read"`
- `queryCacheTtlMs?: number`
- `dedupeInFlight?: boolean`

`queryCachePolicy` should default to `"read"` when omitted. `queryCacheTtlMs` should default to
`900000` milliseconds when omitted, invalid, or less than or equal to zero.

### Runtime Resolution

Every adapter operation should first resolve the target Data Node:

1. Read `configured_data_node_id` from the connection instance `public_config.dataNodeId`.
2. Read `requested_data_node_id` from the resource params or query payload `dataNodeId`.
3. If `configured_data_node_id` exists, use it as the authority.
4. If both ids exist and they differ, reject the request with a validation error.
5. If no configured id exists, require `requested_data_node_id`. This keeps the default/system
   migration connection usable while configured instances remain authoritative.
6. Validate the resolved id is a positive integer before hitting Main Sequence APIs.

Permissions must be checked before execution and before joining any in-flight request. The minimum
permission advertised by the frontend is `main_sequence_foundry:view`; backend object-level checks
for the resolved Data Node still apply.

### Operations

`resource = "data-node-detail"`:

- Accepted payload: `{ "dataNodeId": number }`
- Resolve and validate the Data Node id using the runtime resolution rules above.
- Execute `GET /orm/api/ts_manager/dynamic_table/{resolved_data_node_id}/`.
- Return the Data Node detail object or a wrapped detail payload that includes the same object.
- The result must include `sourcetableconfiguration` when the Data Node is row-queryable, because
  Explore and widgets use it to derive valid column names.

`query.kind = "data-node-detail"`:

- Same target resolution and execution as the `data-node-detail` resource.
- This is a resource-style response and should not advertise `core.tabular_frame@v1` unless the
  backend wraps it as a real frame.
- Reject unknown fields only if the backend query validator requires strict payloads; otherwise
  ignore non-semantic UI fields after logging them.

`query.kind = "data-node-rows-between-dates"`:

- Required effective inputs:
  - date window from the top-level connection request `timeRange`
  - `columns: string[]`
- Optional query payload:
  - `dataNodeId?: number`
  - `unique_identifier_list?: string[]`
  - `unique_identifier_range_map?: Record<string, [number, number]>`
  - `great_or_equal?: boolean`
  - `less_or_equal?: boolean`
  - `limit?: number`
- Resolve and validate the Data Node id.
- Normalize the date window by mapping `request.timeRange.from` and `request.timeRange.to` to the
  Data Node API's `start_date` and `end_date` Unix-second fields. The generic Connection Query
  widget owns the path and runtime date mode; it must not inject Data Node-specific date fields into
  query JSON.
- Validate `columns` is non-empty. Do not silently convert an empty list to all columns on the
  backend, because output shape should be explicit for widgets.
- Compute `effective_limit` from `query.limit`, then `request.maxRows`, then
  `public_config.defaultLimit`, then backend default. Clamp it to the backend maximum.
- Execute `POST /orm/api/ts_manager/dynamic_table/{resolved_data_node_id}/get_data_between_dates_from_remote/`
  with the normalized snake_case body.
- Return rows as a normalized `ConnectionQueryResponse` using one `core.tabular_frame@v1` frame.
  When a time field and numeric value fields are known, populate `meta.timeSeries` on that frame
  so Graph/Preview defaults can resolve automatically.

`query.kind = "data-node-last-observation"`:

- Accepted payload: `{ "dataNodeId"?: number }`
- Resolve and validate the Data Node id.
- Execute `POST /orm/api/ts_manager/dynamic_table/{resolved_data_node_id}/get_last_observation/`
  with `{}`.
- Return a normalized `ConnectionQueryResponse` containing one `core.tabular_frame@v1` frame.

`testConnection(uid)`:

- Resolve the Data Node id using configured public config only. For a system/default migration
  connection with no configured id, return `unknown` or `error` explaining that no Data Node is
  configured for health checks.
- Fetch the Data Node detail endpoint.
- Return `ok` only when the Data Node exists and the current backend context can view it.

### In-Flight Dedupe Logic

### Result Cache Logic

`queryCachePolicy` is the adapter-side completed-result cache switch:

- `"read"`: cache successful read results.
- `"disabled"`: do not read from or write to the completed-result cache.
- missing/unknown: treat as `"read"`.

`queryCacheTtlMs` is the completed-result cache lifetime. The default is `900000` milliseconds
(15 minutes). Clamp the value to a backend-safe maximum if needed, but do not silently use 30
seconds for Data Node connections.

Apply result caching to:

- `resource = "data-node-detail"`
- `query.kind = "data-node-detail"`
- `query.kind = "data-node-rows-between-dates"`
- `query.kind = "data-node-last-observation"`

Only cache successful responses after permission checks and after target Data Node resolution. Do
not cache validation errors, permission errors, upstream errors, or partial failures.

The result-cache key must be built from the same normalized dimensions as the in-flight dedupe key:

- organization id
- user id or equivalent auth scope
- connection uid
- connection type id
- operation kind: `resource` or `query`
- resource name or query kind
- resolved Data Node id
- normalized request payload
- effective row limit for row queries
- connection instance update/version marker if available
- `dataNodeStorageHash` from public config when present

Read-through cache order:

```text
resolve connection instance
resolve and validate Data Node id
check user/org/object permissions
normalize payload and defaults
if queryCachePolicy is read:
  build result cache key
  if fresh cached result exists: return it
if dedupeInFlight is enabled:
  join or create the in-flight operation for the same normalized key
execute upstream Data Node request on cache miss
if queryCachePolicy is read and execution succeeds:
  store result with expires_at = now + queryCacheTtlMs
return result
```

### In-Flight Dedupe Logic

`dedupeInFlight` is an adapter-side request-sharing switch for cache misses. The backend should
treat it as enabled unless the stored public config value is exactly `false`:

```text
dedupe_enabled = public_config.dedupeInFlight is not false
```

When `dedupe_enabled` is false, execute every cache miss normally.

When `dedupe_enabled` is true, the adapter should share one already-running backend operation for
identical cache misses. The completed response should still be written to the result cache when
`queryCachePolicy` is `"read"`.

Build the key after validation/defaulting, not directly from the raw request body. Include:

- organization id
- user id or equivalent auth scope
- connection uid
- connection type id
- operation kind: `resource` or `query`
- resource name or query kind
- resolved Data Node id
- normalized request payload
- effective row limit for row queries

For `data-node-rows-between-dates`, the normalized payload portion must include:

- `start_date`, derived from top-level `request.timeRange.from`
- `end_date`, derived from top-level `request.timeRange.to`
- `columns` in the requested order
- `unique_identifier_list` in the requested order
- `unique_identifier_range_map`
- `great_or_equal`
- `less_or_equal`
- `limit`

The key builder should use canonical JSON for objects with sorted keys, while preserving array
order. Drop only non-semantic `null`/missing values consistently; do not drop empty arrays except
where validation rejects them.

The execution shape should be:

```text
resolve connection instance
resolve and validate Data Node id
check user/org/object permissions
normalize payload and defaults
if dedupe disabled: execute operation
build dedupe key
under a short lock:
  if key exists in in_flight map: join that running operation
  otherwise create/register the operation
await the operation
remove the map entry in finally when the registered operation settles
return the result or raise the same error to all joined callers
```

The in-flight map entry must be deleted on both success and failure. A failed request should not
poison later requests. If multiple backend workers are running, this policy only dedupes inside one
worker process unless a distributed in-flight registry is added later.
