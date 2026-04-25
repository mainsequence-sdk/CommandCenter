# ADR: First-Class Connection Model

- Status: Accepted
- Date: 2026-04-24
- Related:
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: Organization-Scoped Widget Type Configurations](./adr-organization-widget-type-configurations.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)

## Context

Command Center is extension-first: extensions register apps, surfaces, widgets, and themes through
the app registry, and the registry becomes the frontend source of truth for available product
building blocks.

Data access is not first-class yet. The current data layer is mostly a global mode switch between
mock and live functions such as fixed REST helpers, demo data loaders, and terminal socket adapters.
That is useful for demos and narrow features, but it does not model configured data access as an
administrator-owned resource.

The Prometheus integration exposed the gap. It is a data-source connector, not a standalone product
application. There was no shared connection type catalog, no configured connection instance model,
no generic connection picker, no normalized query API, no connection type sync, and no common
frontend contract for secrets, health, platform authorization metadata, query models, resources,
streams, or connector-specific exploration.

The project already has a strong pattern to reuse: widget type sync. Widget definitions are
projected into backend-safe manifests, versioned, checksummed, validated, and synced explicitly.
Connection types should follow the same pattern instead of being hard-coded into `src/data` or one
extension.

## Decision

Command Center will introduce connections as first-class architecture.

A connection type is code-owned and registered by an extension. It describes a class of connector:
its schema, capabilities, query models, access mode, health support, required platform permission
metadata, and usage guidance.

A connection instance is backend-owned and administrator-configured. It stores the selected
connection type, public config, health state, default flags, ownership, and audit metadata.
Secret values are not stored on `ConnectionInstance`; they are written to the backend's standard
secret storage abstraction and referenced by the connection instance. Authorization uses the
existing platform and Main Sequence permission systems; this ADR does not introduce a separate
connection-permission model.

Widgets, dashboards, workspaces, and app pages must refer to configured connections by stable
connection reference. They must not store credentials, base URLs, tokens, or mutable display names.

The model boundary is:

- connection types are registered by extensions
- connection instances are persisted by the backend
- secrets are accepted by the backend, stored only through the backend secret abstraction, and used
  only by backend runtime adapters
- widgets consume connection refs and typed query/resource/stream results
- normalized result frames bridge connection runtimes into widget IO contracts

This is a refactor boundary, not a compatibility layer. Existing connection-like props can be
replaced by connection refs when the owning widget or surface is migrated.

## Design

### Extend the extension registry

`AppExtension` should gain an optional `connections` field:

```ts
export interface AppExtension {
  id: string;
  title: string;
  description?: string;
  mockOnly?: boolean;
  widgets?: WidgetDefinition[];
  apps?: AppDefinition[];
  themes?: ThemePreset[];
  connections?: ConnectionTypeDefinition[];
}
```

`AppRegistry` should flatten and dedupe connection types the same way it handles widgets, apps, and
themes:

```ts
export interface AppRegistry {
  extensions: AppExtension[];
  widgets: WidgetDefinition[];
  apps: AppDefinition[];
  surfaces: AppSurfaceEntry[];
  shellMenuEntries: AppShellMenuEntry[];
  dashboards: DashboardDefinition[];
  themes: ThemePreset[];
  connections: ConnectionTypeDefinition[];
}
```

The registry should expose `appRegistry.connections` as the frontend catalog of available
connection type definitions.

Custom connection implementations can also live under the root-level `connections/` directory.
The app registry should auto-load `connections/*/index.ts` and merge those connection definitions
into `appRegistry.connections`. This keeps connector implementations out of `extensions/` when they
do not own apps, widgets, dashboards, or shell navigation.

### Define connection type metadata

Add `src/connections/types.ts`.

The first contract should include:

