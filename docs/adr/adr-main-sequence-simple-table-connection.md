# ADR: Main Sequence Simple Table Connection

- Status: Accepted
- Date: 2026-04-25
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

Command Center already has a first-class connection model and a Main Sequence Data Node connection.
The Data Node connection is configured by selecting one Data Node, then the backend adapter owns
metadata and row reads for that selected resource.

Main Sequence Simple Tables need the same connection-level treatment, but the runtime behavior is
different:

- the user should select one Main Sequence Simple Table during connection setup
- once selected, the frontend should fetch Simple Table detail to get column metadata
- the runtime query surface should be SQL-based
- the Explore UI should reuse the PostgreSQL SQL editor behavior instead of inventing another SQL
  authoring surface

This is a table-scoped connection, not a general PostgreSQL database connection. The configured
Simple Table is the authority.

## Decision

Add a new connection type:

```ts
id: "mainsequence.simple-table"
title: "Main Sequence Simple Table"
source: "main_sequence"
category: "Data"
accessMode: "proxy"
capabilities: ["query", "resource", "health-check"]
```

The connection instance public config stores the selected Simple Table identity and query policy.
The backend adapter executes exactly one query model: SQL against the configured Simple Table.

The frontend config flow should mirror the Data Node connection:

1. Select a Main Sequence Simple Table.
2. Fetch Simple Table detail.
3. Store stable display/config fields on the connection public config.
4. Use the Simple Table columns to seed the SQL editor and result metadata.

## Public Config

The frontend connection type should define this public config shape:

```ts
export interface MainSequenceSimpleTableConnectionPublicConfig {
  simpleTableId?: number;
  simpleTableLabel?: string;
  simpleTableStorageHash?: string;
  simpleTableIdentifier?: string;
  defaultLimit?: number;
  statementTimeoutMs?: number;
  queryCachePolicy?: "disabled" | "safe";
  queryCacheTtlMs?: number;
  dedupeInFlight?: boolean;
}
```

Rules:

- `simpleTableId` is the authoritative selected resource.
- `simpleTableLabel`, `simpleTableStorageHash`, and `simpleTableIdentifier` are display/cache-key
  metadata only.
- `defaultLimit` defaults to `1000`.
- `statementTimeoutMs` defaults to `30000`.
- `queryCachePolicy` defaults to `"safe"`.
- `queryCacheTtlMs` defaults to `300000`.
- `dedupeInFlight` defaults to enabled unless explicitly set to `false`.

This connection must not expose secret fields. Authentication and authorization flow through the
Main Sequence/platform backend context.

## Query Model

The first implementation has one runtime query path:

```ts
export type MainSequenceSimpleTableConnectionQuery = {
  kind: "simple-table-sql";
  sql: string;
  maxRows?: number;
  parameters?: Record<string, string | number | boolean | null>;
};
```

Connection metadata:

```ts
queryModels: [
  {
    id: "simple-table-sql",
    label: "Simple Table SQL",
    description:
      "Executes read-only SQL against the configured Main Sequence Simple Table and returns a core.tabular_frame@v1 result.",
    outputContracts: ["core.tabular_frame@v1"],
    supportsVariables: true,
  },
]
```

No time-series query path should be added in the first pass. If a widget needs time-series shaping
later, it should consume the returned tabular frame or introduce a separate ADR for time-series
semantics.

## Frontend Behavior

### Config Editor

The config editor should reuse existing Main Sequence Simple Table APIs from
`extensions/main_sequence/common/api/index.ts`:

- `listSimpleTables(...)`
- `fetchSimpleTableDetail(simpleTableId)`

Selection behavior:

- render a Simple Table picker similar to the existing Data Node connection editor
- once the user selects a Simple Table, fetch detail
- derive display label from `storage_hash`, `identifier`, or fallback `Simple Table <id>`
- store `simpleTableId`, `simpleTableLabel`, `simpleTableStorageHash`, and
  `simpleTableIdentifier` in public config
- show detail-derived column names/types in the editor so the user can verify the selection

### Explore UI

The Explore UI should be SQL-only.

It should reuse the PostgreSQL connection SQL editor logic where possible:

