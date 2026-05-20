# Connections

This directory owns the shared Command Center connection model introduced by the first-class
connection ADR. Connections are platform data-access resources, not widgets.

## Entry Points

- `types.ts`: extension-facing connection type metadata, backend-owned connection instance shapes,
  query/resource contracts, and health results.
- `api.ts`: authenticated frontend client for connection type, instance, health, query, resource,
  legacy EventSource stream endpoints, and query-shaped WebSocket stream endpoints. Instance list
  reads are backend-authoritative, do not inject local fallback records, and execution-time ref
  repair reloads the connection list from the backend instead of trusting a local module cache.
  Browser WebSocket callers mint a short-lived handshake ticket through the shared auth endpoint
  before opening `stream-query`.
- `hooks.ts`: React Query wrappers for connection catalogs, instances, queries, and resources, plus
  lifecycle helpers for legacy EventSource streams and query-shaped WebSocket streams.
- `ConnectionQueryResponsePreview.tsx`: shared renderer for normalized connection query responses.
  It renders one canonical tabular frame as a table or, when the normalized frame exposes graphable
  semantics, as a graph/table preview using the core graph renderer. It now also respects explicit
  `source.context.graphDefaults` on plain streamed tabular rows, so adapters can chart fields such
  as `openTime -> close` without reviving legacy time-series metadata.
- `connectionStreamPreview.ts`: preview-only accumulation helper for WebSocket test and Explore
  surfaces. It keeps bounded chart history, projects query-model graph hints into preview graph
  defaults, and preserves canonical source-widget runtime semantics.
- `connection-runtime-store.tsx`: workspace-scoped browser runtime store for active
  connection/query sessions. It lets source widgets acquire WebSocket sessions once per effective
  request while settings, rails, charts, and passive widgets observe the same active status without
  opening diagnostic sockets.
- `ConnectionExploreSurface.tsx`: generic Data Sources Explore surface. It reuses the same shared
  workbench used by connection-query widgets, exposes an explicit HTTP-vs-WS transport selector
  when the selected connection has streamable query models, and delegates connection-specific
  behavior to each connection type's authoring contract.
- `ConnectionQueryWorkbench.tsx`: shared query authoring, generated request preview, test
  execution, and normalized response preview surface used by workspace Connection Query widget
  settings and Data Sources Explore.
- `ConnectionStreamQueryTestPanel.tsx`: shared WebSocket test action for streamable connection
  queries. When the workspace runtime already has a matching active stream in
  `connection-runtime-store.tsx`, it shows that live status instead of opening a second socket.
  Otherwise it sends the query-shaped subscribe payload, previews streamed frames through
  `ConnectionQueryResponsePreview.tsx`, and shows lifecycle, sequence, emitted-time, heartbeat,
  preview retention metrics, error metadata, plus explicit ticket-request and socket-connect
  diagnostics for stream startup.
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
  `queryEditor` components rendered by the Connection Query widget. Buffered string-list fields
  support widget-reference authoring without forcing premature tokenization: source completions
  remain editable for nested field selection, and Backspace on an empty draft moves the last chip
  back into the draft input for editing instead of deleting it.
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
- Connection types that can be projected into backend physical data sources must declare
  `physicalDataSource` metadata and matching capabilities such as `sql-write`,
  `physical-data-source`, and, for TimescaleDB, `timescale-extension`. The connection form still
  uses Command Center public config names like `database` and `username`; physical model fields are
  translated by the backend.
- Widgets and workspaces should store stable `ConnectionRef` values: `{ id, typeId }`.
- The core connection layer must not fabricate production system/default connection instances such
  as `prometheus-default` for widgets, Explore, or picker surfaces. Connection selection and
  runtime execution use backend-owned instances only.
- The exception is an explicit frontend compatibility shim marked `registrySync: "local-only"`.
  `command_center.mock_api` uses this path to provide one documented local mock instance for
  JSON-backed widget and connection-query prototyping. It must never be included in backend
  connection-type sync.
- When a saved widget ref points at a stale or malformed connection id but still names a valid
  connection type, the shared workbench repairs that ref to a resolvable backend/default backend
  instance of the same type before running preview requests. If the saved ref is a retired
  synthetic placeholder and no real backend instance can be chosen safely, the workbench clears the
  selection instead of sending requests to a fake id.
