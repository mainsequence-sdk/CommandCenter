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

The shared reducer owns precedence and combination, but the derived status must preserve where the
state came from:

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

type DisplayStatus = {
  tone: "neutral" | "waiting" | "updating" | "ready" | "error";
  source: StatusSource | StatusSource[];
  indicator: StatusIndicator;
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

## Seed And Live Input Semantics

Multi-input consumers must not be judged by a single generic upstream readiness bit.

For seed/live consumers:

- if only `liveUpdates` is bound, the live path is sufficient
- if only `seedData` is bound, the seed path is sufficient
- if both are bound, the consumer evaluates each input according to its declared role
- an unbound optional role must not hold the widget in waiting
- a bound role that has not published its first usable value can make the consumer waiting
- a bound role with a stream error can make the consumer `upstream-error`

This rule is generic. It applies to any widget with role-aware inputs, not only Tabular Transform.

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
| `tabular-transform` | transform node with seed/live inputs and dataset/updates outputs | Not fully aligned | It still owns widget-specific readiness with `getExecutionReadiness` and `canExecute`. Replace this with generic role-aware seed/live readiness and stream-aware retained output semantics. Live-only bindings must resolve through the live path and remain ready once a retained transformed live frame exists. |
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
- [x] Migrate seed/live consumers to the shared role-aware resolver: `table`, `graph`,
  `statistic`, `ms-markets-asset-screener`, `main-sequence-ohlc-bars`, and `tabular-transform`.
- [x] Verify passive bound-data consumers and debug/spec widgets use the shared display status
  reducer and explicit runtime classification: `main-sequence-curve-plot`,
  `main-sequence-zero-curve`, `debug_stream`, `markdown-note`, `rich-text-note`, `workspace-row`,
  `workspace-slide`, `main-sequence-project-infra-graph`, `echarts-spec`, and
  `lightweight-charts-spec`.
- [x] Add variable-output effective signature tests for interaction outputs such as Table active
  row, Asset Screener active row, selected rows, active cell, and selected cell values.

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
