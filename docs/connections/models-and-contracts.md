# Connection Models And Contracts

The canonical TypeScript definitions live in `src/connections/types.ts`. This page explains how
those models are meant to be used when extending the platform.

## Connection Type Definition

`ConnectionTypeDefinition<TPublicConfig, TQuery>` is frontend-owned metadata. It is registered by
an extension and synced to the backend registry as a JSON-safe manifest.

Required fields:

- `id`: globally unique stable type id; review backend registered types and adapter ids before
  choosing it, and make it match backend adapter `type_id`
- `version`: positive integer; increment when schemas, query models, or guidance materially change
- `title`: catalog label
- `description`: short catalog summary
- `source`: provider or extension namespace
- `category`: catalog grouping, such as `Databases`, `Observability`, or `Market Data`
- `capabilities`: supported runtime capabilities
- `accessMode`: where runtime access is allowed
- `publicConfigSchema`: persisted non-secret instance config

Optional fields:

- `iconUrl`: logo used by picker and catalog UI
- `tags`: search and catalog hints
- `secureConfigSchema`: write-only secret fields
- `queryModels`: query paths the shared workbench and widgets can run
- `requiredPermissions`: minimum frontend-advertised platform permissions
- `configEditor`: custom React editor for public config
- `queryEditor`: custom React editor for query payloads
- `exploreComponent`: custom Explore shell
- `usageGuidance`: agent-facing and catalog-facing Markdown
- `examples`: realistic public config and query examples

The definition must not contain organization-specific values, tokens, passwords, mutable instance
state, health state, or runtime clients.

## Capabilities

`capabilities` advertises which backend adapter operations exist:

- `query`: accepts `ConnectionQueryRequest` and returns `ConnectionQueryResponse`
- `resource`: accepts named resource requests for metadata or editor support
- `stream`: supports long-lived channels
- `mutation`: performs write-like provider operations
- `health-check`: supports `testConnection(uid)`

Only advertise capabilities the backend adapter actually implements.

## Access Mode

`accessMode` describes the runtime boundary:

- `proxy`: browser sends requests to Command Center backend; backend talks to provider
- `browser`: browser may directly access the provider; use only for safe public/browser-native
  providers
- `server-only`: backend-only runtime; browser can configure and request execution but must never
  directly interact with the provider

Most real data-source connections should use `proxy`.

## Config Schemas

`publicConfigSchema` describes non-secret fields stored on the backend connection instance.
Examples: host, database, selected resource id, default limit, timeout, cache policy, dedupe flag.

`secureConfigSchema` describes write-only secret fields. Examples: password, bearer token, private
key, TLS material, service account JSON. The frontend may send these values on create/update, but
later reads receive only `secureFields` masks.

Field contract:

- `id`: exact stored key
- `sectionId`: optional grouping section
- `label`: UI label
- `description`: required help text; this is the source for the config form help affordance
- `type`: `string`, `number`, `boolean`, `select`, `json`, or `secret`
- `required`: whether the user must provide it
- `defaultValue`: initial/default value when available
- `options`: select options
- `visibleWhen`: conditional visibility rules tied to another field id

Every public or secure field must also be documented in `usageGuidance` with field key, UI label,
type, required/optional status, default, example, meaning, validation constraints, and whether the
frontend, backend adapter, or both use it.

## Query Models

`queryModels` describe query paths exposed by the connection. They are not the query payload
itself; they are catalog metadata and workbench controls.

Fields:

- `id`: stable query model id; should match `query.kind`
- `label`: UI label
- `description`: what the query does
- `outputContracts`: normalized widget contracts the backend can return
- `defaultOutputContract`: preferred response contract when more than one is possible
- `defaultQuery`: seed payload merged with `{ kind: id }`
- `controls`: descriptive list of provider-specific controls exposed by the custom query editor
- `timeRangeAware`: whether the shared workbench sends top-level `timeRange`
- `supportsVariables`: whether the shared variables editor is shown and `variables` are sent
- `supportsMaxRows`: set `false` when the shared `maxRows` field should be hidden and omitted

The shared `ConnectionQueryWorkbench` filters query models to runtime frame paths that advertise
supported frame contracts. It uses `timeRangeAware`, `supportsVariables`, and `supportsMaxRows` to
render shared runtime controls.

