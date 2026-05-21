## buildPurpose

Publishes canonical tabular incremental publications from a streamable connection query over a WebSocket, with a compatibility retained dataset output for legacy consumers.
Large retained frames are stored in the workspace runtime data store and carried through bindings as runtime refs; active runtime shells stay lightweight instead of carrying inline retained rows when the runtime data store is available.

## whenToUse

- Use when a backend connection query model advertises `stream.transport: "websocket"` and widgets need live rows from that path.
- Use when downstream widgets should bind to explicit `updates` publications while the source keeps a WebSocket open.
- Use when several widgets need the same stream request; matching active requests share one workspace runtime connection instead of opening duplicate browser sockets.
- Use when snapshot and delta messages should feed the same table, graph, statistic, transform, or debug widgets that already consume connection query output.
- Use when the stream request depends on a workspace variable, such as a selected symbol. When the variable changes, the source resubscribes with the new resolved request.

## whenNotToUse

- Do not use for one-shot or refresh-driven requests; use `connection-query` for normal HTTP query execution.
- Do not use for provider-native browser sockets that bypass the connection backend adapter.
- Do not use when the selected connection path does not advertise WebSocket stream metadata.

## authoringSteps

- Select the backend-owned connection instance.
- Choose a streamable connection path; non-streamable query models are not valid for this widget.
- Configure the query payload with the same typed editor used by the connection query widget and Data Sources Explore.
- Configure merge-key fields when the compatibility retained dataset bridge should replace rows instead of appending every row. When left blank, the widget uses the connection path's default stream merge keys if that path publishes them.
- Keyed delta messages may publish only merge-key fields plus changed fields. The retained dataset
  patches those values into the existing row and preserves omitted fields from the prior snapshot.
- Bind downstream widgets to the `updates` output for live incremental behavior, or `dataset` when a retained compatibility bridge is still needed.

## blockingRequirements

- A configured connection instance is required.
- The selected query model must include `stream.transport: "websocket"` and valid stream modes.
- The backend must support the connection stream query route and return `ConnectionQueryResponse` frames in snapshot and delta messages.

## commonPitfalls

- The widget stores connection/query selection and stream merge settings only; credentials and provider URLs must stay on the backend connection instance.
- Runtime state should carry stream lifecycle plus runtime data refs. Do not rely on active source widgets keeping retained rows inline; materialize rows through the shared runtime data store when row data is needed.
- Widget settings read an active workspace stream from the shared connection runtime store. If the same request is already live, settings should show that status instead of requiring a separate test stream.
- Variable-backed requests wait for the referenced value before subscribing. If the selected row or active cell is empty, choose a value in the source widget first instead of expecting the stream to open with an empty symbol.
- When a variable-backed request changes, the new stream run starts clean. The widget clears the previous retained rows before the new snapshot or delta arrives, so downstream charts and tables should show loading or the new symbol's rows instead of mixing rows from the previous symbol.
- Reconnects for the same request are different from variable-driven resubscriptions. Same-request reconnects keep retained rows visible while degraded; changed requests do not.
- Stream diagnostics and test controls are opt-in from settings. Opening settings should show lightweight active runtime status first and must not automatically mount a live diagnostic stream panel.
- The shared settings panel uses demo-only preview for this source widget so previewing settings does not open a second runtime owner for the real draft request.
- The visible source card should observe shared stream status at a throttled cadence, not per WebSocket frame. High-frequency streams must not make settings buttons or canvas controls wait behind status-card rerenders.
- Delta frames may publish subset columns when merge keys are available. They must not introduce
  new columns that are absent from the retained frame; schema expansion needs an explicit upstream
  contract.
- Live-capable widgets should bind `liveUpdates` to this widget's `updates` output. `seedData` reacts only to seed publications, while `liveUpdates` continues applying seed/update publications from the stream.
- Snapshot-origin stream messages republish as seed resets. Delta-origin messages remain incremental updates.
- Downstream widgets should read their existing `consumerState` from shared source-binding helpers, not `streamStatus`.
- Passive consumer remounts should not create WebSocket subscriptions. Runtime-owner source widgets acquire shared stream sessions through the workspace connection runtime store; settings, charts, and passive widgets only observe existing stream status.
