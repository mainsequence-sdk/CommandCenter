# ADR 073: Split Finite Execution And Stream Publication Planning

- Status: Proposed
- Date: 2026-05-22
- Related:
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr-source-driven-downstream-execution.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 043: WebSocket Stream Preview And Graphing Semantics](./adr-043-websocket-stream-preview-graphing-semantics.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 046: WebSocket Stream Survivability And Reconnect Supervision](./adr-046-websocket-stream-survivability-and-reconnect-supervision.md)
  - [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 068: Automatic Partial WebSocket Row Patching For Tabular Consumers](./adr-068-automatic-partial-websocket-row-patching-for-tabular-consumers.md)
  - [ADR 069: Variable-Driven WebSocket Stream Resubscription](./adr-069-websocket-stream-variable-resubscription.md)

## Context

Workspace execution currently mixes two different lifecycles:

- finite execution, where a widget request runs once and finishes as success or error
- stream publication, where a WebSocket source owns a long-running connection and publishes runtime
  updates outside the finite graph runner

The existing graph runner is correct for target-oriented execution:

- dashboard refresh
- manual recalculation
- settings test execution
- source-driven request flows that need upstream dependencies first

It is not a complete model for live streams. WebSocket widgets publish runtime state directly, while
downstream consumers and status UI still read generic execution state such as `waiting`, `running`,
`success`, and `error`.

That causes incorrect user-visible states:

- a stream can be live and feeding downstream data while a generic execution state still marks a
  node as waiting
- downstream widgets can flicker between green and orange when retained stream data is valid but a
  transient upstream publication is idle
- graph and sidebar status dots cannot distinguish "currently running a finite request" from
  "healthy live stream"
- upstream stream errors do not have one consistent way to propagate to all downstream consumers
  with the original failing widget attached

This is not a widget-specific problem. It is a graph status and propagation problem.

## Decision

Split workspace runtime planning into two coordinated planners:

1. **Finite execution planner** for one-shot request execution.
2. **Stream publication planner** for WebSocket and other long-running publication sources.

Both planners write into one shared widget status reducer so the graph, sidebar, settings surfaces,
and workspace chrome display a consistent state. The reducer must preserve the source of each state
instead of collapsing finite execution and stream publication into one generic color.

## Finite Execution Planner

Finite execution covers target refreshes and explicit user actions that run to completion.

The planner must build the affected execution graph before running nodes:

1. Build the directed subgraph of widgets that will be updated.
2. Mark all planned widgets as `waiting`.
3. Start with executable roots that have no blocking parents.
4. Mark currently executing widgets as `updating`.
5. On success, mark the widget as `ready` and release eligible children.
6. On error, mark the widget as `error` and mark descendants as `upstream-error`.

An upstream error must carry structured source information:

```json
{
  "status": "upstream-error",
  "blockedByWidgetId": "connection-query-1",
  "blockedByOutputId": "dataset",
  "message": "Connection query failed",
  "sourceStatus": "error"
}
```

Descendants should not execute normally after a required parent fails unless the widget explicitly
declares that it can consume upstream errors as input data.

## Stream Publication Planner

Stream publication covers WebSocket and other long-running sources that do not fit a single
request/response lifecycle.

The stream source owns connection lifecycle:

- `idle`
- `connecting`
- `live`
- `reconnecting`
- `error`
- `closed`

The planner must propagate stream publications downstream without converting every message into a
full finite execution run.

Rules:

- A live stream source with a usable retained output is `live`, not `running`.
- A reconnecting stream with a usable retained output remains `live` or `reconnecting-live`, not
  `waiting`.
- Downstream widgets receiving valid stream data remain `live` or `ready`.
- Before the first usable stream publication, downstream consumers are `waiting`.
- If the stream source errors, downstream consumers become `upstream-error` with the stream source
  as `blockedByWidgetId`.
- Stream propagation must be edge-aware, especially for seed/live bindings where one input can be
  ready while the other input is intentionally unbound.

## Refresh Command Semantics

The workspace `Refresh` command belongs to finite execution planning. It must not restart,
reconnect, close, reopen, or otherwise re-execute WebSocket stream connections.

Rules:

- Refresh may execute finite request widgets such as HTTP connection queries whose refresh policy
  allows dashboard refresh.
- Refresh may execute downstream finite branches that consume the current retained stream output.
- Refresh must not treat a WebSocket source as a refresh target.
- Refresh must not call WebSocket widget execution as a side effect of refreshing a downstream
  consumer.