`controls` is documentation/catalog metadata. It does not automatically render fields. The actual
provider-specific fields come from `queryEditor`.

## Query Payload

Use a discriminated `kind` field in `TQuery`:

```ts
export type MyConnectionQuery =
  | { kind: "rows"; table: string; columns?: string[]; limit?: number }
  | { kind: "metadata"; table: string };
```

Rules:

- keep `queryModels[].id` aligned with `query.kind`
- keep stable config in public config, not query payload
- keep ad hoc execution parameters in query payload
- use top-level `ConnectionQueryRequest.timeRange` for date windows when `timeRangeAware` is true
- use top-level `variables` only when the query model advertises `supportsVariables`
- use top-level `maxRows` only when `supportsMaxRows` is not `false`
- backend adapters must reject unknown `kind` values

## Runtime Request

The shared workbench and Connection Query widget send:

```ts
interface ConnectionQueryRequest<TQuery> {
  connectionUid: string;
  query: TQuery;
  requestedOutputContract?: ConnectionResponseContractId;
  timeRange?: { from: string; to: string };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  cacheMode?: "default" | "bypass" | "refresh";
  cacheTtlMs?: number;
}
```

The backend adapter resolves `connectionUid` to a backend-owned instance and treats the instance
public config as authoritative. Query payloads should not silently override resource-scoped public
config such as a selected Simple Table or Data Node.

## Runtime Response

Widget-bound queries return:

```ts
interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}
```

Frame rules:

- `fields` are columnar
- field names are unique within a frame
- every field in a frame has the same `values.length`
- `meta.rowCount`, when present, matches field length
- `warnings` describe truncation, cache behavior, coercion, provider limitations, or inferred
  metadata
- `traceId` should be included when the backend has one

Primary contracts:

- `core.tabular_frame@v1`: generic tabular rows
- `core.chart_data@v1`: render-engine-neutral chart-ready data
- `core.time_series_frame@v1`: legacy semantic time-series contract; current widgets generally
  consume tabular frames with `meta.timeSeries` hints

Provider-native JSON belongs in resource endpoints unless the query model explicitly advertises a
raw JSON-style widget contract.

## Connection Instance

`ConnectionInstance` is backend-owned and sanitized for the frontend:

- `uid`: stable runtime reference
- `typeId` and `typeVersion`: connection type identity
- `name` and optional `description`
- `organizationId` and optional `workspaceId`
- `publicConfig`: non-secret instance config
- `secureFields`: boolean masks indicating which secret fields are set
- `status`, `statusMessage`, `lastHealthCheckAt`
- audit metadata such as creator and timestamps

The frontend must treat `publicConfig` as read-only instance state except through connection create
or update flows. It must never expect secure values to come back.

## Connection Ref

Widgets and workspaces store only:

```ts
interface ConnectionRef {
  uid: string;
  typeId: string;
}
```

They should not store denormalized connection names, URLs, credentials, provider IDs, or backend
resource handles unless that value is part of the widget's actual query payload.

## Editors And Controls

`configEditor` edits stable public config during connection create/update. Use it when a schema
field alone is not enough, such as selecting a resource from a picker.

`queryEditor` edits provider-specific query payload fields inside the shared Connection Query
widget and shared Explore workbench. It receives:

- current query payload
- `onChange`
- selected connection instance
- selected connection type
- selected query model

Use shared controls from `src/connections/components/ConnectionQueryEditorFields.tsx` so query
editors behave consistently. Do not make query editors call provider APIs directly unless they call
connection resource endpoints for metadata.

`exploreComponent` is optional. Prefer the shared `ConnectionQueryWorkbench`; add a custom Explore
component only when the source needs a materially different workflow. Custom Explore components
should still use `queryConnection`, `fetchConnectionResource`, and
`ConnectionQueryResponsePreview`.

## Registry Sync

The frontend app registry collects connection definitions from root custom connections and
extension modules. Admin Settings publishes a JSON-safe sync payload to the backend registry.

The sync payload includes metadata, schemas, query models, required permissions, usage guidance,
examples, and active state. It does not include React components or runtime functions.

Backend add/manage UI should use backend-synced active connection types, not unsynced local
definitions.