```ts
export type ConnectionCapability =
  | "query"
  | "stream"
  | "resource"
  | "mutation"
  | "health-check";

export type ConnectionAccessMode = "proxy" | "browser" | "server-only";

export interface ConnectionSchemaField {
  id: string;
  label: string;
  description?: string;
  type: "string" | "number" | "boolean" | "select" | "json" | "secret";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
}

export interface ConnectionConfigSchema {
  version: number;
  sections?: Array<{ id: string; title: string; description?: string }>;
  fields: ConnectionSchemaField[];
}

export interface ConnectionQueryModel {
  id: string;
  label: string;
  description?: string;
  outputContracts: WidgetContractId[];
  timeRangeAware?: boolean;
  supportsVariables?: boolean;
}

export interface ConnectionTypeDefinition<
  TPublicConfig extends Record<string, unknown> = Record<string, unknown>,
  TQuery extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  version: number;
  title: string;
  description: string;
  source: string;
  category: string;
  iconUrl?: string;
  tags?: string[];

  capabilities: ConnectionCapability[];
  accessMode: ConnectionAccessMode;

  publicConfigSchema: ConnectionConfigSchema;
  secureConfigSchema?: ConnectionConfigSchema;

  queryModels?: ConnectionQueryModel[];
  requiredPermissions?: string[];

  configEditor?: ComponentType<ConnectionConfigEditorProps<TPublicConfig>>;
  queryEditor?: ComponentType<ConnectionQueryEditorProps<TQuery>>;
  exploreComponent?: ComponentType<ConnectionExploreProps>;

  usageGuidance?: string;
  examples?: Array<{
    title: string;
    publicConfig?: Partial<TPublicConfig>;
    query?: Partial<TQuery>;
  }>;
}
```

This definition is type-level metadata. It must not contain organization-specific config,
credentials, or runtime health state.

`queryEditor` is a frontend rendering hook for connection-specific query payload fields. It should
receive the selected backend-owned connection instance, selected query model, requested output
contract, current typed query value, and `onChange`. Use it to render adapter-specific kwargs such
as SQL parameters, Data Node column/filter fields, or Prometheus matcher lists. The generic
Connection Query widget must keep the standard request envelope generic instead of hardcoding those
fields.

### Persist connection instances in the backend

Add a backend-owned `ConnectionInstance` model and expose only sanitized data to the frontend:

```ts
export interface ConnectionInstance {
  id: string;
  uid: string;
  typeId: string;
  typeVersion: number;

  name: string;
  description?: string;
  organizationId?: string;
  workspaceId?: string | null;

  publicConfig: Record<string, unknown>;
  secureFields: Record<string, boolean>;

  status: "unknown" | "ok" | "error" | "disabled";
  statusMessage?: string;
  lastHealthCheckAt?: string;

  isDefault?: boolean;
  tags?: string[];

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
```

Secret values are write-only from the frontend perspective. The backend may return a derived
`secureFields.apiToken = true` mask, but it must never return the token. `secureFields` is a
response shape, not trusted secret storage.

Widgets and dashboards should store:

```ts
export interface ConnectionRef {
  uid: string;
  typeId: string;
}
```

They should not store connection URLs, tokens, or denormalized connection names.

### Add a normalized query and frame contract

Connections should return typed frames that can feed widget IO contracts:

```ts
export interface ConnectionQueryRequest<TQuery = Record<string, unknown>> {
  connectionUid: string;
  query: TQuery;
  timeRange?: {
    from: string;
    to: string;
  };
  variables?: Record<string, string | number | boolean>;
  maxRows?: number;
  cacheTtlMs?: number;
}

export interface CommandCenterFrameField {
  name: string;
  type: "time" | "number" | "string" | "boolean" | "json";
  values: unknown[];
  labels?: Record<string, string>;
  config?: {
    unit?: string;
    displayName?: string;
    decimals?: number;
  };
}

export interface CommandCenterFrame {
  name?: string;
  contract: WidgetContractId;
  fields: CommandCenterFrameField[];
  meta?: Record<string, unknown>;
}

export interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}
```

Connection query responses should be transformed into existing widget contracts where possible,
such as tabular frames, time-series frames, scalar statistics, order books, positions, or
extension-specific contracts.

### Add backend endpoint configuration

Add connection endpoint paths to the central Command Center config:

