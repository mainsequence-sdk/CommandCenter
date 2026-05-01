# ADR 049: Publication-Driven Seed/Live Runtime Reduction

- Status: Accepted
- Date: 2026-05-01
- Related:
  - [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)

## Context

ADR 044 introduced explicit `seedData` and `liveUpdates` roles. ADR 047 introduced a
workspace-scoped runtime data store so large tabular datasets can live behind stable refs instead of
moving by value through widget runtime state.

The current shared incremental consumer still violates the intended ownership split.

Today the dual-role path in `useIncrementalTabularConsumerBindingState(...)`:

- reads the current consumer runtime state
- reconstructs seed/live frames from that runtime state and current resolved inputs
- recomputes the seed/live union in an effect
- writes a new runtime state back into the workspace store

That means seed/live reduction is still render-driven.

This is the wrong model.

The reducer should not recompute because React rerendered. It should recompute only when upstream
publication identity changed.

The current shape has several concrete problems:

- widgets with both roles bound, especially OHLC with historical seed plus WebSocket live updates,
  exercise the combine path on nearly every pass
- effect-driven recomputation can write runtime state repeatedly and trigger `Maximum update depth
  exceeded`
- dedupe still depends too much on runtime-state metadata instead of publication identity
- volatile fields such as `updatedAtMs` can still leak into equality decisions
- the dependency resolver can treat an incremental carrier `valueRef` as the base ref, even when
  the authoritative retained ref is `outputRef` or `retainedOutputRef`

This is not an OHLC-only bug. OHLC simply exposes it first because it usually binds both roles at
the same time.

## Decision

Seed/live reduction becomes publication-driven, store-owned, and ref-keyed.

The shared incremental consumer hook must stop behaving like a reducer that reconstructs consumer
state from runtime-state metadata on every effect pass.

Instead:

- upstream sources publish stable incremental identities
- dependency resolution preserves those identities
- the runtime data store owns the reduced seed/live output for a consumer
- the consumer hook reads the reduced output and publishes runtime state only when the reduced
  output identity changes

The invariant is:

```text
combine once per upstream publication transition
never combine again only because React rerendered
```

## Publication Identity Rules

Reduction must be keyed from upstream publication identity, not from a materialized frame snapshot.

Representative identity inputs:

- seed retained ref id + version
- seed source run id when present
- live retained ref id + version when present
- live delta ref id + version when present
- live source run id when present
- live publication sequence when present
- merge key fields
- retention policy
- row selector only when the reducer itself owns the bounded output

`updatedAtMs` is not part of reduction identity.

Lifecycle-only changes such as reconnect timestamps, heartbeat timestamps, or transport bookkeeping
must not cause a new reduced data output unless the underlying retained or delta refs changed.

## Base And Delta Ref Resolution

For an explicit `updates` output, the dependency resolver must treat the runtime update envelope as
the authoritative source of base and delta identity.

Rules:

- `upstreamBaseRef` must prefer `outputRef ?? retainedOutputRef`
- `upstreamDeltaRef` must prefer `deltaOutputRef`
- raw carrier `valueRef` is only a fallback when there is no runtime update envelope

This matters because an incremental carrier may physically carry the delta frame while the
authoritative retained dataset lives behind `outputRef`. A consumer that mistakes the carrier ref
for the retained base ref can re-seed or re-reduce incorrectly.

## Runtime Data Store Responsibilities

ADR 047 already moved large row ownership into the runtime data store. This ADR refines that
decision:

- seed/live union must also be cached by the runtime data store
- the store must return the same combined ref identity when the publication identity did not change
- the store must only increment the combined ref version when the reduced output actually changed

Representative API refinement:

```ts
interface RuntimeDataStore {
  reduceIncremental(input: {
    ownerId: string;
    outputId: string;
    seed?: {
      baseRef?: RuntimeTabularFrameRef | null;
      signature?: string;
      sourceRunId?: string;
    };
    live?: {
      baseRef?: RuntimeTabularFrameRef | null;
      deltaRef?: RuntimeTabularFrameRef | null;
      signature?: string;
      sourceRunId?: string;
      sequence?: number;
    };
    mergeKeyFields: string[];
    retention?: RuntimeRetentionPolicy;
    refKey?: string;
  }): RuntimeTabularFrameRef | null;
}
```