- Refresh must not reset stream runtime state, retained stream rows, stream sequence numbers,
  reconnect counters, or live connection lifecycle.
- Stream reconnection is owned only by the stream publication planner and the stream widget's socket
  lifecycle.
- If a stream is `live` or `reconnecting` with retained usable output, refresh should leave that
  stream state alone and let downstream consumers read the retained publication.
- If a stream is in `error`, refresh should not hide the error by restarting the stream. The stream
  error should propagate downstream as `upstream-error` until the stream lifecycle itself recovers or
  the user changes stream configuration.

Current code intent matches this rule: `connection-stream-query` declares `refreshPolicy:
not-applicable`, no execution triggers, and no executable graph runner entry point. The refresh
target selector may include passive consumers that depend on stream outputs, but it must never
classify the stream source itself as a finite refresh target.

## Shared Display Status With Source-Aware Indicators

The UI must not directly choose between raw execution state and raw runtime state. It must consume a
single derived display status.

The shared reducer owns precedence and combination, but the derived status must not collapse three
separate concepts into one overloaded glyph:

- **Primary widget status**: whether this widget is healthy, waiting, updating, or errored.
- **Output lineage**: whether the current published value is finite, stream-derived, or both.
- **Activity**: whether this widget is actively executing, connecting, reconnecting, or processing
  an update right now.

These are different questions. A transform can be healthy and publishing a valid frame while that
frame is stream-derived. That does not necessarily mean the transform itself owns a WebSocket. It
means the current output lineage includes a stream source.

The derived status must preserve these dimensions:

```ts
type StatusSource =
  | "finite-execution"
  | "stream-publication"
  | "runtime"
  | "upstream";

type StatusIndicator =
  | "dot"
  | "lightning"
  | "dot+lightning";

type OutputLineage =
  | "finite"
  | "stream"
  | "finite+stream"
  | "local";

type ActivityState =
  | "idle"
  | "executing"
  | "connecting"
  | "reconnecting"
  | "processing-stream-update";

type DisplayStatus = {
  tone: "neutral" | "waiting" | "updating" | "ready" | "error";
  source: StatusSource | StatusSource[];
  indicator: StatusIndicator;
  lineage: OutputLineage;
  activity: ActivityState;
  message: string;
  blockedByWidgetId?: string;
  blockedByOutputId?: string;
};
```

The reducer derives display state using this precedence:

1. Local `error` is red.
2. `upstream-error` is red and references the upstream source.
3. Finite `updating` is primary/loading.
4. Stream `live` or `reconnecting` with retained usable output is green/live.
5. Finite `ready` or runtime `ready` is green.
6. Waiting for first required input publication is orange/waiting.
7. Idle/unconfigured state is neutral.

The visual indicator is source-aware:

- finite execution status uses a dot or normal execution spinner
- stream publication status uses a lightning or stream indicator
- when finite execution and stream publication both have active status, the UI shows both indicators
- normal finite execution error is a red dot
- WebSocket or stream publication error is a red lightning indicator
- when both finite execution and stream publication are in error, the UI shows red dot plus red
  lightning
- downstream blocked by finite execution error shows red dot with the upstream source reference
- downstream blocked by stream error shows red lightning with the upstream source reference
- healthy live stream shows green lightning
- stream waiting for first publication shows orange lightning

A single display reducer therefore means one canonical source of truth for status precedence and
combination. It does not mean one visual glyph or one collapsed status source.

Important: the dot/lightning display is not allowed to mean both "what the widget is" and "where its
current value came from" without naming which layer is being shown. The reducer must expose the
primary widget status separately from output lineage.

Examples:

- A WebSocket connection widget with a live socket has primary status `ready/live`, lineage
  `stream`, and activity `idle` or `processing-stream-update` depending on whether a message is
  currently being handled.
- A Tabular Transform with only `liveUpdates` bound has primary status `ready` once it publishes a
  transformed frame, lineage `stream`, and activity `idle` except during transform processing. It
  does not become a WebSocket owner just because its output is stream-derived.
- A Tabular Transform is single-source. It may bind `seedData` or `liveUpdates`, but not both; the
  active input role decides the active output channel.
- A finite HTTP connection query has primary status `ready` or `error`, lineage `finite`, and
  activity `executing` only while the request is in flight.

## Status Ownership Matrix

Every widget must classify each active status signal by source before the shared reducer chooses the
final color and indicator. This rule is global, not specific to Tabular Transform.

