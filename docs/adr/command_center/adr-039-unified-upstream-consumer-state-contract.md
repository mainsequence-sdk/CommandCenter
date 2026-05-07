# ADR 039: Unified Upstream Consumer State Contract

- Status: Accepted
- Date: 2026-04-28
- Related:
  - [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Source-Driven Downstream Execution After Manual Widget Actions](./adr-source-driven-downstream-execution.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

The workspace graph already has important pieces of a standard upstream model, but the model stops
too early and widget rendering diverges after that.

Today the codebase already standardizes:

- binding topology status through `WidgetInputResolutionStatus`
  - `valid`
  - `unbound`
  - `missing-source`
  - `missing-output`
  - `contract-mismatch`
  - `self-reference-blocked`
  - `transform-invalid`
- dependency-graph edge status with the same topology vocabulary
- canonical tabular publication contracts
- shared passive upstream execution through `useResolveWidgetUpstream(...)`

But mounted consumer widgets still do not render against one shared upstream-consumer state model.

Instead, the current implementation is split across several layers:

1. the dependency layer resolves graph topology and input validity
2. binding helpers expose low-level booleans such as:
   - `hasCanonicalSourceBinding`
   - `hasResolvedFilterWidgetSource`
   - `isAwaitingBoundSourceValue`
   - `requiresUpstreamResolution`
3. widgets then interpret those booleans, runtime-state nullability, frame status, and row counts in
   slightly different ways

That produces divergence:

- some widgets use shared source-binding semantics well, such as graph, statistic, and
  debug-stream consumers
- some widgets infer mounted state from local runtime state instead of the shared binding model
- some widgets treat `idle` as if it were a completed empty result
- some widgets treat `valid binding + unresolved upstream publication` as if it were an invalid
  dataset
- the shared source explorer already had to invent a separate `pending` state that does not exist in
  `WidgetInputResolutionStatus`

There is also one implementation smell in the current tabular source helper:

- `isAwaitingBoundSourceValue` currently treats an empty normalized frame as unresolved
- that makes `no published value yet` and `published empty result` too easy to conflate

This matters immediately because `ADR 038` wants to mount workspace widgets before initial
hydration finishes. If the consumer-state model stays implicit and widget-specific, progressive
mounting will expose inconsistent and misleading first-load UI.

## Decision

We will introduce a unified upstream consumer state contract for widgets whose primary rendered
content depends on bound upstream workspace outputs.

This ADR is a prerequisite for `ADR 038`.

`ADR 038` should not be implemented widget-by-widget on top of ad hoc local state heuristics.
Progressive workspace mounting needs one shared interpretation of:

- binding validity
- upstream publication visibility
- upstream execution-in-progress
- successful empty results
- upstream execution errors

The new contract will sit above binding-resolution status and below widget-specific semantic
rendering.

## Scope

This ADR applies to widgets that participate in the workspace graph as consumers or republishers of
upstream widget outputs.

In scope:

- graph-like consumers of canonical tabular or data-node-backed datasets
- statistic-like consumers
- table-like consumers and republishers
- transform widgets that consume and republish upstream datasets
- debug/inspection consumers that should reflect the same source-state semantics as production
  consumers

Out of scope:

- source-owner widgets whose primary job is to execute and publish data, such as `connection-query`
- static/local widgets that do not depend on upstream graph data
- component-local async that is not part of upstream widget publication, such as standalone
  `useQuery(...)` fetches or local OpenAPI discovery

Those out-of-scope widgets still need good loading behavior, but not through this contract.

## Architecture

### 1. Keep topology status as the binding layer

`WidgetInputResolutionStatus` remains the source of truth for graph topology and binding validity.

It answers questions like:

- is the input bound
- does the source widget still exist
- does the selected output still exist
- is the contract compatible
- is the transform path valid

That layer must not be replaced by widget-local guesswork.

### 2. Add a shared mounted consumer-state layer

We will add a shared discriminated state for mounted upstream consumers.

Representative shape:

```ts
type UpstreamConsumerStateKind =
  | "unbound"
  | "missing-source"
  | "missing-output"
  | "contract-mismatch"
  | "self-reference-blocked"
  | "transform-invalid"
  | "awaiting-upstream"
  | "loading"
  | "ready"
  | "empty"
  | "error";
```

The shared resolver should return a richer object than just `kind`, for example:

```ts
type ResolvedUpstreamConsumerState<TDataset> = {
  kind: UpstreamConsumerStateKind;
  dataset: TDataset | null;
  deltaDataset?: TDataset | null;
  inputStatus?: WidgetInputResolutionStatus;
  sourceWidgetId?: string;
  sourceOutputId?: string;
  sourceWidgetTitle?: string | null;
  error?: string | null;
  requiresUpstreamResolution: boolean;
  hasPublishedValue: boolean;
};
```

Widgets should render from this shared state object instead of independently combining:

- `resolvedInput.status`
- `runtimeState == null`
- `dataset.status`
- `rows.length`
- `columns.length`
- local `idle` fallbacks

### 3. Derive the shared state with strict precedence

The consumer-state resolver should apply state precedence in this order:

1. binding-invalid states
   - `unbound`
   - `missing-source`
   - `missing-output`
   - `contract-mismatch`
   - `self-reference-blocked`
   - `transform-invalid`
2. `awaiting-upstream`
   - binding is valid
   - no usable upstream publication is visible yet
   - consumer should ask the shared execution provider to resolve upstream when allowed
3. `loading`
   - a canonical upstream publication exists and is explicitly loading
   - stale retained data may still be present
4. `error`
   - a canonical upstream publication exists and is explicitly errored
5. `empty`
   - upstream publication completed successfully
   - canonical source dataset is present
   - dataset has no rows for the current selection
6. `ready`
   - upstream publication completed successfully
   - canonical source dataset is present
   - dataset has rows

Widget-specific semantic states still remain local after that.

Examples:

- a graph may still have local states such as `missing x field` or `no chartable numeric series`
- a statistic may still have local states such as `missing value field`
- a table may still have local display configuration states

But those widget-local semantic states should only run after the upstream consumer state has already
been normalized.

### 4. Stop using emptiness heuristics as a proxy for unresolved publication

An empty successful dataset is not the same thing as "the source has not published yet."

The shared contract must not derive `awaiting-upstream` from row-count or column-count heuristics
alone.

Specifically:

- do not infer unresolved publication from `0 rows`
- do not infer unresolved publication from `0 columns`
- do not infer unresolved publication from an empty canonical frame unless the publication lifecycle
  itself says the value is still not ready

This is important for widgets that legitimately return zero-row results for the selected time window
or filters.

### 5. Standardize the hook surface

The current binding hooks already know almost everything needed for this contract.

We should standardize their consumer-facing output so tabular and data-node consumers expose the
same mounted-state semantics.

Recommended direction:

- add a shared state resolver in `src/widgets/shared/`
- have `useResolvedTabularWidgetSourceBinding(...)` expose the normalized consumer state
- have `useResolvedDataNodeWidgetSourceBinding(...)` project onto the same state contract
- keep specialized fields like `resolvedSourceProps` and `resolvedSourceDeltaFrame`, but stop making
  each widget derive state from raw booleans on its own

### 6. Keep execution ownership unchanged

This ADR does not change runtime ownership.

- executable/source widgets still own fetch and publish
- passive consumers still use `useResolveWidgetUpstream(...)`
- consumer widgets must not issue local canonical fetches for upstream-owned data

What changes is the interpretation surface between graph resolution and widget rendering.

### 7. Separate upstream-consumer state from local async widget state

Not every loading problem in the workspace is an upstream-consumer problem.

Examples:

- `connection-query` is a source-owner widget, not an upstream consumer
- `AppComponentWidget` has local OpenAPI discovery behavior that is adjacent but not identical
- `PositionsTableWidget` is a local query widget, not a bound consumer

Those widgets still need better mounted-state semantics, but they should not be forced through the
upstream-consumer contract if they are not actually consuming upstream widget publications.

## Consequences

Positive:

- consumer widgets render against one shared mounted-state contract
- progressive workspace mounting has a stable semantic base
- `awaiting-upstream`, `loading`, `empty`, and `invalid binding` stop being conflated
- table-like republishers can stop inventing their own source-state interpretation
- widget settings and debug surfaces can reuse the same state vocabulary as canvas widgets

Negative:

- the current binding helpers must grow a more opinionated public shape
- some existing widgets will need migration away from local runtime-state heuristics
- a few widgets that looked "simple" will reveal hidden ambiguity in their current state handling

## Relationship To ADR 038

`ADR 039` should land before `ADR 038` implementation begins.

Reason:

- `ADR 038` makes mounted widget state visible earlier
- this ADR defines the shared meaning of that mounted state for upstream consumers

Without this ADR first, `ADR 038` would push the codebase toward more per-widget divergence at the
same moment it needs less.

`ADR 038` may still include additional widget fixes outside this ADR's scope, especially for
source-owner widgets and local-query widgets. But its consumer-widget rollout should use this
contract first.

## Backend And Storage Impact

This ADR does not require a workspace-storage or backend-schema change.

It does change frontend runtime expectations in one important way:

- source-owner widgets should publish explicit runtime status clearly enough that consumers can
  distinguish `awaiting publication`, `loading`, `ready`, `empty`, and `error` without row-count
  guesswork

That is still a frontend runtime contract change, not a backend persistence change.

## Guardrails

- Do not replace `WidgetInputResolutionStatus`; build on top of it.
- Do not let widgets infer mounted source state from `null`, `0 rows`, or `0 columns` alone.
- Do not force source-owner widgets and local-query widgets into the upstream-consumer contract when
  they are not graph consumers.
- Do not let consumer widgets bypass `useResolveWidgetUpstream(...)` for upstream-owned data.
- Do not keep both the old ad hoc booleans and the new shared state as parallel long-term APIs.

## Implementation Checklist

- [x] Add a shared `ResolvedUpstreamConsumerState` contract under `src/widgets/shared/`.
- [x] Add a shared resolver that derives mounted consumer state from:
      `ResolvedWidgetInput`, normalized upstream dataset/frame, source widget reference, and runtime
      status.
- [x] Project `useResolvedTabularWidgetSourceBinding(...)` onto the new shared consumer-state
      contract.
- [x] Project `useResolvedDataNodeWidgetSourceBinding(...)` onto the same consumer-state contract.
- [x] Remove the current empty-frame heuristic from `awaiting-upstream` derivation and replace it
      with explicit publication-state semantics.
- [x] Migrate `GraphWidget`, `StatisticWidget`, and `DebugStreamWidget` to use the shared contract as
      reference implementations.
- [x] Migrate `TableWidget` and `TabularTransformWidget` so they stop interpreting upstream state
      through local heuristics.
- [x] Reuse the same state vocabulary in widget settings and source-explorer surfaces where pending
      and binding-invalid statuses are currently modeled separately.
- [ ] Update `ADR 038` implementation to use this contract for consumer-widget mounted states.
- [x] Update the nearest implementation README files when the runtime change lands and this ADR moves
      from `Proposed` to `Accepted`.
