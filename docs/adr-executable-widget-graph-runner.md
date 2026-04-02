# ADR: Executable Widget Graph Runner and Refresh Coordination

- Status: Proposed
- Date: 2026-04-02
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)

## Context

The current widget dependency model resolves values, but it does not execute widgets.

Today:

- bindings are resolved through [`src/dashboards/widget-dependencies.ts`](../src/dashboards/widget-dependencies.ts)
- `AppComponent` can consume bound values from upstream widgets
- `AppComponent` submit in normal view and `Test request` in settings both execute only the clicked widget
- upstream dependencies are not executed automatically before the target request
- dashboard refresh is centralized in [`src/dashboards/DashboardControls.tsx`](../src/dashboards/DashboardControls.tsx), but it only invalidates query-driven widgets and does not coordinate executable widget graphs

This creates two architectural problems:

1. a bound request field may appear correctly connected, but the clicked widget still fails because the upstream request widget has not run yet in the current runtime cycle
2. if we naïvely add graph execution inside individual widgets, dashboard refresh and manual submit can trigger duplicate overlapping runs of the same upstream chain

The product requirement is:

- clicking `Submit` in normal view and `Test request` in settings should behave the same
- upstream request dependencies should run first, then the clicked widget should run with fresh outputs
- the solution must be generic for all executable widgets, not a special-case `AppComponent` hack
- refresh behavior must be coordinated so one refresh cycle does not double-run the same graph

## Decision

We will add a separate dashboard-level executable graph runner that coordinates widget execution, runtime-state updates, and refresh deduplication.

This will be implemented as shared infrastructure, not embedded into `AppComponentWidget.tsx`,
`AppComponentWidgetSettings.tsx`, or `DashboardControls.tsx`.

## Architecture

### 1. Add a generic executable-widget contract

Widgets that can actively produce outputs by running work will opt into a shared execution
contract on their definition.

Examples:

- API/request widgets such as `AppComponent`
- future workflow/action widgets
- any widget whose outputs depend on executing logic, not only passive local rendering

Passive widgets remain outside this contract.

The contract should answer:

- can this instance execute?
- how does it execute?
- how does it publish runtime state and outputs?
- is it eligible for dashboard refresh execution?

### 2. Add a dashboard execution coordinator

A shared dashboard-level coordinator will own:

- executable widget lookup
- upstream dependency traversal
- topological execution order
- runtime-state writes for any widget instance
- execution progress and error aggregation
- in-flight deduplication
- refresh-cycle coordination

This coordinator must be a separate logic module and provider, not hidden inside:

- widget components
- settings pages
- the dependency model
- `DashboardControls`

### 3. Keep dependency resolution and execution separate

The dependency model remains responsible for:

- describing graph edges
- resolving current inputs and outputs
- validating bindings

The execution coordinator becomes responsible for:

- deciding which executable upstream widgets must run
- running them in order
- updating runtime state between steps
- triggering the target widget last

This keeps the graph model pure and the execution logic maintainable.

### 4. Use one execution path for settings and normal view

Settings `Test request` and normal view `Submit` must call the same graph-runner API.

The only difference is the target widget override context:

- normal view uses the live mounted widget state
- settings uses unsaved draft props and test draft values for the target widget only

Upstream widgets continue to execute from the current workspace draft instances.

### 5. Execute only upstream dependencies in the first slice

For an execution request targeting widget `T`:

1. inspect bound inputs of `T`
2. recursively collect executable upstream source widgets
3. detect cycles
4. execute upstream widgets in topological order
5. re-resolve outputs after each step
6. execute `T` last

This first slice intentionally does not auto-run downstream dependents after `T` completes.

### 6. Dashboard refresh must be coordinated centrally

Dashboard refresh is already centralized in [`src/dashboards/DashboardControls.tsx`](../src/dashboards/DashboardControls.tsx).

The new rule is:

- `DashboardControls` owns refresh timing and cycle boundaries
- the execution coordinator owns executable graph refresh work
- widgets must not independently trigger graph execution because refresh fired

Refresh should produce one execution pass per refresh cycle, not multiple independent widget-local runs.