This can be implemented as a new API or by strengthening the current `combine(...)` path with a
stable publication cache. The important point is behavioral, not the exact method name:

- reduction is driven by publication identity
- reduction is cached outside React render/effect churn

## Consumer Hook Responsibilities

`useIncrementalTabularConsumerBindingState(...)` becomes a reader and coordinator, not the primary
reducer.

It may still:

- resolve `seedData` and `liveUpdates`
- read current reduced refs from the store
- materialize a bounded runtime frame for the widget
- publish small runtime metadata back to the workspace store

It must not:

- recompute a seed/live union on every effect pass from materialized frames
- treat current widget runtime state as the primary source of truth for prior reductions
- rely on volatile timestamps to decide whether a new runtime write is needed

Consumer runtime state should carry:

- reduced output ref
- optional seed/live refs
- semantic reducer metadata such as merge keys or source run ids

It should not carry by-value seed/live retained frames except as a narrow compatibility fallback
when no runtime data store exists.

## Equality And Dedupe Rules

The system must use semantic equality at every shared layer:

### 1. Incremental reducer dedupe

- compare refs, versions, row counts, schema signatures, source run ids, and sequence
- ignore `updatedAtMs`

### 2. Workspace runtime-state persistence dedupe

- compare semantic runtime state, not raw timestamp churn
- ignore volatile transport timestamps where they do not represent a data change

### 3. Dependency resolution

- preserve upstream ref identity instead of materializing and re-deriving identity from rows

## Consequences

### Positive

- dual-role consumers stop re-reducing on unrelated rerenders
- OHLC, graph, statistic, and table all use the same stable runtime model
- runtime-state write loops become much harder to trigger
- WebSocket lifecycle churn no longer looks like data churn
- HTTP incremental publications and WebSocket incremental publications share one reducer path
- downstream widgets continue to consume normal resolved inputs without transport-specific logic

### Negative

- the runtime data store must own one more cache layer
- debugging moves from local widget state into publication identity and reducer cache state
- the dependency resolver contract becomes stricter about base-ref vs carrier-ref semantics

## Non-Goals

- Do not create a widget-specific OHLC fix that bypasses the shared incremental path.
- Do not reintroduce transport-specific consumer code for HTTP versus WebSocket.
- Do not treat render-time materialized rows as the primary identity for incremental publications.
- Do not persist runtime data store contents to backend workspace storage.

## Backend Contract Impact

None.

This ADR changes frontend runtime ownership and reduction behavior. It does not change the
persisted workspace schema or backend API contract.

## Implementation Tasks

- [x] Replace render-driven seed/live reduction in
      `useIncrementalTabularConsumerBindingState(...)` with publication-driven reduction keyed from
      upstream ref identity.
- [x] Add a runtime data store reduction cache for dual-role consumer outputs, or strengthen the
      existing combine path so unchanged publication identity returns the same reduced ref.
- [x] Make dependency resolution prefer `outputRef` / `retainedOutputRef` over carrier `valueRef`
      for `updates` outputs.
- [x] Remove volatile `updatedAtMs` usage from shared incremental reducer equality and signature
      gates.
- [x] Reduce consumer runtime state to refs plus semantic metadata instead of by-value seed/live
      frames wherever the runtime data store is available.
- [x] Add shared regression coverage for:
  - [x] dual-role `seedData` + `liveUpdates` consumers do not recompute reduction on plain rerender
  - [x] lifecycle-only stream-state changes do not republish reduced data
  - [x] a new live delta publication advances the reduced output exactly once
  - [x] `updates` bindings preserve retained base ref identity correctly
  - [ ] OHLC, graph, statistic, and table all stay on the same shared incremental path

## Acceptance Criteria

- A widget with both `seedData` and `liveUpdates` bound does not recompute the seed/live union on
  every effect pass.
- A widget rerender without new upstream publication identity does not write a new runtime state.
- WebSocket reconnect metadata changes alone do not trigger a new reduced data output.
- Dual-role consumers remain transport-neutral and continue to work for both HTTP incremental and
  WebSocket incremental publications.
- The shared fix removes the class of update-depth loops caused by render-driven incremental
  reduction.