- SQL text area/editor
- parameters JSON
- max rows
- run query button
- normalized frame/result preview
- error rendering

It should not expose PostgreSQL-specific database config controls, schema browser, or
time-series mode.

The editor should seed a default query after Simple Table detail loads:

```sql
select *
from {{simple_table}}
limit 100
```

The placeholder `{{simple_table}}` is frontend display sugar. The backend adapter must resolve the
actual table reference from the configured Simple Table and must not trust a user-supplied physical
table name as authority.

## Backend Adapter Contract

The backend adapter for `type_id = "mainsequence.simple-table"` is the runtime owner for Simple
Table SQL execution.

### Runtime Resolution

Every adapter operation must first resolve the configured Simple Table:

1. Read `configured_simple_table_id` from `connection.public_config.simpleTableId`.
2. Read optional `requested_simple_table_id` from payload only for compatibility/debugging.
3. If both ids exist and differ, reject the request with `400 invalid_simple_table_target`.
4. If no configured id exists, reject with `400 simple_table_not_configured`.
5. Validate the resolved id is a positive integer.
6. Fetch the Simple Table detail from the backend ORM/service layer.
7. Validate that the current user/org context can view the Simple Table before execution.

Permissions must be checked before reading caches or joining in-flight executions.

The frontend advertises `main_sequence_foundry:view` as the minimum permission, but backend
object-level Simple Table permission checks remain authoritative.

### Detail And Column Resolution

The backend must derive the executable table metadata from Simple Table detail, not from the SQL
string alone.

Required detail data:

- Simple Table id
- `storage_hash`
- `identifier`
- table/schema reference or backend-internal physical table handle
- column list
- column database types

Column metadata can come from:

- `detail.sourcetableconfiguration.columns_metadata`
- `detail.columns`
- backend ORM Simple Table metadata

The adapter should normalize columns into:

```ts
{
  name: string;
  dbType: string;
  nullable?: boolean;
  isPrimaryKey?: boolean;
}
```

### SQL Execution

Accepted query payload:

```json
{
  "kind": "simple-table-sql",
  "sql": "select * from {{simple_table}} limit 100",
  "maxRows": 1000,
  "parameters": {
    "region": "US"
  }
}
```

Execution rules:

- accept only `kind = "simple-table-sql"`
- require a non-empty SQL string
- support named parameters using the same parameter model as the PostgreSQL adapter where possible
- replace `{{simple_table}}` with the backend-resolved safe table reference
- reject statements that try to execute mutations, DDL, transaction control, or multiple
  statements
- enforce read-only execution at the database/session level where possible
- enforce `statementTimeoutMs`
- compute `effective_limit` from `query.maxRows`, then `request.maxRows`, then
  `public_config.defaultLimit`, then backend default
- clamp `effective_limit` to a backend-safe maximum
- return a normalized `ConnectionQueryResponse` with a `core.tabular_frame@v1` frame

The adapter should also protect the table scope. The first implementation should allow SQL that
uses the configured Simple Table through `{{simple_table}}`. Direct references to arbitrary
database tables should be rejected unless the backend can prove the query only reads the configured
Simple Table.

Recommended first-pass validator:

- allow one read-only `SELECT` or `WITH ... SELECT`
- require `{{simple_table}}` to appear in the SQL
- reject semicolon-separated multi-statements
- reject obvious write/DDL keywords outside string literals before execution
- execute under a read-only transaction/session

The keyword validator is not the only security boundary. Database read-only mode and backend table
scope resolution are mandatory.

### Response Shape

Preferred response:

```json
{
  "frames": [
    {
      "name": "simple_table_sql",
      "contract": "core.tabular_frame@v1",
      "fields": [
        {
          "name": "column_a",
          "type": "string",
          "values": ["..."]
        }
      ],
      "meta": {
        "simpleTableId": 123,
        "simpleTableStorageHash": "example_table",
        "rowCount": 100
      }
    }
  ],
  "meta": {
    "queryKind": "simple-table-sql",
    "effectiveLimit": 1000
  }
}
```

The frontend should continue to tolerate row-array wrappers if the backend adapter is rolled out
incrementally, but the target contract is a normalized connection frame.

### Health Check