Required composition rules:

- `liveUpdates` only, with a stream source, shows the stream indicator only.
- `seedData` only, with a finite or retained non-stream source, shows the finite/runtime dot only.
- Widgets that are true dual-role consumers and have `seedData` plus `liveUpdates` bound show both
  dot and lightning when both channels have active state. Tabular Transform is excluded because it
  is a single-source transform, not a seed/live joiner.
- finite execution `waiting`, `updating`, `ready`, or `error` owns the dot channel.
- stream `connecting`, `live`, `reconnecting`, `waiting`, or `error` owns the lightning channel.
- combined finite/seed plus stream state shows both channels without allowing one channel to erase
  the other.

The status reducer must therefore receive provenance for ready runtime outputs. A transformed output
with `status: ready` is not automatically a finite/runtime dot. The producer must say whether that
ready value came from:

- seed-only input
- live-only input
- both seed and live inputs, only for widgets whose contract explicitly says they are dual-role
  consumers
- local finite execution
- local static/runtime UI state

This prevents the specific class of bug where a live-only transformed frame is valid and flowing,
but the UI shows a green dot as if a separate finite execution path also succeeded. In that case the
correct display is green lightning only. If the same transform also consumes seed data, the correct
configuration is invalid for Tabular Transform; dot plus lightning applies to true dual-role
consumers such as Table, Graph, Statistic, and Asset Screener.

This provenance requirement applies to every multi-input or transformed-output widget. It is not
valid for the display reducer to infer channel ownership from `source.kind`, widget id, or a generic
`runtimeState.status` alone.

## Effective Change Gating

Stream publication must not fan out through the graph on every raw runtime write.

Before downstream propagation, the runtime must compute an effective signature for each published
output and each referenced variable result. The stream planner only propagates when the effective
signature changes for a consumer-relevant output.

This prevents high-frequency streams from:

- re-running unrelated widgets
- shaking graph nodes
- repeatedly marking widgets waiting/updating when the effective consumed value did not change
- forcing variable-driven consumers to re-execute on every raw WebSocket tick

## Runtime Variable Change Planning

Runtime value changes are not topology changes.

Examples:

- selecting a different table row
- selecting a different Asset Screener row
- changing an active cell
- receiving a stream update that changes only retained runtime values

These events do not change widgets, bindings, input ports, output ports, or graph edges. Therefore they
must not use the same expensive before/after dependency-model rebuild path used for settings and
binding changes.

The runtime variable path has three separate responsibilities:

1. **Immediate local value update**: the source widget's runtime state changes immediately and every
   local runtime view, including Variable Explorer, can show the new value without waiting for
   downstream execution.
2. **Effective value gating**: only referenced variable entries owned by the changed source widget are
   resolved, transformed, and compared against the previous effective signature.
3. **Downstream dispatch**: if a referenced effective variable changed, the precomputed variable
   registry and dependency graph are used to find consumers and executable descendants.

The costly dependency path is reserved for topology-changing operations:

- widget added or removed
- binding added, removed, or retargeted
- widget settings changed in a way that alters inputs, outputs, references, or execution behavior
- registry or widget definition changed

For runtime value changes, the planner must use the existing graph:

```ts
type RuntimeVariableChangePlan = {
  changedWidgetId: string;
  revision: number;
  changedEntries: Array<{
    entryId: string;
    sourceOutputId: string;
    transformSignature: string;
    beforeEffectiveSignature: string | undefined;
    afterEffectiveSignature: string;
    targetWidgetIds: string[];
  }>;
  executableTargetWidgetIds: string[];
};
```

Required runtime variable flow:

1. Source widget publishes the new runtime state synchronously into the local runtime override store.
2. Variable Explorer reads from that same effective runtime store and updates immediately.
3. The runtime variable planner looks up `variableRegistry.bySourceWidgetId.get(changedWidgetId)`.
4. It resolves only those outputs and only the referenced transforms, for example
   `activeRow -> extract-path:symbol`.
5. It compares effective signatures against the runtime variable signature cache.
6. If no effective referenced value changed, it stops.
7. If a value changed, it uses the already-known consumer list and existing dependency graph paths to
   dispatch downstream finite execution or stream resubscription work.

The runtime variable planner must not rebuild the full dependency model just to discover topology that
is already known. Rebuilding the dependency model belongs to settings/bindings/widget topology changes.

### Runtime Fast Resolution And Graph Reuse Plan