```yaml
connections:
  types:
    list_url: /api/v1/command_center/connection-types/
    detail_url: /api/v1/command_center/connection-types/{id}/
    sync_url: /api/v1/command_center/connection-types/sync/

  instances:
    list_url: /api/v1/command_center/connections/
    detail_url: /api/v1/command_center/connections/{uid}/
    test_url: /api/v1/command_center/connections/{uid}/test/
    query_url: /api/v1/command_center/connections/{uid}/query/
    resource_url: /api/v1/command_center/connections/{uid}/resources/{resource}/
    stream_url: /api/v1/command_center/connections/{uid}/stream/
```

`src/config/command-center.ts` should parse these paths the same way it already parses workspaces,
saved widgets, widget types, auth, RBAC, and notifications.

### Add connection type sync

Add `src/app/registry/connection-type-sync.ts`, modeled after widget type sync.

It should:

- read `appRegistry.connections`
- validate required metadata
- project a JSON-safe manifest
- compute a checksum
- allow platform admins to preview the manifest from Admin Settings
- post to `/connection-types/sync/`
- treat backend-registered active connection types as the availability gate for add/manage UI

Recommended payload shape:

```ts
export interface ConnectionTypeSyncPayload {
  registryVersion: number;
  checksum: string;
  connections: Array<{
    typeId: string;
    typeVersion: number;
    title: string;
    description: string;
    source: string;
    category: string;
    iconUrl?: string;
    tags: string[];
    capabilities: ConnectionCapability[];
    accessMode: ConnectionAccessMode;
    publicConfigSchema: ConnectionConfigSchema;
    secureConfigSchema?: ConnectionConfigSchema;
    queryModels: ConnectionQueryModel[];
    requiredPermissions: string[];
    usageGuidance?: string;
    examples?: unknown;
    isActive: true;
  }>;
}
```

### Add a core Connections app

Add a built-in app under `src/extensions/core/apps/connections/`.

The app should include surfaces for:

- add a new connection from the backend-synced type catalog
- configured data-source list
- query exploration against a configured data source

Connection type sync belongs in platform Admin Settings next to widget registry sync because it is
a registry publication action, not a normal connection user workflow.

This app owns connection management. Individual data extensions should not each invent a separate
connection admin surface unless their domain has extra workflows layered on top of the shared model.

### Add widget-level connection support

Widgets should select connections through a reusable connection picker field or custom settings
component backed by the shared connection APIs.

Recommended schema concept:

```ts
{
  id: "connectionUid",
  label: "Market data connection",
  sectionId: "data",
  type: "connection",
  accepts: {
    typeIds: ["mainsequence.market-data"],
    capabilities: ["query", "stream"],
    outputContracts: ["timeseries@v1", "price-tick@v1"],
  },
}
```

Runtime helpers should provide:

```ts
useConnectionQuery({
  connectionUid: props.connectionUid,
  query: {
    kind: "price-history",
    symbol: props.symbol,
  },
  timeRange: dashboardTimeRange,
});

useConnectionStream({
  connectionUid: props.connectionUid,
  channel: "prices",
  params: { symbol: props.symbol },
  onMessage: handlePriceTick,
});
```

The important rule is that widgets consume configured connections and typed results. They do not
own credentials or connector configuration.

### Backend runtime adapter boundary

The backend should resolve a `ConnectionInstance` into a runtime adapter:

```ts
interface ConnectionAdapter {
  typeId: string;

  test(instance: RuntimeConnectionInstance): Promise<ConnectionHealthResult>;

  query(
    instance: RuntimeConnectionInstance,
    request: ConnectionQueryRequest,
    context: RequestContext,
  ): Promise<ConnectionQueryResponse>;

  resource?(
    instance: RuntimeConnectionInstance,
    resource: string,
    params: Record<string, unknown>,
    context: RequestContext,
  ): Promise<unknown>;

  stream?(
    instance: RuntimeConnectionInstance,
    channel: string,
    params: Record<string, unknown>,
    context: RequestContext,
  ): AsyncIterable<unknown>;
}
```

Adapter clients may be cached server-side and invalidated when public config changes or when a
referenced backend secret version changes.

### Provisioning

