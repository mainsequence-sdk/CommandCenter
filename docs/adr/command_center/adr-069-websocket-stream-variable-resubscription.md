# ADR 069: Variable-Driven WebSocket Stream Resubscription

- Status: Accepted
- Date: 2026-05-20
- Related:
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
  - [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
  - [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
  - [ADR 067-B: WebSocket Stream Run Boundary Reset](./adr-067b-websocket-stream-run-boundary-reset.md)
  - [ADR 068: Automatic Partial WebSocket Row Patching For Tabular Consumers](./adr-068-automatic-partial-websocket-row-patching-for-tabular-consumers.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)

## Context

The bug is narrow:

- A WebSocket connection query can read reference-backed variable values in settings and test flows.
- When that variable value changes in the live workspace, the WebSocket source does not start,
  restart, or resubscribe from the new resolved request.
- Downstream widgets therefore do not receive new stream output until another action refreshes or
  remounts the source.

HTTP connection queries do not have this problem because `connection-query` is an executable graph
widget. When a variable changes, the variable commit planner schedules executable targets and calls
the graph runner.

WebSocket connection queries use a different runtime contract:

- `connection-stream-query` is a self-owned runtime source.
- It intentionally does not expose `definition.execution`.
- Dashboard refresh does not execute it.
- The React runtime mount owns the WebSocket session lifecycle.
- The session starts or restarts when the stream request key changes.

That split is correct. A long-lived WebSocket subscription should not be treated as a normal
request/response execution. The missing piece is that the live hidden/sidebar stream mount does not
receive the same resolved variable-backed request that settings and test flows can build.

The current failure path is:

```text
selection/runtime variable changes
  -> variable commit planner detects changed variable entries
  -> HTTP executable targets are scheduled
  -> connection-stream-query is skipped because it is not graph-executable
  -> hidden/sidebar stream mount keeps raw or stale props
  -> stream request key does not change
  -> WebSocket session is not started or replaced
  -> downstream stream consumers receive no new data
```

This ADR replaces the previous broad ADR 069 scope. The issue is not a full rewrite of workspace
runtime ownership, table selection ownership, or all settings surfaces. The issue is a missing bridge
between variable changes and the `connection-stream-query` subscription lifecycle.

## Decision

### 1. Keep WebSocket Streams Lifecycle-Owned

`connection-stream-query` remains a self-owned runtime source.

Do not make it a normal graph-executed widget just to react to variable changes. The graph runner
should continue to execute request/response widgets such as `connection-query`; it should not open
or manage long-lived WebSocket sessions.

The stream widget must still own:

- WebSocket session start
- reconnect supervision
- session release on request-key change
- snapshot and delta publication
- runtime lifecycle state

### 2. Add A Narrow Stream Runtime Input Bridge

Hidden/sidebar runtime mounts for `connection-stream-query` must receive the effective stream input
state required to compute the current subscription request.

For direct stream widgets, that means the hidden mount must receive:

- persisted stream props
- resolved reference-backed inputs for that stream instance
- the current runtime data store context used by the dependency model

For managed stream sources owned by another widget, that means the hidden source mount must receive:

- the current effective owner props
- the owner's embedded stream connection props projected through the existing managed connection
  adapter
- any resolved reference-backed inputs needed by that projection

These projected props are runtime-only. They must not be written back to the saved workspace unless
the user explicitly saves settings.

### 3. Resubscription Happens Through The Existing Stream Request Key

The stream runtime already has the correct lifecycle shape:

```text
effective props/resolved inputs change
  -> normalized stream props change
  -> connection stream request changes
  -> runtime key changes
  -> effect cleanup releases the old session
  -> effect start acquires a new session
```

The implementation should make that path reliable instead of adding a second execution mechanism.

The expected behavior is:

- If `$(Table).activeCellValue` changes from `BTCUSDT` to `ETHUSDT`, the stream request changes.
- The old WebSocket session is released.
- A new WebSocket session starts with the new resolved request.
- The source publishes stream output through the existing runtime publication path.
- Downstream widgets consume the output through existing bindings.

### 4. Unresolved Variables Must Not Open A Socket

If a stream request depends on a variable that is not currently available, the stream source should
not subscribe with an empty or stale request.

The widget should enter a clear waiting state, for example:

```text
Waiting for referenced value
```

The UI copy must be user-facing. It must not expose internal dependency-model terms as the primary
message.

### 5. Do Not Broaden Runtime Ownership

This ADR explicitly rejects the previous broad approach.

The fix must not:

- rewrite table selection ownership
- move all selection-backed outputs into a new global runtime model
- change generic workspace runtime-state persistence
- make every hidden widget consume new canonical state machinery
- add `connection-stream-query` to graph executable targets
- make passive downstream consumers open WebSockets
- make invalid stream state invalidate unrelated widgets of the same class

The only runtime source that needs this bridge is the WebSocket connection source lifecycle.

### 6. Backend Contract Impact

No backend contract change is required.

The backend already receives a resolved stream request when the frontend opens the WebSocket. The
frontend must continue resolving variables before subscribing. No new request payload shape,
connection instance storage shape, or workspace persistence shape is required.

## Implementation Tasks

### Guardrails

- [x] Keep the change scoped to `connection-stream-query` hidden/sidebar runtime subscription
  inputs.
- [x] Do not add `definition.execution` to `connection-stream-query`.
- [x] Do not add stream source ids to `executableTargetWidgetIds` in the graph execution planner.
- [x] Do not change table, pro-table, or Asset Screener selection-output ownership as part of this
  fix.
- [x] Do not persist runtime-only projected stream props into workspace storage.

### Hidden Stream Mount Inputs

- [x] Add a small runtime-mount helper for hidden/sidebar `connection-stream-query` instances that
  reads `resolvedInputs` from the existing dependency context and passes them to the stream
  component.
- [x] Preserve the current raw-props mount path for non-stream hidden/sidebar widgets.
- [x] Apply the helper in the workspace dashboard hidden/sidebar mount path.
- [x] Apply the same helper in slide-studio or public runtime hidden/sidebar mount paths only where
  `connection-stream-query` is actually mounted.

### Managed Stream Source Projection

- [x] Detect when a hidden `connection-stream-query` instance is managed by an owner as an
  `embedded-connection-source`.
- [x] Resolve the owner's effective props through the existing dependency model.
- [x] Use the existing managed connection consumer adapter to derive the embedded stream props for
  the source.
- [x] Pass those projected props to the hidden stream mount as runtime-only props.
- [x] Keep persisted hidden source props unchanged unless the user saves settings.

### Stream Lifecycle Behavior

- [x] Verify `ConnectionStreamQueryWidget` recomputes its request/runtime key from the resolved
  effective props supplied by the hidden mount.
- [x] Verify a changed request key releases the old session and starts a new session.
- [x] Ensure unresolved reference-backed stream inputs publish a waiting/idle state and do not open
  a WebSocket.
- [x] Ensure the waiting/error copy shown to users does not expose internal dependency or metadata
  names as the main message.

### Variable Change Coordination

- [x] Add a test proving a variable change that affects a direct `connection-stream-query` changes
  the stream request key without using `runGraph`.
- [x] Add a test proving a variable change that affects a managed embedded stream source changes
  the projected stream props without persisting them.
- [x] Add a test proving unchanged resolved variable values do not restart the stream.
- [x] Add a test proving unresolved variables do not subscribe with stale values.

### Regression Coverage

- [x] Confirm HTTP `connection-query` variable-driven execution still uses the graph runner.
- [x] Confirm mock API connection refresh behavior is unchanged.
- [x] Confirm table active row/cell and selected values are not modified by this fix.
- [x] Confirm Asset Screener does not lose rendering because another widget of the same class has an
  invalid or waiting source.
- [x] Confirm downstream stream consumers receive publications after the stream resubscribes.

## Consequences

### Benefits

- WebSocket streams react to variable changes without turning streams into graph executions.
- Settings/test behavior and live workspace behavior use the same resolved request values.
- Managed stream sources can update subscriptions from owner variables without mutating persisted
  hidden source props.
- The fix avoids broad runtime rewrites that can destabilize tables, selection outputs, mock API
  refresh, or unrelated widgets.

### Costs

- Hidden/sidebar stream mounting needs a small stream-specific bridge.
- Managed stream sources need runtime-only prop projection from their owner.
- Tests must cover both direct and managed stream sources because they fail through different paths.

### Non-Goals

- Do not redesign workspace selection state.
- Do not redesign all widget settings surfaces.
- Do not make WebSocket streams durable across page reloads.
- Do not change backend WebSocket request or response contracts.
- Do not introduce user-facing configuration for variable-triggered stream restarts.