Runtime variable resolution is a hot path. It must reuse the compiled workspace dependency graph and
compiled variable registry instead of rebuilding dependency topology for every runtime publication.

This applies to every runtime value publication, including:

- active row or active cell changes
- retained table/screener/chart runtime output changes
- stream publications that update retained runtime values
- local UI state publications that expose variables
- any widget output that can be referenced through a variable transform

Row selection is only one example. The primary contract is fast resolution over stable topology.

Implementation order:

1. Keep a compiled variable graph for the current workspace topology.
2. Commit the source widget runtime publication to the local runtime override/output store
   synchronously.
3. Let Variable Explorer render from the updated effective-variable cache immediately.
4. Resolve only referenced variable entries that the compiled registry says can be affected by the
   changed source widget and output.
5. Compare transformed effective signatures, for example `activeRow.symbol`, against the previous
   cached signature for that variable entry.
6. If no referenced effective signature changed, stop without downstream graph work.
7. If a referenced effective signature changed, dispatch only the already-known consumers and
   executable descendants from the compiled variable registry and graph paths.

This plan intentionally avoids dependency recalculation on runtime publication. Dependency
recalculation is allowed only after topology changes. Runtime publications can change values, but they
cannot create or remove graph edges.

Acceptance criteria:

- Variable Explorer changes on the same interaction that commits the runtime publication, without waiting for
  downstream HTTP requests, stream writes, or graph refresh.
- A newer runtime publication during an active downstream refresh cannot be swallowed by an older
  publication's completion handler.
- Downstream consumers run only when the effective transformed variable value they reference changes.
- Unrelated stream ticks do not rebuild dependency topology and do not trigger variable consumers when
  their referenced effective variable values are unchanged.
- Topology snapshots are rebuilt only for settings, binding, widget definition, or workspace graph
  changes.

### Runtime Variable Queue Revisions

Runtime variable refresh work must be revision-safe.

It is invalid to dedupe active work only by `changedWidgetId`. That can swallow a newer row selection
while an older selection refresh is still running.

Correct queue semantics:

- Every runtime variable change receives a monotonic revision per source widget.
- If no work is active for the source widget, enqueue the revision and start it.
- If work is active and a newer revision arrives, keep the newer revision pending separately.
- When an older revision finishes, it may clear only that revision.
- If a newer revision is pending, it must run after the active revision completes.
- A stale revision must never remove or overwrite a newer pending revision.
- The variable signature cache is updated for the effective value that was actually evaluated, not for
  an arbitrary raw runtime write.

This preserves the intended performance property: high-frequency streams and repeated clicks still
coalesce where safe, but the final user-visible selection cannot be dropped.

## Seed And Live Input Semantics

Multi-input consumers must not be judged by a single generic upstream readiness bit.

For seed/live consumers:

- if only `liveUpdates` is bound, the live path is sufficient
- if only `seedData` is bound, the seed path is sufficient
- if both are bound, the consumer evaluates each input according to its declared role
- an unbound optional role must not hold the widget in waiting
- a bound role that has not published its first usable value can make the consumer waiting
- a bound role with a stream error can make the consumer `upstream-error`

This rule is generic for widgets whose contract declares dual-role consumption. A transform node may
declare stricter cardinality. Tabular Transform declares a single active source role: `seedData`
publishes `dataset`; `liveUpdates` publishes `updates`; binding both is a configuration error.

## Diagnostics

Every planned status transition must be explainable.

The graph, sidebar hover card, and widget settings should be able to show:

- current display status
- local status source: execution, stream, runtime, or upstream
- upstream blocker when status is `waiting` or `upstream-error`
- whether the widget has retained usable output
- last successful publication time for stream paths
- last finite execution time for request paths

Diagnostics should be structured data, not ad hoc console strings.

## Consequences

Positive:

- request execution and stream publication no longer fight over one status slot
- graph and sidebar can distinguish finite request errors from stream errors
- live WebSocket flows can stay green while still surfacing real stream errors
- downstream error propagation becomes visible and attributable
- seed/live graphs can show which side is blocked or failing
- high-frequency streams stop causing full graph recalculation noise

Tradeoffs:

- the runtime needs a richer status model than `idle | running | success | waiting | error`
- graph, sidebar, settings, and variable explorer status surfaces must read the same reducer
- stream paths need their own propagation planner instead of piggybacking on target execution
- runtime variable changes need a fast path separate from topology-changing settings/bindings changes
- pending runtime variable work needs revision ownership so active work cannot swallow newer runtime
  publications