Backend provisioning should support connection instances as code, but secret values must come from
environment variables, a vault, or another backend-only secret source.

Frontend config may define endpoint paths and feature flags. It must not contain provisioned
secret-bearing connection instances.

## Main Sequence Data Node Gap Analysis

The current Main Sequence Data Node widget is the clearest migration target for proving this ADR.
It lives under `extensions/main_sequence/extensions/workbench/widgets/data-node-filter/` and acts as
a reusable dataset node in the workbench pipeline. It can fetch a direct Main Sequence data node,
consume another Data Node widget, accept manual rows, apply a transform, and publish a canonical
tabular dataset to downstream table, chart, and statistic widgets.

That behavior mixes two responsibilities:

- it is a widget-level dataset authoring and transformation node
- it is also acting as a connection client for Main Sequence dynamic table APIs

The second responsibility is the architectural gap this ADR must close. In direct mode the widget
stores a `dataNodeId` and calls fixed helpers such as `fetchDataNodeDetail` and
`fetchDataNodeDataBetweenDatesFromRemote`. Those helpers assume global backend configuration rather
than a configured connection instance. There is no connection type definition, no backend-owned
connection instance, no health check, no connection-level permission, no connection picker, and no
shared query model describing what direct Data Node queries return.

### Target Connection Type

The Data Node backend access should become a Main Sequence Data Node connection type:

```text
id: mainsequence.data-node
title: Main Sequence Data Node
source: main_sequence
category: Data
capabilities: query, resource, health-check
accessMode: proxy
```

The type should expose query and resource models that match the current widget needs:

- `data-node-detail` returns data node metadata and source table configuration
- `data-node-rows-between-dates` returns rows for a date range, selected columns, identifiers,
  bounds, and limit
- `data-node-last-observation` returns the latest available row snapshot
- `data-node-search` or `data-node-list` supports picker/catalog workflows when the backend exposes
  a stable listing endpoint

The primary output contract for row queries should be the existing tabular frame contract used by
the Data Node pipeline, currently represented by `MAIN_SEQUENCE_DATA_SOURCE_BUNDLE_CONTRACT`.
Connection query responses can still use the generic `CommandCenterFrame` envelope, but the frame
contract must remain consumable by existing downstream workbench widgets.

### What Moves To The Connection

The connection should own backend data access concerns:

- the selected Main Sequence Data Node identity (`dataNodeId`)
- display/cache metadata for the selected node (`dataNodeLabel`, `dataNodeStorageHash`)
- default query limits that apply to that configured Data Node source
- in-flight de-duplication policy for identical concurrent reads (`dedupeInFlight`, default enabled
  when omitted, with no completed-result caching)
- endpoint routing for Main Sequence dynamic table APIs inside the backend adapter
- health checks that prove the backend adapter can reach the Main Sequence API
- query permission enforcement before rows or metadata are returned
- resource access for data node metadata, schema, and picker support

The Data Node connection does not expose user-entered secret fields. Authentication and
authorization must flow through the platform/Main Sequence permission model and backend runtime
context. The frontend widget should not directly own dynamic table URLs, auth headers, service
credentials, or endpoint construction.

### What Stays In The Widget

The Data Node widget should remain the workbench source and transformation node:

- manual mode still stores user-authored rows in widget props
- bound-source mode still consumes another widget output and transforms it
- transform mode, projection, labels, limits, and published dataset behavior remain widget concerns
- downstream table, graph, statistic, and AI-assist consumers should keep reading the published
  `dataset` output

Direct mode should change from calling fixed helpers to issuing a connection query:

```ts
queryConnection({
  connectionUid: props.connectionRef.uid,
  query: {
    kind: "data-node-rows-between-dates",
    startDate,
    endDate,
    columns,
    uniqueIdentifierList,
    greatOrEqual,
    lessOrEqual,
    limit,
  },
});
```

The connection instance is the authority for which Data Node is queried. During migration, legacy
widgets may still send `dataNodeId`; the backend adapter should reject mismatches instead of letting
the query override the configured connection instance. This keeps the widget responsible for
authoring the dataset and keeps the connection responsible for trusted backend access.