### 7. Prevent double refresh and overlapping duplicate runs

The coordinator will maintain an in-flight execution registry keyed by:

- dashboard/workspace identity
- target widget instance id
- execution reason
- refresh cycle id when applicable

This enables:

- at most one graph run per target per refresh cycle
- deduplication when refresh and manual actions collide
- safe rejection or joining of duplicate requests

### 8. Distinguish execution reasons

The shared execution API should accept an explicit reason, for example:

- `manual-submit`
- `settings-test`
- `dashboard-refresh`

This is important for:

- deduplication
- UX messaging
- future policy differences

### 9. Refresh and query invalidation remain separate concerns

Dashboard refresh currently invalidates React Query caches.

That behavior should remain for passive/query-driven widgets.

Executable graph runs must be coordinated separately rather than piggybacking on query invalidation.

This avoids accidental double work such as:

- query invalidation causing a widget to refetch
- widget-local code also triggering executable graph submission
- both happening in the same refresh cycle

## Execution Model

The target API shape should conceptually look like:

```ts
executeWidgetGraph(targetInstanceId, {
  reason: "manual-submit" | "settings-test" | "dashboard-refresh",
  refreshCycleId?: string,
  targetOverrides?: {
    props?: Record<string, unknown>;
    runtimeState?: Record<string, unknown>;
    draftValues?: Record<string, string>;
  },
});
```

The coordinator should:

1. collect executable upstream dependencies
2. dedupe against in-flight work
3. execute upstream nodes in order
4. persist runtime state after each node
5. re-resolve dependency outputs after each step
6. execute the target widget
7. return aggregated execution results

## Refresh Coordination

The first implementation must include refresh-safety rules:

1. one dashboard refresh tick equals one refresh cycle id
2. an executable widget graph may run at most once per cycle for the same target
3. if a manual submit arrives while the same target graph is already running:
   - prefer joining/reusing the in-flight run when safe
   - otherwise serialize one rerun after completion
4. widgets must not self-schedule a second execution because their inputs changed during the same run

## Scope

This ADR covers the first implementation slice:

1. add a generic executable-widget contract
2. add a separate dashboard execution coordinator module/provider
3. add shared runtime-state mutation hooks for coordinator-managed execution
4. implement upstream dependency traversal and cycle detection
5. execute upstream nodes and target node in topological order
6. use the same coordinator from normal view `Submit` and settings `Test request`
7. integrate dashboard refresh with the coordinator through refresh cycle ids
8. add in-flight deduplication and refresh double-run protection

## Non-Goals

This ADR does not decide:

- automatic downstream execution after the target node finishes
- arbitrary scheduling policies beyond manual submit and dashboard refresh
- replacing React Query invalidation for passive widgets
- a visual execution timeline UI
- persistence of execution queues or run history

## Rejected Alternatives

### Put execution logic inside AppComponent only

Rejected because it would create a second hidden orchestration layer that other executable widgets
could not reuse.

### Put graph execution inside the dependency model

Rejected because the dependency model should remain pure, synchronous, and focused on graph/value
resolution rather than side effects.

### Let widgets react to refresh independently

Rejected because it creates duplicate runs, inconsistent ordering, and no central way to dedupe
manual submit against refresh-triggered execution.

### Implement settings execution separately from normal-view submit

Rejected because it would drift into two different behaviors for the same widget graph.

## Implementation Tasks

1. Extend widget definition types with a reusable executable-widget contract.
2. Add a new dashboard execution coordinator module under `src/dashboards/`.
3. Add a provider/hook surface for:
   - executing a target widget graph
   - reading in-flight execution status
   - writing runtime state for arbitrary widget instances
4. Implement upstream dependency traversal using existing widget bindings.
5. Implement cycle detection and explicit blocking diagnostics.
6. Implement topological upstream-first execution.
7. Refactor `AppComponent` request submission into a reusable executor used by the shared coordinator.
8. Wire normal widget submit to the coordinator.
9. Wire settings `Test request` to the same coordinator with target overrides.
10. Integrate dashboard refresh with refresh cycle ids and in-flight deduplication.
11. Update docs and affected module READMEs.