- tests must cover both finite request flows and stream publication flows

## Widget Gap Analysis

The current widget registry mostly declares the right ownership split, but the implementation is not
fully aligned with this ADR yet.

| Widget or family | Current classification | Architecture fit | Gap to close |
| --- | --- | --- | --- |
| `connection-query` | `execution-owner`, finite request, refresh allowed | Mostly aligned | Keep `canExecute` structural only: connection selected, query model selected, time range buildable. Missing variable-backed query fields must execute and surface backend or adapter errors, not be blocked by frontend reference preflight. Add conformance tests for this behavior. |
| `app-component` | `execution-owner`, finite request, refresh allowed | Mostly aligned | Bring into the finite planner conformance suite so API request errors propagate as local `error` and block descendants as `upstream-error`. |
| `position-detail` | `execution-owner`, finite request, refresh allowed | Mostly aligned | Bring into the finite planner conformance suite and verify refresh/readiness does not depend on ad hoc widget UI state. |
| `main-sequence-dependency-graph` | `execution-owner`, finite request, refresh allowed | Mostly aligned | Bring into the finite planner conformance suite and verify runtime errors are source-attributed. |
| `connection-stream-query` | stream source, refresh not applicable | Partially aligned | Make it the canonical first stream planner source. Socket lifecycle, retained publication, effective output signatures, stream errors, and downstream stream propagation must feed the stream planner instead of relying only on component runtime writes. |
| `tabular-transform` | single-source transform node with seed/live input alternatives and dataset/updates output alternatives | Partially aligned | It must not use the shared dual-role combiner. Enforce single-source cardinality, gate inactive outputs by active input role, and keep live-only bindings on the live path once a transformed live frame exists. |
| `table` | passive tabular consumer and republisher, refresh not applicable | Partially aligned | Move status/readiness for seed/live input combinations into the shared role-aware consumer resolver. Table merge and active selection outputs must participate in effective signature gating so variable consumers do not refresh on unrelated stream ticks. |
| `graph` | passive tabular consumer, refresh not applicable | Partially aligned | Use the shared role-aware seed/live resolver for live-only, seed-only, and combined inputs. Managed hidden connection sources must use the finite or stream planner based on source type, not custom graph behavior. |
| `statistic` | passive tabular consumer, refresh not applicable | Partially aligned | Use the shared role-aware seed/live resolver and effective signature gating for reduced card outputs. |
| `ms-markets-asset-screener` | passive semantic tabular consumer with seed/live inputs, refresh not applicable | Partially aligned | Use the same role-aware seed/live resolver as Table. Live merge must happen before screener domain resolution, and active-row variables must be gated by effective transformed value signatures. |
| `main-sequence-ohlc-bars` | passive tabular chart consumer with seed/live inputs, refresh not applicable | Partially aligned | Use the shared role-aware seed/live resolver and stream publication status so live OHLC charts do not flicker between waiting and ready. |
| `main-sequence-curve-plot`, `main-sequence-zero-curve` | passive bound-data consumers, refresh not applicable | Mostly aligned | Add conformance coverage that unbound optional inputs are neutral or waiting as intended and upstream errors display through the shared reducer. |
| `debug_stream` | passive tabular debug consumer, refresh not applicable | Partially aligned | Convert debug output status to the shared source-aware reducer so it can show stream publication source and upstream blockers consistently. |
| `markdown-note`, `rich-text-note`, `workspace-row`, `workspace-slide`, `main-sequence-project-infra-graph`, `echarts-spec`, `lightweight-charts-spec` | local/static or configuration widgets with no finite execution | Mostly aligned | Make runtime classification explicit where it is currently implicit so status reducers and registry audits do not infer incorrect waiting or execution behavior. |

The audit target is not to make every widget executable. The target is for every widget to declare
one of these roles clearly:

- finite execution owner
- stream publication owner
- passive consumer
- local/static UI

Every role must feed the same display status reducer, but only finite execution owners participate
in the finite planner and only stream publication owners participate in the stream planner.

## Implementation Tasks

- [x] Introduce a source-aware display status model that preserves finite execution, stream
  publication, runtime, and upstream status sources.
- [x] Add combined visual indicator support for dot, lightning, and dot-plus-lightning states in the
  graph, sidebar, hover cards, and widget settings surfaces.