### Gap Closure Criteria

This ADR should not be considered successfully implemented until the Main Sequence Data Node direct
source path proves the model end to end:

- a platform administrator can see or provision a `mainsequence.data-node` connection type
- a platform administrator configures each Data Node data source by selecting the actual Data Node,
  not by entering API roots, project scopes, or secrets
- a configured Data Node connection instance can be health checked
- direct-mode Data Node widgets store a stable connection reference plus query props
- direct-mode widget execution no longer imports or calls fixed dynamic table fetch helpers
- query responses are normalized into the existing tabular dataset contract
- existing Data Node table, graph, and statistic consumers keep working from the published dataset
- backend-side Main Sequence/platform authorization and secret handling are enforced for Data Node
  queries

## Backend Data Model

The backend should add:

### What The Original Model Got Wrong

The earlier backend sketch was wrong because it listed `encrypted_secure_config` and
`secure_fields` as fields on `ConnectionInstance`. That creates two problems:

- it suggests connection instances directly own secret storage instead of using the platform's
  general secret infrastructure
- it makes `secure_fields` look like persisted security data, when it should only be a sanitized
  response mask derived from stored secret references

The corrected model below treats secret values as a general backend concern. Connection instances
reference secrets by key and scope; they do not store plaintext secrets, ciphertext blobs, or secret
field masks directly.

### ConnectionType

- `id`
- `version`
- `title`
- `description`
- `source`
- `category`
- `icon_url`
- `capabilities`
- `public_config_schema`
- `secure_config_schema`
- `query_models`
- `required_permissions`
- `checksum`
- `is_active`
- `created_by_user`
- `creation_date`
- `updated_at`

### ConnectionInstance

- `id`
- `uid`
- `organization_id`
- `workspace_id`
- `type_id`
- `type_version`
- `name`
- `description`
- `public_config`
- `status`
- `status_message`
- `last_health_check_at`
- `is_default`
- `tags`
- `created_by_user`
- `creation_date`
- `updated_at`

`ConnectionInstance` must not persist secret values or secret masks. The API serializer should add
`secureFields` / `secure_fields` by deriving it from active `ConnectionSecretBinding` rows.

### ConnectionSecretBinding

This is a general reference model for connection-owned secrets. It should point to the platform's
standard encrypted secret, credential, or vault-reference model rather than inventing a new JSON
secret store.

- `id`
- `connection_instance`
- `key`
- `secret_ref`
- `secret_version`
- `created_by_user`
- `creation_date`
- `updated_at`

Rules:

- `key` must match a field id from the connection type's `secure_config_schema`.
- `secret_ref` must reference the platform's standard encrypted secret/vault object.
- `(connection_instance, key)` must be unique.
- deleting a connection instance must delete its bindings, but secret lifecycle should follow the
  platform's standard secret-retention policy.
- rotating a secret should create or point to a new secret version and invalidate any cached runtime
  adapter/client for that connection instance.

The frontend create/update payload may include:

```ts
{
  secureConfig: {
    basicPassword: "new password",
    bearerToken: "new token"
  }
}
```

The backend must immediately write those values into the platform secret store, persist only
bindings/references, and return only:

```ts
{
  secureFields: {
    basicPassword: true,
    bearerToken: true
  }
}
```

The frontend must never receive secret values after create/update.

### ConnectionHealthCheck

- `id`
- `connection_uid`
- `status`
- `message`
- `latency_ms`
- `checked_at`

### Backend Implementation Notes

The model above is intentionally general. Prometheus, PostgreSQL, Main Sequence Data Node, and any
future connector should use the same `ConnectionType`, `ConnectionInstance`,
`ConnectionSecretBinding`, and `ConnectionHealthCheck` foundation.

Create and update flow:

1. Authorize the user with the existing platform/Main Sequence permission system.
2. Verify the requested `type_id` and `type_version` are active in `ConnectionType`.
3. Validate `public_config` against the synced `public_config_schema`.
4. Validate submitted secure keys against `secure_config_schema`.
5. Store public values on `ConnectionInstance.public_config`.
6. Write each submitted secure value to the platform secret store.
7. Upsert one `ConnectionSecretBinding` per secure key.
8. Return the sanitized connection instance with a derived `secure_fields` mask.