- Workspace source widgets should query backend-owned connection instances through `ConnectionRef`.
  The core Connection Query widget is the generic workspace source for connection data and
  publishes one normalized `core.tabular_frame@v1` frame; downstream table, chart, statistic, and
  transform widgets should bind to that output rather than storing connection ids or query
  endpoints themselves.
- Execution-time ref resolution must reload the backend connection catalog when fetch is allowed.
  Do not treat an in-memory frontend cache as authoritative for repairing or validating runtime
  `ConnectionRef` values.
- Data Sources Explore and workspace Connection Query settings must use
  `ConnectionQueryWorkbench.tsx` so they generate the same `ConnectionQueryRequest`, use the same
  typed connection editors, and preview the same normalized runtime frame. Do not add another
  direct Explore-only `queryConnection(...)` path for standard query-capable connections.
- Data Sources Explore must expose WebSocket-capable query models through the shared
  `ConnectionExploreSurface.tsx` transport selector rather than hiding them behind connection-
  specific Explore wrappers. HTTP request/response and WS subscription authoring must stay visibly
  distinct in the Explore shell.
- The shared Connections app must render Explore through `ConnectionExploreSurface.tsx`. Do not
  add per-connection Explore wrapper components for normal query authoring; connection-specific
  behavior belongs in `ConnectionTypeDefinition.authoringContract`.
- Embedded consumer settings must route managed `connection-query` and `connection-stream-query`
  authoring through
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
  belong in the same authoring contract so the two surfaces cannot drift. When a connector has
  stream-only paths, `authoringContract.resolveQueryModels(...)` may filter by `authoringMode` so
  HTTP and WS surfaces expose different path sets without adding a custom Explore wrapper.
- Connection type `queryEditor` components receive the selected connection instance and selected
  query model. Use them for per-connection query kwargs such as Data Node columns, SQL parameters,
  PromQL matchers, or PostgreSQL time-series field mapping instead of forcing users through a
  generic JSON object.
- Query-shaped WebSocket streaming is advertised per `ConnectionQueryModel.stream`. Frontend
  streaming callers must validate the selected query model with the shared streamability helpers
  before opening `/stream-query/`; non-streamable query models must stay on the request/response
  `queryConnection(...)` path.
- Streamed query models may also publish frontend-only `stream.defaultMergeKeyFields`. The generic
  `connection-stream-query` widget uses those keys as the default retained-row identity when it
  merges snapshot-origin or delta-origin live updates for downstream widgets.
- Query-shaped WebSocket streams use `streamQueryUrl` as a WebSocket route template. The frontend
  resolves the configured API origin from `http`/`https` to `ws`/`wss` and sends a single
  `subscribe` message containing the standard query-shaped request after the socket opens. For SPA
  JWT auth, callers first `POST` `auth.websocketTicketUrl`, then append the returned
  `ws_ticket` query param to the socket URL. The legacy channel-based `streamUrl` remains
  EventSource-only.
- When a connection type provides a typed `queryEditor`, widget settings should use that editor as
  the primary settings source of truth instead of duplicating the same payload fields through the
  Connection Query widget schema. Schema-backed path controls remain the fallback for connections
  that do not provide a typed editor and for canvas companion-card exposure.
- Explore surfaces and widget test previews should use `ConnectionQueryResponsePreview.tsx` for
  response rendering so frame contracts are interpreted consistently across adapters.
- Preview accumulation for WebSocket testing is diagnostic UI state only. Keep it in
  `connectionStreamPreview.ts` and the test/explore shell; do not write accumulated preview rows
  back into canonical widget runtime state or workspace storage.
- Workspace runtime-owned WebSocket streams must acquire sessions through
  `connection-runtime-store.tsx`. Settings and diagnostic panels should observe an existing active
  store entry instead of opening a second socket for the same effective request.
- Do not reintroduce synthetic system connection instances anywhere in connection-owned code. Legacy
  placeholder ids may be recognized only to clear or repair saved refs; they must never appear as
  selectable instances or runtime execution ids.
