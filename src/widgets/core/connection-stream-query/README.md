# Connection Stream Query Widget

This folder owns the core `connection-stream-query` widget. It is the generic workspace source node
for connection query models that advertise a WebSocket stream contract.

## Entry Points

- `definition.ts`: widget definition, dynamic IO contract, registry metadata, and source runtime
  ownership.
- `connectionStreamQueryModel.ts`: prop normalization, stream request building, lifecycle frames,
  snapshot replacement, delta retained-frame merging, and WebSocket runtime session helpers.
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
- Only query models with `stream.transport: "websocket"` and at least one valid stream mode are
  accepted. Settings applies the same validation by filtering the shared connection query workbench
  and by resolving draft defaults only against streamable paths.
- Snapshot messages normalize the backend `ConnectionQueryResponse` through the same tabular
  conversion path as the one-shot `connection-query` widget. The first snapshot initializes the
  retained dataset; later snapshot-origin live updates may merge into retained rows when the stream
  model publishes default merge keys or the widget is configured with explicit merge keys.
- Delta messages also normalize through the one-shot conversion path, validate that the incoming
  schema matches the retained frame, merge rows by `mergeKeyFields` when configured, and attach the
  shared `widget-runtime-update@v1` envelope with the delta-only output.
- Explore and widget settings previews still keep their own bounded stream-history buffer for
  graphing. Canonical widget runtime is separate from that preview buffer, but it can now also
  retain live rows for downstream consumers when the stream contract publishes row identity keys.
- The widget publishes normal `core.tabular_frame@v1` output from its `dataset` port. Downstream
  widgets consume it through existing source bindings and shared upstream consumer-state helpers;
  they do not read socket-specific runtime metadata.
- Stream lifecycle is exposed on runtime state as `streamStatus`: `idle`, `connecting`, `live`,
  `reconnecting`, `error`, or `closed`. Canonical frame `status` remains `idle`, `loading`,
  `ready`, or `error` so existing consumer-state resolution can distinguish awaiting publication,
  loading, ready, empty, and error states.
- The widget is fixed to sidebar placement. It can be used as a normal hidden source widget because
  its output contract and bindings are identical to other tabular source widgets.

## Maintenance Constraints

- Keep backend access routed through `src/connections/api.ts`; do not open provider-native sockets
  directly from this widget.
- Keep saved props credential-free and route-free. Backend connection instances own credentials,
  provider endpoints, route fragments, auth refresh, permissions, and adapter validation.
- Keep response normalization aligned with `connection-query` by using
  `normalizeConnectionQueryResponsePayload(...)` instead of duplicating frame conversion logic.
- Keep default stream merge keys connection-owned. The generic source widget may consume
  `queryModels[].stream.defaultMergeKeyFields`, but it must not hardcode provider-specific row
  identity assumptions in the widget runtime.
- Keep downstream consumers socket-agnostic. Any new lifecycle or retry metadata belongs in source
  runtime state or `source.context`, not in consumer props or binding contracts.
- If managed consumer workflows add a streaming mode, they should create a hidden
  `connection-stream-query` widget and bind its `dataset` output to the visible consumer's existing
  tabular input.