- [x] Refactor finite request execution into an explicit downstream update plan that pre-marks
  executable affected nodes as waiting, marks running nodes as updating, and propagates upstream
  errors with source references. Passive targets continue to derive visible status from the shared
  display reducer so they are not left in orphaned waiting states when no executable node completes
  them.
- [x] Propagate finite execution parent failures to blocked downstream nodes as `upstream-error`
  with `blockedByWidgetId` and direct `blockedByOutputId` when available.
- [x] Add a separate stream publication planner that handles WebSocket lifecycle and downstream
  propagation without converting every stream message into a full graph execution.
- [x] Enforce refresh semantics so workspace refresh never restarts or re-executes WebSocket stream
  sources and only refreshes finite execution branches plus downstream consumers of retained stream
  publications.
- [x] Gate stream propagation by effective output and variable signatures so high-frequency runtime
  writes only fan out when consumer-visible values change.
- [x] Make role-aware input readiness generic so seed/live and future multi-input widgets can
  distinguish unbound optional inputs, waiting bound inputs, ready retained outputs, and upstream
  stream errors. The current implementation uses the shared incremental tabular consumer resolver
  as the role-aware boundary for all seed/live tabular consumers; future non-tabular multi-input
  roles should use the same state shape.
- [x] Replace ad hoc status console logging with structured diagnostics that explain current
  display status, source, upstream blocker, retained-output availability, and last publication or
  execution time.
- [x] Add regression tests for finite success, finite error propagation, stream live propagation,
  stream first-publication waiting, stream error propagation, and combined finite-plus-stream
  status indicators.
- [x] Add a widget architecture conformance audit that scans every registered widget for explicit
  role classification: finite execution owner, stream publication owner, passive consumer, or
  local/static UI.
- [x] Add conformance tests for finite execution-owner widgets: `connection-query`,
  `app-component`, `position-detail`, and `main-sequence-dependency-graph`.
- [x] Add conformance tests for stream publication-owner widgets, starting with
  `connection-stream-query`, covering refresh exclusion, retained output, stream error propagation,
  and effective output signature gating.
- [x] Migrate dual-role seed/live consumers to the shared role-aware resolver: `table`, `graph`,
  `statistic`, `ms-markets-asset-screener`, and `main-sequence-ohlc-bars`. Keep
  `tabular-transform` single-source with explicit seed-or-live cardinality.
- [x] Verify passive bound-data consumers and debug/spec widgets use the shared display status
  reducer and explicit runtime classification: `main-sequence-curve-plot`,
  `main-sequence-zero-curve`, `debug_stream`, `markdown-note`, `rich-text-note`, `workspace-row`,
  `workspace-slide`, `main-sequence-project-infra-graph`, `echarts-spec`, and
  `lightweight-charts-spec`.
- [x] Add variable-output effective signature tests for interaction outputs such as Table active
  row, Asset Screener active row, selected rows, active cell, and selected cell values.
- [x] Split variable-driven planning into two paths: topology rebuild for settings/bindings/widget
  changes, and source-scoped fast runtime planning for runtime value publications.
- [x] Add an immediate effective variable value store that is updated by source runtime publications
  before downstream execution starts, and make Variable Explorer read this store so variables update
  synchronously with the publication that changed them.
- [x] Replace `changedWidgetId`-only runtime variable refresh dedupe with per-source monotonic
  revisions. Active work may coalesce pending revisions, but completion of an older revision must not
  clear a newer runtime publication.
- [x] Make runtime variable planning resolve only entries from
  `variableRegistry.bySourceWidgetId.get(changedWidgetId)`, narrow further by changed source output
  when available, compare effective transformed signatures, and dispatch through the existing graph
  paths without rebuilding the full dependency topology.
- [ ] Add regression tests for rapid runtime value changes, including row selection: publish A then B
  while A's downstream refresh is active; B must remain visible in Variable Explorer and must trigger
  the final downstream refresh.
- [ ] Add regression tests proving that unrelated WebSocket ticks do not rebuild dependency topology and
  do not fan out variable refresh work unless a referenced effective variable signature changes.

## Backend And Storage Contract Assessment

The first implementation should be frontend-runtime only.

No backend storage contract change is required if:

- update plans are ephemeral
- display status is derived client-side
- stream publication signatures are in-memory runtime data
- upstream-error propagation is not persisted into workspace JSON

A backend contract change is required only if we later persist:

- status history
- last publication diagnostics
- execution plans
- upstream-error snapshots
- stream health telemetry

If that later happens, the backend must receive an explicit model proposal instead of treating the
fields as frontend-only widget props.