`testConnection(uid)` should:

1. Require `public_config.simpleTableId`.
2. Fetch Simple Table detail.
3. Validate the current backend context can view it.
4. Return `ok` only if the table is visible and column metadata can be resolved.

If no Simple Table is configured, return a clear `error` or `unknown` state with
`simple_table_not_configured`.

### Cache And Dedupe

Apply completed-result caching only when `queryCachePolicy = "safe"`.

Cache key dimensions:

- organization id
- user id or auth scope
- connection uid
- connection type id
- connection instance version/update marker
- resolved Simple Table id
- `simpleTableStorageHash` when present
- normalized SQL after placeholder expansion
- normalized parameters
- effective row limit
- statement timeout

Do not cache:

- validation failures
- permission failures
- upstream database errors
- partial/streaming failures

In-flight dedupe should share one active execution for identical normalized cache-miss keys when
`dedupeInFlight !== false`.

## Frontend Implementation Tasks

### Phase 1: connection definition

- [x] Add `extensions/main_sequence/extensions/workbench/connections/simpleTableConnection.ts`
- [x] Register connection id `mainsequence.simple-table`
- [x] Define `MainSequenceSimpleTableConnectionPublicConfig`
- [x] Define `MainSequenceSimpleTableConnectionQuery`
- [x] Add one query model: `simple-table-sql`
- [x] Add examples and usage guidance
- [x] Export the connection from the workbench extension connection registry

### Phase 2: config editor

- [x] Add `SimpleTableConnectionConfigEditor.tsx`
- [x] Reuse `listSimpleTables(...)` and `fetchSimpleTableDetail(...)`
- [x] Let the user select one Simple Table
- [x] Fetch detail after selection and show columns
- [x] Store `simpleTableId`, label, storage hash, and identifier in public config
- [x] Add query policy controls for limit, timeout, cache, TTL, and in-flight dedupe

### Phase 3: Explore UI

- [x] Add `SimpleTableConnectionExplore.tsx`
- [x] Extract reusable SQL editor/result pieces from `connections/postgresql/PostgreSqlConnectionExplore.tsx`
- [x] Render SQL-only Explore for Simple Table connections
- [x] Seed SQL with `select * from {{simple_table}} limit 100`
- [x] Send `query.kind = "simple-table-sql"`
- [x] Render normalized frame results through the same result preview used by PostgreSQL Explore

### Phase 4: docs and registry sync

- [x] Add `extensions/main_sequence/extensions/workbench/connections/README.md` updates for the new connection
- [x] Add connection-specific backend adapter notes to the same README
- [x] Ensure connection-type sync includes the new definition
- [ ] Verify Connections app shows the type only after backend registry activation

### Phase 5: backend coordination

- [ ] Implement backend adapter for `type_id = "mainsequence.simple-table"`
- [ ] Implement read-only SQL execution with `{{simple_table}}` placeholder expansion
- [ ] Implement Simple Table permission checks before cache/dedupe
- [ ] Implement normalized `core.tabular_frame@v1` responses
- [ ] Implement health checks
- [ ] Implement cache and in-flight dedupe using the normalized dimensions above

## Rejected Alternatives

### Use the generic PostgreSQL connection directly

Rejected because this would expose database-level configuration to a user who only wants to query a
known Main Sequence Simple Table. It also weakens the table-scoped permission model.

### Add a general Simple Table REST query builder

Rejected for the first pass because the requested runtime path is SQL. A builder can be layered
later, but the first useful interface is a SQL editor with backend-enforced table scope.

### Let frontend construct physical table names

Rejected because the Simple Table id and backend detail must be authoritative. The frontend can
display labels and column hints, but the backend must resolve the executable table reference.

## Consequences

Positive:

- Simple Tables become reusable configured data sources
- SQL authoring reuses the PostgreSQL editor model
- backend remains the runtime/security owner
- widgets can consume normalized tabular frames without knowing Simple Table internals

Tradeoffs:

- the backend adapter needs a real SQL validation and read-only execution boundary
- the PostgreSQL Explore code likely needs extraction before it can be reused cleanly
- the first version is intentionally table-scoped and not a general multi-table SQL workspace
