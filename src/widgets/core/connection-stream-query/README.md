# Connection Stream Query Widget

This folder owns the core `connection-stream-query` widget. It is the generic workspace source node
for connection query models that advertise a WebSocket stream contract.

## Entry Points

- `definition.ts`: widget definition, dynamic IO contract, registry metadata, and source runtime
  ownership.
- `connectionStreamQueryModel.ts`: prop normalization, stream request building, lifecycle frames,
  compatibility dataset projection, incremental publication metadata, and WebSocket runtime session helpers.
- `ConnectionStreamQueryWidget.tsx`: hidden/sidebar runtime mount that opens one WebSocket
  subscription and publishes runtime state through `onRuntimeStateChange`.
- `ConnectionStreamQueryWidgetSettings.tsx`: settings wrapper around the shared connection query
  authoring surface. It filters selectable paths to streamable query models, constrains the
  connection picker to stream-capable connections, switches the shared workbench into stream
  authoring mode, reuses typed connection query editors with stream-specific copy, then renders the
  shared stream test panel for live frame preview.
- `ConnectionStreamQueryRailSummary.tsx`: workspace rail hover summary for selected connection,
  path, backend id, and stream lifecycle.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget stores only explicit source props: `connectionRef`, `queryModelId`, `query`,
  `queryEditorState`, time-range settings, variables, `maxRows`,
  `mergeKeyFields`, and `retentionMaxRows`. It deliberately drops unknown props so credentials,
  endpoint URLs, provider route fragments, and adapter-owned transport details are not persisted on
  the widget.
- Runtime uses the configured `streamQueryUrl` WebSocket route through `src/connections/api.ts`.
  For SPA JWT auth it first mints a short-lived handshake ticket through
  `auth.websocketTicketUrl`, then resolves the configured `ws`/`wss` endpoint and sends the
  query-shaped subscribe payload.
- Anonymous public execution now switches to widget-scoped `publicExecution.streamUrl` metadata
  from the published public workspace payload. In that mode the widget sends the backend public
  subscribe contract exactly: `subscriptionId`, `widgetInstanceId`, `capability`, and a nested
  `request` containing only the allowed `timeRange` and `variables` inputs. It skips SPA
  WebSocket ticket minting and keys its public runtime execution off the public stream URL instead
  of the private connection id.
- Only query models with `stream.transport: "websocket"` and at least one valid stream mode are
  accepted. Settings applies the same validation by filtering the shared connection query workbench
  and by resolving draft defaults only against streamable paths.
- Snapshot and delta messages normalize through the same tabular conversion path as the one-shot
  `connection-query` widget and attach explicit incremental `seed` / `update` runtime metadata.
- Delta-origin stream messages publish real incremental update publications. Snapshot-origin stream
  messages republish full retained seed resets so downstream live consumers reset correctly instead
  of treating replacement snapshots as append-only deltas.
- The widget now publishes two outputs:
  - `dataset`: compatibility retained dataset for legacy consumers
  - `updates`: explicit incremental publication output for `seedData` / `liveUpdates` consumers
- The current runtime writes retained compatibility frames and delta frames into the workspace
  runtime data store, then publishes small ref-backed runtime-state shells. Legacy dataset
  consumers keep working through compatibility materialization while migrated widgets bind the
  `updates` output directly.
- Explore and widget settings previews still keep their own bounded stream-history buffer for
  graphing. Canonical widget runtime is separate from that preview buffer, but it can now also
  retain live rows for downstream consumers when the stream contract publishes row identity keys.
- Downstream widgets should prefer the `updates` port when they need live incremental behavior.
  `seedData` now reacts only to seed publications; `liveUpdates` consumes ongoing seed/update
  publications. Consumers remain socket-agnostic and read only the normalized frame contract plus
  shared runtime update metadata.
- Stream lifecycle is exposed on runtime state as `streamStatus`: `idle`, `connecting`, `live`,
  `reconnecting`, `error`, or `closed`. Canonical frame `status` remains `idle`, `loading`,
  `ready`, or `error` so existing consumer-state resolution can distinguish awaiting publication,
  loading, ready, empty, and error states.
- Runtime now includes a browser-side reconnect supervisor that:
  - retries after socket close/error and retryable stream errors
  - reacquires a fresh SPA WebSocket ticket before each reconnect
  - uses bounded exponential backoff with jitter
  - keeps the last retained visible dataset while degraded
  - marks the source `error` after the retry budget is exhausted
- Current reconnect policy constants live in `connectionStreamQueryModel.ts`:
  - initial retry delay: `1000 ms`
  - max retry delay: `30000 ms`
  - jitter ratio: `0.2`
  - max reconnect attempts: `8`
  - heartbeat timeout: `max(heartbeatMs * 3, 5000 ms)`
- The longer-term survivability contract, including backend resume coordination, is tracked in
  [ADR 046](../../../docs/adr/command_center/adr-046-websocket-stream-survivability-and-reconnect-supervision.md).
- The widget is fixed to sidebar placement. It can be used as a normal hidden source widget because
  its output contract and bindings are identical to other tabular source widgets.

## Maintenance Constraints

- Keep backend access routed through `src/connections/api.ts`; do not open provider-native sockets
  directly from this widget.
- Keep public runtime execution routed through widget-scoped `publicExecution.streamUrl`; do not
  fall back to authenticated `/connections/:id/stream-query/` routes once the execution surface is
  `public-workspace`.
- Keep saved props credential-free and route-free. Backend connection instances own credentials,
  provider endpoints, route fragments, auth refresh, permissions, and adapter validation.
- Keep response normalization aligned with `connection-query` by using
  `normalizeConnectionQueryResponsePayload(...)` instead of duplicating frame conversion logic.
- Keep default stream merge keys connection-owned. The generic source widget may consume
  `queryModels[].stream.defaultMergeKeyFields`, but it must not hardcode provider-specific row
  identity assumptions in the widget runtime.
- Keep downstream consumers socket-agnostic. Any new lifecycle or retry metadata belongs in source
  runtime state or `source.context`, not in consumer props or binding contracts.
- Managed consumer workflows that add a streaming mode should create a hidden
  `connection-stream-query` widget and bind its `updates` output to the visible consumer's
  `liveUpdates` tabular input. Historical/HTTP seed sources should remain separately bindable to
  `seedData`.
