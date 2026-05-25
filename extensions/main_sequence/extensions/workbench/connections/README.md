# Main Sequence Workbench Connections

This directory owns connection type definitions and compatibility helpers for Main Sequence
Workbench data access.

## Entry Points

- `dataNodeConnection.ts`: registers `mainsequence.data-node` and exposes query helpers for Data
  Node metadata, date-range rows, and latest observations.
- `DataNodeConnectionConfigEditor.tsx`: Data Node connection setup UI. It reuses the workbench
  Data Node quick-search picker so a configured data source represents one concrete Data Node.
- `DataNodeConnectionQueryEditor.tsx`: typed Connection Query editor for Data Node row and
  latest-observation payloads.
- `dataNodeAuthoring.ts`: shared `authoringContract` for Data Sources Explore and
  widget-managed/standalone `connection-query` settings.
- `simpleTableConnection.ts`: legacy filename that now registers `mainsequence.meta-table` and the
  `meta-table-compiled-sql` query model for backend-scoped SQL against one configured MetaTable.
- `SimpleTableConnectionConfigEditor.tsx`: legacy filename that now exports the MetaTable config
  editor. It lets the user select a Main Sequence MetaTable and loads detail metadata for column
  preview.
- `SimpleTableConnectionQueryEditor.tsx`: legacy filename that now exports the MetaTable compiled
  SQL editor.
- `simpleTableAuthoring.tsx`: legacy filename that now defines the MetaTable authoring contract
  for SQL draft seeding, configured-table metadata, column preview badges, and Explore copy.

## Behavior

- Connection types are extension-owned metadata surfaced through `appRegistry.connections`.
- Both Main Sequence connection types use the shared Main Sequence brand mark from
  `config/branding/logo_mark.png`.
- Backend-owned connection instances handle health checks, platform permissions, and query
  execution.
- Data Node public config stores `dataNodeUid`, optional display metadata, `defaultLimit`,
  `queryCachePolicy`, `queryCacheTtlMs`, and `dedupeInFlight`.
- MetaTable public config stores `metaTableUid`, optional display metadata
  (`metaTableLabel`, `metaTableStorageHash`, `metaTableIdentifier`), `defaultLimit`,
  `statementTimeoutMs`, `queryCachePolicy`, `queryCacheTtlMs`, and `dedupeInFlight`.
- Main Sequence Explore shells should stay aligned with the core Connection Query widget: select a
  connection path, edit that path through the connection query editor, build the standard
  `ConnectionQueryRequest`, and preview the normalized runtime frame through
  `ConnectionQueryWorkbench`.

## MetaTable Backend Adapter Contract

The backend adapter for `type_id = "mainsequence.meta-table"` owns MetaTable compiled SQL
execution. The frontend contract provides these public config fields:

- `metaTableUid?: string`
- `metaTableLabel?: string`
- `metaTableStorageHash?: string`
- `metaTableIdentifier?: string`
- `defaultLimit?: number`
- `statementTimeoutMs?: number`
- `queryCachePolicy?: "disabled" | "safe"`
- `queryCacheTtlMs?: number`
- `dedupeInFlight?: boolean`

`queryCachePolicy` defaults to `"safe"`. `queryCacheTtlMs` defaults to `300000` milliseconds.
`statementTimeoutMs` defaults to `30000` milliseconds. `dedupeInFlight` defaults to enabled unless
the stored public config value is exactly `false`.

### Runtime Resolution

Every adapter operation should first resolve the target MetaTable:

1. Read `configured_meta_table_uid` from `public_config.metaTableUid`.
2. Reject requests when no configured MetaTable exists. MetaTable SQL should not accept an ad hoc
   table UID from the query payload.
3. Validate the resolved value is a non-empty UID string.
4. Fetch `GET /orm/api/ts_manager/meta_table/{resolved_meta_table_uid}/` to validate existence,
   permissions, storage hash, and column metadata before execution or health checks.

Permissions must be checked before execution and before joining any in-flight request. The minimum
permission advertised by the frontend is `main_sequence_foundry:view`; backend object-level checks
for the resolved MetaTable still apply.

### Operations

`query.kind = "meta-table-compiled-sql"`:

- Required query payload: `sql: string`
- Optional query payload: `maxRows?: number`,
  `parameters?: Record<string, string | number | boolean | null>`
- Resolve and validate the MetaTable UID from the connection instance.
- Validate SQL as read-only. Reject writes, DDL, transaction control, unsafe function calls, and
  multi-statement payloads unless the backend parser can prove they are safe.
- Expand `{{meta_table}}` to the backend-authoritative physical table reference for the resolved
  MetaTable. Do not trust frontend-provided physical table names.
- Compute `effective_limit` from `query.maxRows`, then `request.maxRows`, then
  `public_config.defaultLimit`, then backend default. Clamp to the backend maximum.
- Apply `statementTimeoutMs` to the database statement.
- Return a `ConnectionQueryResponse` whose first frame uses `core.tabular_frame@v1`.

`testConnection(id)`:

- Resolve the MetaTable UID from configured public config only.
- Fetch the MetaTable detail endpoint.
- Return `ok` only when the table exists and the current backend context can view it.

## Data Node Backend Adapter Contract

The backend adapter for `type_id = "mainsequence.data-node"` owns Data Node metadata and row
access. It resolves `dataNodeUid` from the configured connection instance, validates the UID,
executes the relevant `/orm/api/ts_manager/dynamic_table/{uid}/...` route, and returns normalized
`ConnectionQueryResponse` frames for row-oriented queries.

## Maintenance Constraints

- Keep direct Main Sequence endpoint construction inside this connection module or the backend
  adapter. Widgets should consume connection responses instead of owning backend route construction.
- Keep Data Node and MetaTable authoring defaults inside `dataNodeAuthoring.ts` and
  `simpleTableAuthoring.tsx`. That shared contract prevents Explore/widget drift.
- Do not add connection-level secret fields for Main Sequence access. Authentication and
  authorization flow through the platform/Main Sequence permission model and backend runtime
  context.
- Preserve `core.tabular_frame@v1` output for both Data Node row queries and MetaTable compiled SQL.
- The legacy filenames are intentionally not a backend contract. The registered connection id,
  query kind, public config field names, and endpoint paths are the contract.
