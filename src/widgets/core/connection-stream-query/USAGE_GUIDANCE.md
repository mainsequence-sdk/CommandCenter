## buildPurpose

Publishes a canonical tabular dataset from a streamable connection query over a WebSocket.

## whenToUse

- Use when a backend connection query model advertises `stream.transport: "websocket"` and widgets need live rows from that path.
- Use when downstream widgets should bind to a normal `core.tabular_frame@v1` dataset while the source keeps a WebSocket open.
- Use when snapshot and delta messages should feed the same table, graph, statistic, transform, or debug widgets that already consume connection query output.

## whenNotToUse

- Do not use for one-shot or refresh-driven requests; use `connection-query` for normal HTTP query execution.
- Do not use for provider-native browser sockets that bypass the connection backend adapter.
- Do not use when the selected connection path does not advertise WebSocket stream metadata.

## authoringSteps

- Select the backend-owned connection instance.
- Choose a streamable connection path; non-streamable query models are not valid for this widget.
- Configure the query payload with the same typed editor used by the connection query widget and Data Sources Explore.
- Configure merge-key fields when live updates should replace retained rows instead of appending every row. When left blank, the widget uses the connection path's default stream merge keys if that path publishes them.
- Bind downstream widgets to the `dataset` output.

## blockingRequirements

- A configured connection instance is required.
- The selected query model must include `stream.transport: "websocket"` and valid stream modes.
- The backend must support the connection stream query route and return `ConnectionQueryResponse` frames in snapshot and delta messages.

## commonPitfalls

- The widget stores connection/query selection and stream merge settings only; credentials and provider URLs must stay on the backend connection instance.
- Delta frames must keep the same schema as the retained frame. A schema change is treated as a stream error so consumers do not render mixed columns.
- Snapshot-origin live updates can also merge into retained rows when the connection path publishes default merge keys. This is how downstream charts keep growing history even when the provider bridge emits one-row snapshot messages.
- Downstream widgets should read their existing `consumerState` from shared source-binding helpers, not `streamStatus`.
- Passive consumer remounts should not create WebSocket subscriptions. Only this source widget owns the socket.
