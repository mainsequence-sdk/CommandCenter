# Connections

This directory owns the shared Command Center connection model introduced by the first-class
connection ADR. Connections are platform data-access resources, not widgets.

## Entry Points

- `types.ts`: extension-facing connection type metadata, backend-owned connection instance shapes,
  query/resource contracts, and health results.
- `api.ts`: authenticated frontend client for connection type, instance, health, query, resource,
  and stream endpoints. Instance list reads are backend-authoritative, do not inject local
  fallback records, and execution-time ref repair reloads the connection list from the backend
  instead of trusting a local module cache.
- `hooks.ts`: React Query wrappers for connection catalogs, instances, queries, and resources.
- `ConnectionQueryResponsePreview.tsx`: shared renderer for normalized connection query responses.
  It renders one canonical tabular frame as a table or, when `meta.timeSeries` hints are present,
  as a graph/table preview using the core graph renderer.
- `ConnectionExploreSurface.tsx`: generic Data Sources Explore surface. It reuses the same shared
  workbench used by connection-query widgets and delegates connection-specific behavior to each
  connection type's authoring contract.
- `ConnectionQueryWorkbench.tsx`: shared query authoring, generated request preview, test
  execution, and normalized response preview surface used by workspace Connection Query widget
  settings and Data Sources Explore.
- `connectionAuthoringContract.tsx`: shared helpers for resolving connection-specific authoring
  behavior such as query-model filtering, draft seeding, summary cards, and Explore copy.
- `connectionQueryDraftDefaults.ts`: shared helper for connection-type draft initialization.
  Connection types publish authoring behavior through `authoringContract.resolveDraftDefaults(...)`
  so Explore and widget settings seed the same query model, query payload defaults, and fixed-date
  fallbacks.
- `ConnectionQuerySettingsSurface.tsx`: dashboard-aware wrapper around the shared workbench. It
  injects workspace date controls and renders the current runtime status for the live source while
  draft settings are being edited.
- `ConnectionQueryRuntimeStatusCard.tsx`: reusable runtime-state card for standalone and embedded
  connection-query settings surfaces.
- `managedConnectionQuerySource.ts`: helpers for resolving hidden managed `connection-query`
  widgets owned by consumer widgets and summarizing their current runtime state.
- `components/ConnectionPicker.tsx`: reusable widget/settings picker for selecting a configured
  connection instance by stable `ConnectionRef`.
- `components/ConnectionQueryEditorFields.tsx`: reusable controls for connection-specific
  `queryEditor` components rendered by the Connection Query widget.
- `assets/`: shared connector logo assets used by connection type definitions and generic
  connection UI.

## Maintenance Constraints

- Connection type definitions are extension-owned metadata and must not contain organization
  secrets, tokens, or mutable instance state.
- Connection instances are backend-owned. The frontend may send secret values when creating or
  updating an instance, but it must only read `secureFields` indicators back.
- Backend-owned connection instance primary keys are numeric ids. The frontend preserves numeric
  ids in `ConnectionRef.id` and widget request payloads; string conversion is limited to DOM labels
  and URL template interpolation.
- Connection authorization is enforced through the existing platform and Main Sequence permission
  systems. This package does not define a separate connection-permission model.
- Widgets and workspaces should store stable `ConnectionRef` values: `{ id, typeId }`.
- Legacy saved refs that still contain `{ uid, typeId }` are normalized on read so existing
  workspaces continue to resolve the selected backend connection instance.
- The core connection layer must not fabricate system/default connection instances such as
  `prometheus-default` for widgets, Explore, or picker surfaces. Connection selection and runtime
  execution use backend-owned instances only.
- When a saved widget ref points at a stale or malformed connection id but still names a valid
  connection type, the shared workbench repairs that ref to a resolvable backend/default backend
  instance of the same type before running preview requests. If the saved ref is a retired
  synthetic placeholder and no real backend instance can be chosen safely, the workbench clears the
  selection instead of sending requests to a fake id.
- Workspace source widgets should query backend-owned connection instances through `ConnectionRef`.
  The core Connection Query widget is the generic workspace source for connection data and
  publishes one normalized `core.tabular_frame@v1` frame; downstream table, chart, statistic, and
  transform widgets should bind to that output rather than storing connection ids or query
  endpoints themselves. Chartable datasets can still carry `meta.timeSeries` hints inside that
  frame.
- Execution-time ref resolution must reload the backend connection catalog when fetch is allowed.
  Do not treat an in-memory frontend cache as authoritative for repairing or validating runtime
  `ConnectionRef` values.
- Data Sources Explore and workspace Connection Query settings must use
  `ConnectionQueryWorkbench.tsx` so they generate the same `ConnectionQueryRequest`, use the same
  typed connection editors, and preview the same normalized runtime frame. Do not add another
  direct Explore-only `queryConnection(...)` path for standard query-capable connections.
- The shared Connections app must render Explore through `ConnectionExploreSurface.tsx`. Do not
  add per-connection Explore wrapper components for normal query authoring; connection-specific
  behavior belongs in `ConnectionTypeDefinition.authoringContract`.
- Embedded consumer settings must route managed `connection-query` authoring through
  `ConnectionQuerySettingsSurface.tsx` or `ConnectionQueryWorkbench.tsx` so managed sources reuse
  the same request builder, typed query editors, incremental refresh fields, preview runner, and
  normalized response preview as the standalone `connection-query` widget.
- When the shared workbench runs inside a real widget-owned settings surface, successful preview
  runs must be able to publish the normalized runtime frame back onto that source widget's
  runtime state. Managed consumers such as Graph still resolve data only through the canonical
  widget binding graph; they must not depend on Explore-local preview state.
- When a connection type needs non-generic initial query defaults, it must publish those defaults
  through `authoringContract.resolveDraftDefaults(...)` on the connection definition instead of
  hard-coding a separate Explore-only initialization path. Widget settings and Explore should then
  consume that same contract. Query-model filtering and connection-specific summary cards also
  belong in the same authoring contract so the two surfaces cannot drift.
- Connection type `queryEditor` components receive the selected connection instance and selected
  query model. Use them for per-connection query kwargs such as Data Node columns, SQL parameters,
  PromQL matchers, or PostgreSQL time-series field mapping instead of forcing users through a
  generic JSON object.
- When a connection type provides a typed `queryEditor`, widget settings should use that editor as
  the primary settings source of truth instead of duplicating the same payload fields through the
  Connection Query widget schema. Schema-backed path controls remain the fallback for connections
  that do not provide a typed editor and for canvas companion-card exposure.
- Explore surfaces and widget test previews should use `ConnectionQueryResponsePreview.tsx` for
  response rendering so frame contracts are interpreted consistently across adapters.
- Do not reintroduce synthetic system connection instances anywhere in connection-owned code. Legacy
  placeholder ids may be recognized only to clear or repair saved refs; they must never appear as
  selectable instances or runtime execution ids.
