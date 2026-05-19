# ADR 064: Variable References as Widget Graph Edges

- Status: Proposed
- Date: 2026-05-19
- Related:
  - [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

ADR 058 established the user-facing variable language:

```text
$(source-widget).output.path
```

That language is useful only if it behaves like the rest of the workspace graph. Today the
implementation is too split:

- normal widget composition is represented through `bindings`
- variable expressions are parsed from title/props and compiled into generated reference bindings
- the settings editor, managed connection editor, runtime execution path, and graph visualization do
  not all consume the exact same dependency model
- `DashboardWidgetDependencyGraphEdge.source` currently only records `"binding"`, so variable edges
  cannot be distinguished or visualized as variable/reference edges
- connection authoring can show a correct-looking variable token while the actual request path still
  depends on whether the current surface resolved the generated binding
- runtime variable invalidation can become a side channel beside the widget graph instead of being a
  graph dependency that participates in ordering, readiness, and downstream execution

The concrete failure mode this ADR addresses is:

1. a connection query prop, for example `query.symbols`, is backed by a variable reference
2. that variable points to another widget output, for example a table or Asset Screener active cell
3. the preview/editor may show the token correctly
4. the connection execution path may not resolve the token through the same dependency graph used by
   normal ports
5. if the referenced value is not ready, the connection can still be scheduled and can repeatedly
   execute or error before its effective query is available

The fix is not another widget-specific patch. Variable references must become graph-native.

## Decision

Variable references are first-class widget graph edges.

They are not a second runtime system, not a connection-specific substitution layer, and not a
frontend-only fake dependency. The reference language remains an authoring syntax, but once parsed it
must compile into the same dependency model as explicit bindings.

The graph model will distinguish edge origin:

- explicit binding edges, created by the bindings UI or widget-managed bindings
- variable reference edges, created from whole-value variable expressions in titles and props
- system-managed edges, when a managed source widget is created and wired by the platform

Variable references will use platform-managed source outputs and target inputs:

- source outputs can be declared widget outputs such as `dataset`, `activeRow`, and
  `activeCellValue`
- source outputs can also be platform reference roots such as `__widget-reference.source.props`,
  `__widget-reference.source.runtimeState`, and `__widget-reference.source.title`
- target inputs can be normal widget inputs or platform reference targets such as `title` and
  `props.query.symbols`

The dependency remains:

```text
source widget output
  -> optional binding transform, such as extract-path
  -> target widget setting/input
  -> resolved effective widget props/title
  -> widget runtime or downstream execution
```

## Graph Visualization Requirement

Variable connections must be visible in the workspace graph.

The graph UI must show variable-reference edges between widgets, not hide them inside settings text.
The edge should make the target field visible enough to debug:

```text
Asset Screener.activeCellValue -> Binance query.props.query.symbols
Table.activeRow.Symbol -> Card.title
```

Variable edges should be visually distinct from explicit binding edges, for example with a dashed
primary-color stroke and a "variable" label or edge detail. This is a graph-inspection feature, not
just a styling change. Users need to see why a connection, chart, table, or title depends on another
widget even when the dependency came from typing `$(...)` into a setting.

Referenced-workspace graph expansion must use the same rule. If a workspace graph is projected into
another workspace, variable edges inside that referenced graph should remain visible.

## Architecture

### 1. One Dependency Builder

`createDashboardWidgetDependencyModel(...)` is the source of truth for both explicit bindings and
variable references.

The dependency builder should:

- normalize explicit `instance.bindings`
- derive variable expression bindings from the same widget list
- tag derived edges as variable-reference edges
- preserve transform metadata such as `extract-path:Symbol`
- expose the same resolved inputs to settings, canvas rendering, execution, and graph UI

No connection widget or consumer widget should implement its own `$(...)` substitution path.

### 2. Draft Graphs for Settings

Widget settings must be able to build a draft dependency graph.

The settings page edits a draft widget state before save/apply. That draft can contain new or
removed variable expressions, especially in managed connection query props. The settings surface must
therefore build a dependency model where the selected widget instance is replaced by its draft title,
props, presentation, and bindings.

Managed connection editors must consume this draft graph when building request previews and running
manual test actions. A query preview should not use committed workspace bindings when the visible
draft field already contains a variable reference.

### 3. Variables Are Readiness Dependencies

A required reference-backed execution input that still contains a literal `$(...)` expression or an
invalid transform result is not an executable request. A reference that has resolved to `null` is a
settled value, not an unresolved reference. The backend may accept that `null`, reject it with a
domain error, or return an empty result, but the frontend must not treat the resolved `null` as a
reason to keep resolving upstream.

For connection query widgets this means:

- do not send a backend request with a literal `$(...)` token
- do not send a backend request with an unresolved reference expression
- allow a resolved `null` to move through the normal execution/error path
- publish a local waiting/blocked diagnostic such as `waiting-for-reference`
- resume execution only when the graph resolves the reference expression or the user explicitly
  refreshes/retries after a settled error

This rule must be generic. Connection widgets are the most visible failure mode, but the graph
should expose unresolved required variable inputs to any executable widget.

### 4. Runtime Variable Changes Flow Through the Graph

When a source widget publishes a new runtime value, the platform must evaluate only the active
variable-reference edges that depend on that source output and transform path.

If the resolved value changed:

- passive consumers recompute effective title/props in memory
- executable consumers and downstream branches are scheduled through the graph runner
- managed hidden connection sources receive an execution-only resolved prop overlay
- resolved values are not persisted back into saved widget props

This replaces source-side or commit-only variable invalidation. The trigger is the graph edge value
changing, regardless of whether the upstream value came from a saved setting, runtime state, a table
selection, or another connection-backed widget.

### 5. Managed Connection Sources Use Effective Execution Identity

Managed connection sources must not be keyed only by connection id or hidden source widget id.

The runtime identity for a managed connection execution must include:

- workspace/runtime scope
- owner widget id
- hidden source widget id
- connection id and connection type
- query model id
- resolved query payload
- requested output contract
- time range or refresh identity
- max rows and incremental settings

If a query prop is reference-backed, the identity uses the resolved value. If the value is not ready,
there is no executable identity yet.

### 6. Passive Upstream Resolution Is One-Shot Per Invalidation

Passive upstream resolution must be a one-shot child-to-parent request per invalidation, followed by
a parent-to-child publication. A passive consumer may ask its upstream graph to resolve once when it
has no upstream publication. Once the upstream graph answers, the result is settled for that
invalidation, even if the answer is `null`, empty, error, or incompatible with the consumer.

The concrete loop is:

1. a passive consumer asks `useResolveWidgetUpstream(...)` to resolve its bound source
2. the graph runs an upstream connection with `reason: manual-recalculate`
3. the connection writes a runtime result, `null`, empty output, or error frame
4. the passive consumer still maps "not renderable for me" back to `awaiting-upstream`
5. the passive effect treats that as permission to resolve upstream again and starts
   another resolve cycle

This is wrong. `missing publication` and `published but unusable/null/error` are different states:

- `missing publication`: upstream has not answered yet; one passive upstream resolve is valid.
- `published null`: upstream answered with a valid null value; stop resolving and render the
  settled null/empty state.
- `published error`: upstream answered with an error; stop resolving and render the error.
- `published incompatible`: upstream answered but the value cannot be consumed; stop resolving and
  render the incompatibility.
- `loading`: upstream is already in flight; do not start another one.

The update direction must be one pass:

```text
child detects missing publication
  -> provider resolves parent/upstream graph once
  -> parent publishes runtime outcome
  -> child renders ready/null/error/incompatible
```

The provider owns the one-shot state machine. Runtime outputs that are the result of the attempt
must not make the same passive attempt look new. The provider should keep a settled-attempt cache
keyed by target instance, stable upstream requirement, target overrides, and dashboard state. That
cache clears only when inputs, variable edges, effective execution config, dashboard refresh
identity, or explicit user refresh changes.

### 7. Risk Review For Existing Widgets And Streams

This change is intentionally scoped to passive upstream orchestration. It must not change widget
renderers, connection adapters, WebSocket socket lifecycle, or persisted workspace shape.

Reviewed passive consumers:

- Table, Graph, Statistic, Tabular Transform, and Debug Stream all request upstream work through
  `useResolveWidgetUpstream(...)`. They should continue to decide their own render state from the
  shared upstream consumer state, but they must not own retry loops.
- HTTP `connection-query` and streaming `connection-stream-query` widgets remain source
  owners. A passive consumer can request one upstream resolution, but the source widget publishes
  `loading`, `ready`, `empty`, `error`, or `null` as the answer.
- Managed HTTP and managed WebSocket source widgets stay real graph nodes. The one-shot passive
  cache must not hide explicit refreshes, dashboard refresh cycles, variable changes, binding
  rewires, source configuration changes, or target override changes.
- WebSocket/stream connections must not be opened by passive consumer rerenders. The stream source
  owns socket lifecycle and publishes stream state; consumers only render the publication.
- Connection request identity and incremental cache identity still include the effective resolved
  request. The passive settled key intentionally excludes runtime output produced by the same
  resolve attempt only to prevent retry loops after a settled answer.

Regression coverage must preserve these invariants:

- a passive consumer that keeps asking after an upstream write triggers only one
  `manual-recalculate` for that invalidation
- a settled error publication from the upstream source does not trigger another passive upstream
  resolution pass
- executable request keys still change when upstream source configuration or meaningful runtime
  output changes
- passive settled keys do not change merely because the attempted upstream source published an
  error/null/empty runtime answer
- stream-capable consumers continue to use the same passive hook and do not create socket-specific
  retry behavior

## Implementation Checklist

- [x] Extend `DashboardWidgetDependencyGraphEdge` so graph edges can distinguish explicit bindings,
      variable references, and system-managed bindings.
- [x] Preserve variable reference metadata on graph edges, including source expression, target field,
      transform signature, and generated input id.
- [x] Update `createDashboardWidgetDependencyModel(...)` so derived variable bindings are emitted as
      variable-reference graph edges while still resolving through the existing binding machinery.
- [x] Add a draft dependency-model API or option that replaces selected widget instance state with
      local settings draft state before deriving variable bindings.
- [x] Wire `CustomWidgetSettingsPage` to build and pass the draft dependency model into settings
      surfaces that need resolved draft values.
- [x] Wire `ManagedConnectionConsumerPanel` and `ConnectionQueryWorkbench` so preview and manual
      test actions resolve connection query props from the draft dependency graph.
- [x] Add generic readiness gating for executable widgets with unresolved required
      reference-backed inputs.
- [x] Make connection query execution publish a local waiting diagnostic instead of hitting the
      backend when a required reference-backed query field is unresolved.
- [x] Route runtime variable value changes through the graph runner so passive consumers recompute
      first and executable downstream branches are scheduled from the same graph.
- [x] Update managed connection source sync so hidden sources use execution-only resolved prop
      overlays and do not persist resolved variable values into owner or source props.
- [x] Ensure managed connection runtime state is cleared only when the effective resolved execution
      identity materially changes.
- [x] Visualize variable-reference edges in `CustomWorkspaceGraphPage` with distinct styling and
      readable source/target labels.
- [x] Include variable-reference edges in referenced-workspace graph projections.
- [x] Add tests covering table/Asset Screener variable references into connection query props.
- [x] Add tests proving settings preview, manual query execution, canvas execution, and graph
      execution all resolve the same variable-backed connection request.
- [x] Add tests proving unresolved required variable inputs block backend execution without causing
      repeated retries.
- [x] Add tests proving runtime updates from a connection-backed source widget can populate a
      downstream variable source and then trigger only the affected downstream executable branch.
- [x] Add graph UI tests or focused graph-model tests proving variable edges are present and tagged
      separately from explicit binding edges.
- [x] Add provider-level regression coverage proving passive upstream resolution does not retry when
      the upstream source publishes a settled error/null-style runtime outcome and the consumer
      still asks for resolution.
- [x] Replace render-driven passive upstream retries with a provider-owned one-shot settled state
      machine. Reason: `null`, empty, error, and incompatible upstream outcomes are settled parent
      answers, not "still awaiting upstream"; passive widgets should request one upstream resolve
      per invalidation and then render the published outcome without looping.
- [x] Update `src/dashboards/README.md`, `src/widgets/shared/README.md`, and
      `src/widgets/core/connection-query/README.md` after implementation.

## Storage Contract Impact

The preferred implementation does not require a new persisted workspace shape.

Variable graph edges should be derived from existing saved widget state:

- widget title
- widget props
- widget bindings
- widget runtime state for runtime resolution only

Graph edge metadata can be in-memory. If implementation stores a new edge kind, variable metadata,
or generated reference binding payload in persisted workspace JSON, that is a backend-visible storage
contract change and must be coordinated with the backend.

Existing generated reference bindings must remain backward compatible. Older workspaces that already
contain generated reference bindings should continue to load, resolve, and visualize correctly.

## Consequences

### Positive

- Variable references and normal bindings share one graph model.
- Connection request previews and runtime execution stop drifting.
- The graph can explain variable-driven dependencies to users.
- Unresolved runtime-backed variables block execution cleanly instead of sending broken requests.
- Table, Asset Screener, connection, card title, and future widgets use the same variable machinery.

### Tradeoffs

- The dependency graph type becomes slightly richer.
- Settings must build a draft graph for accurate previews.
- The graph UI needs enough labeling to avoid hiding important variable target paths.
- Tests must cover both passive UI recomputation and executable downstream scheduling.

## Rejected Options

### Keep variables as a side-channel registry

Rejected. A side-channel registry can help inspect active references, but it cannot be the execution
source of truth. It leaves normal port bindings and variable references with different scheduling,
readiness, and visualization behavior.

### Add connection-specific variable substitution

Rejected. It would fix one visible symptom while leaving other widgets with inconsistent semantics.
Connections should consume resolved effective props from the graph like every other executable
widget.

### Persist resolved variable values into widget props

Rejected. Variable values are runtime/local effective state. Persisting resolved values would leak
one user's current selection into shared workspace configuration and break the distinction between
saved configuration and runtime state.