Read flow:

1. Authorize the user with the existing platform/Main Sequence permission system.
2. Return `ConnectionInstance` public fields and derived `secure_fields`.
3. Never return secret values or platform secret references to the frontend.

Runtime query/test/resource flow:

1. Authorize the requested action with the existing platform/Main Sequence permission system.
2. Resolve the `ConnectionInstance`.
3. Resolve active `ConnectionSecretBinding` rows.
4. Fetch/decrypt secret values through the platform secret abstraction inside the backend process.
5. Build the connector adapter runtime from public config plus resolved secrets.
6. Execute health, query, resource, or stream behavior.
7. Return only sanitized health/query/resource results.

What must not be implemented:

- no plaintext secret values in `ConnectionInstance.public_config`
- no ciphertext JSON blob directly on `ConnectionInstance`
- no persisted `secure_fields` JSON column treated as source of truth
- no frontend-readable secret references
- no connector-specific permission table separate from the platform permission model

## Migration Plan

### Stage 1: Add the model

Add the frontend registry extension, shared connection types, backend API client, config paths,
connection type sync, and core Connections app.

Existing widgets can continue to call current data helpers during this stage.

### Stage 2: Add a system connection

Create a hidden built-in connection instance for the current Command Center backend and websocket
configuration.

Recommended identity:

```text
typeId: command-center.system-api
uid: system-default
source: core
visibility: hidden/system
```

This proves the model without forcing all widgets to migrate at once.

### Stage 3: Migrate one widget family

Move the Main Sequence Data Node direct source path first. It is the best proof target because it
already has a real backend-backed source, existing downstream consumers, and a clear split between
connection access and widget-level transformation behavior.

### Stage 4: Move domain connectors into custom connections

Prometheus should live under `connections/prometheus/` as a custom connection implementation. It
should contribute the `prometheus.remote` connection type, config schema, query models, and custom
Explore shell, but no standalone sidebar app, extension surfaces, or widgets. Other domain
connectors should follow the same model unless they truly own product applications.

### Stage 5: Retire hard-coded data helpers

Once migrated, `src/data/api.ts` should become a compatibility wrapper or be removed from core
runtime paths.

## Implementation Tasks

- [x] Add `src/connections/types.ts` with connection type, instance, reference, health, query
  request, query response, and frame contracts.
- [x] Extend `AppExtension` with `connections?: ConnectionTypeDefinition[]`.
- [x] Extend `AppRegistry` with `connections: ConnectionTypeDefinition[]`.
- [x] Flatten, dedupe, and expose `appRegistry.connections` in `src/app/registry/index.ts`.
- [x] Auto-load root-level custom connection entrypoints from `connections/*/index.ts`.
- [x] Add central connection endpoint paths to `command-center.yaml`.
- [x] Parse connection endpoint paths in `src/config/command-center.ts`.
- [x] Add `src/connections/api.ts` for type listing, instance CRUD, test, query, resource, and
  stream APIs.
- [x] Add `src/app/registry/connection-type-sync.ts` using the widget type sync pattern: validation,
  JSON-safe projection, checksum, preview, and backend sync.
- [ ] Add backend `ConnectionType`, `ConnectionInstance`, `ConnectionSecretBinding`, and
  `ConnectionHealthCheck` persistence models.
- [ ] Add backend endpoints for connection type sync, instance CRUD, health checks, queries,
  resources, and streams.
- [ ] Add backend secret handling so secure config values are written to the platform secret
  abstraction and returned only as a derived `secureFields` mask.
- [ ] Add backend runtime adapter caching and invalidation when connection config changes or when
  referenced secret versions change.
- [x] Add a Connections app with add-new, data-source list, and explore surfaces.
- [x] Add connection-owned custom Explore components with generic JSON Explore as the fallback.
- [x] Make the core Connections app visible only to platform administrators through the default
  application policy and RBAC metadata, not a custom visibility hack.
- [x] Add reusable connection picker support for widget settings.
- [x] Add `useConnectionQuery`, `queryConnection`, `useConnectionStream`, and resource helper
  APIs backed by the shared connection endpoints.
- [x] Add a hidden `command-center.system-api` system connection for current backend and websocket
  behavior so existing widgets can migrate incrementally.
- [x] Register a `mainsequence.data-node` connection type from the Main Sequence extension.
- [x] Define `mainsequence.data-node` query models for detail, rows between dates, last observation,
  and picker/list support.
- [ ] Define `mainsequence.data-node` health check behavior and required permissions.
- [x] Add a default or provisioned Main Sequence Data Node connection instance for existing
  workspaces during the migration slice.
- [x] Migrate the Data Node widget direct mode to store a `ConnectionRef` plus query props.
- [x] Migrate Data Node direct execution from `fetchDataNodeDetail` and
  `fetchDataNodeDataBetweenDatesFromRemote` to connection query/resource calls.
- [x] Preserve Data Node manual mode and bound-source mode as widget-owned behavior.
- [x] Preserve the Data Node published `dataset` output contract for existing table, graph, stat,
  and AI-assist consumers.
- [ ] Add tests or runtime checks proving Data Node direct mode produces the same tabular dataset
  shape before and after the migration.
- [x] Move Prometheus out of `extensions/` and into `connections/prometheus/` as a custom
  connection implementation.
- [x] Remove the standalone Prometheus sidebar app, app surfaces, and Prometheus extension widgets.
- [x] Gate connection catalogs on backend-active connection types, matching the widget type
  availability model.
- [x] Update local READMEs for new connection directories, the core Connections app, and migrated
  Main Sequence Data Node connection ownership.
- [ ] Notify the backend side that this changes persisted widget/workspace contracts wherever
  migrated widgets replace ad hoc source props with `ConnectionRef`.

## Non-Goals

- Recreating a separate plugin runtime in the browser.
- Allowing frontend code to read or persist secret values.
- Making every existing widget compatible during the first implementation slice.
- Treating connections as widgets.
- Treating widgets as connection instances.
- Adding connector-specific admin screens before the shared Connections app exists.

## Storage Contract Assessment

This ADR introduces storage and backend contract changes.

New backend-owned contracts are required for:

- connection type registry rows
- connection instances
- connection secret bindings to the platform secret store
- connection health checks
- connection type sync payloads
- query, resource, stream, and test endpoints

Connection authorization remains part of the existing platform and Main Sequence permission
systems. The connection backend must call those standard permission checks instead of implementing
a separate connection-specific permission table.

Saved widget and workspace contracts should change when widgets migrate from ad hoc connection props
to `ConnectionRef`.

The desired persisted widget shape is:

```ts
{
  connectionRef: {
    uid: "<connection-uid>",
    typeId: "<connection-type-id>"
  }
}
```

or equivalent widget-specific props that store the same stable reference fields.

Credentials, API tokens, passwords, certificates, and secret-bearing config must never be stored in
workspace, dashboard, widget, binding, runtime-state, preference, or frontend config documents.
Secret values must also not be stored directly on `ConnectionInstance`; only public config belongs
there. Secret values must live in the backend's standard secret store and be exposed to connection
runtime adapters only after backend authorization succeeds.

## Consequences

### Positive

- Data access becomes a first-class platform concept instead of a global mock/live mode.
- Extensions and root-level custom connection implementations can register connector types without
  hard-coding them into core data helpers.
- Backend-managed instances create a safe place for public config, health, provisioning, audit
  metadata, and references to platform-managed secrets.
- Widgets gain a reusable way to consume data sources through typed query results and existing IO
  contracts.
- Prometheus becomes a backend-managed data-source connection instead of a separate sidebar app.

### Negative

- This is a cross-cutting refactor across registry, config, backend contracts, connection UI,
  widget settings, and runtime data access.
- Existing widget props that encode source selection will need migration.
- The backend must enforce existing platform and Main Sequence permissions; frontend filtering
  alone is insufficient.
- Type sync and widget catalogs now have a parallel connection catalog that must be maintained with
  the same rigor.
