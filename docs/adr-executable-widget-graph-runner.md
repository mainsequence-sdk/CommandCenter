# ADR: Executable Widget Graph Runner and Refresh Coordination

- Status: Proposed
- Date: 2026-04-02
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)

## Context

The current platform now has the right dataflow foundation for bound widget composition:

- canonical `WidgetPortBinding` storage on widget instances
- dynamic/static instance IO through `io` and `resolveIo`
- output descriptors and binding-level output transforms
- a dependency model that resolves outputs, applies transforms, and validates inputs
- `AppComponent` request/response ports generated from persisted `bindingSpec`
- `AppComponent` runtime `publishedOutputs` resolved through the shared dependency model

That foundation is necessary, but it is not sufficient for executable graph runs.

Today:

- `AppComponent` still executes inline from [`src/widgets/core/app-component/AppComponentWidget.tsx`](../src/widgets/core/app-component/AppComponentWidget.tsx)
- settings `Test request` still executes inline from [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx)
- the dependency model in [`src/dashboards/widget-dependencies.ts`](../src/dashboards/widget-dependencies.ts) resolves values but does not execute widgets
- dashboard refresh in [`src/dashboards/DashboardControls.tsx`](../src/dashboards/DashboardControls.tsx) is centralized, but it currently coordinates query invalidation rather than executable widget graphs

This creates three problems:

1. a target widget can have valid bindings but still fail because its upstream executable widgets have not run in the current runtime cycle
2. if we add graph execution ad hoc inside widgets or settings pages, execution behavior will fork across surfaces
3. refresh can become unsafe or duplicate work, especially for widgets like `AppComponent` that support mutating HTTP methods

The product requirement is:

- clicking `Submit` in normal view and `Test request` in settings must follow the same execution path
- upstream executable dependencies must run first, then the target widget runs with fresh resolved inputs
- the solution must be generic for all executable widgets, not an `AppComponent`-only orchestration layer
- refresh-triggered execution must be explicit, centralized, deduplicated, and safe by default

## Decision

We will add a separate dashboard-level executable graph runner that sits above the binding engine.

This runner will:

- use the existing dependency model as its source of truth
- execute widgets through a first-class `WidgetDefinition.execution` contract
- rebuild dependency snapshots after each execution step
- apply runtime-state patches returned by executors
- coordinate refresh-triggered execution through explicit refresh policy and in-flight deduplication

Execution logic will not be embedded into:

- widget render components
- widget settings pages
- the dependency provider
- `DashboardControls`

## Architecture

### 1. Keep dependency resolution pure

The dependency engine remains responsible for:

- resolving instance IO
- resolving outputs
- applying binding transforms
- validating input compatibility
- exposing resolved input/output state to UI and runtime consumers

It does not execute widgets.

This keeps [`src/dashboards/widget-dependencies.ts`](../src/dashboards/widget-dependencies.ts) pure and reusable.

### 2. Add a first-class widget execution contract

Executable widgets will opt into a separate execution contract on `WidgetDefinition`.

The target API shape is:

```ts
export type WidgetExecutionReason =
  | "manual-submit"
  | "settings-test"
  | "dashboard-refresh"
  | "manual-recalculate";

export interface WidgetExecutionTargetOverrides<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  props?: TProps;
  runtimeState?: Record<string, unknown>;
  draftValues?: Record<string, string>;
}

export interface WidgetExecutionContext<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  widgetId: string;
  instanceId: string;
  reason: WidgetExecutionReason;
  props: TProps;
  runtimeState?: Record<string, unknown>;
  resolvedInputs?: ResolvedWidgetInputs;
  targetOverrides?: WidgetExecutionTargetOverrides<TProps>;
  refreshCycleId?: string;
  signal?: AbortSignal;
}

export interface WidgetExecutionResult {
  status: "success" | "error" | "skipped";
  runtimeStatePatch?: Record<string, unknown>;
  error?: string;
}

export interface WidgetExecutionDefinition<
  TProps extends Record<string, unknown> = Record<string, unknown>,
> {
  canExecute?: (context: WidgetExecutionContext<TProps>) => boolean;
  execute: (context: WidgetExecutionContext<TProps>) => Promise<WidgetExecutionResult>;
  getRefreshPolicy?: (
    context: WidgetExecutionContext<TProps>,
  ) => "manual-only" | "allow-refresh";
  getExecutionKey?: (context: WidgetExecutionContext<TProps>) => string;
}
```

And `WidgetDefinition` will gain:

```ts
execution?: WidgetExecutionDefinition<TProps>;
```

This keeps execution extensibility parallel to `io` / `resolveIo` instead of mixing runtime side effects into the dependency model.

### 3. Build execution snapshots from the dependency engine

The graph runner must consume the existing binding engine rather than bypass it.

For any execution request, the coordinator will build an execution snapshot from:

- the current widget instances
- the current widget definitions
- the current runtime state
- optional target overrides for the target widget only

That snapshot will internally use the existing dependency model so it sees:

- transformed bindings
- dynamic `resolveIo`
- `AppComponent` binding-native request/response ports
- current resolved input values and statuses

Conceptually:

```ts
interface DashboardExecutionSnapshot {
  dependencies: DashboardWidgetDependencyModel;
  getInstance(instanceId: string): DashboardWidgetInstance | undefined;
  getDefinition(instanceId: string): WidgetDefinition | undefined;
}
```

After each upstream execution step, the coordinator must rebuild the snapshot rather than trying to patch dependency internals manually.

### 4. Keep execution results as runtime-state patches

Executors do not publish outputs directly.

Instead, each executor returns a `runtimeStatePatch`. The coordinator applies that patch to the widget instance runtime state, and the existing binding engine continues to resolve outputs from runtime state as it does today.

This preserves the architectural separation:

- executors run work and update runtime state
- the dependency model resolves outputs from runtime state

### 5. Add a separate dashboard execution coordinator

A new coordinator module and provider will own:

- graph-run requests
- upstream traversal
- cycle detection
- topological ordering
- runtime-state patch application
- in-flight deduplication
- refresh-cycle coordination
- execution status reporting

This logic belongs in a separate dashboard module, not inside widget components or settings pages.

### 6. Execute only valid upstream executable dependencies

Starting from a target widget:

1. inspect resolved inputs from the execution snapshot
2. follow only inputs whose resolved status is `valid`
3. collect upstream source widget instance ids
4. recurse only into source widgets whose definitions expose `execution`
5. detect cycles
6. topologically execute upstream widgets first
7. rebuild the snapshot after each successful step
8. execute the target widget last

In the first slice, we do not auto-run downstream dependents.

### 7. Use one graph-runner API for all surfaces

Normal submit and settings test must use the same graph-runner API:

```ts
executeWidgetGraph(targetInstanceId, {
  reason: "manual-submit" | "settings-test" | "dashboard-refresh" | "manual-recalculate",
  refreshCycleId?: string,
  targetOverrides?: {
    props?: Record<string, unknown>;
    runtimeState?: Record<string, unknown>;
    draftValues?: Record<string, string>;
  },
});
```

Behavior:

- normal widget submit uses current persisted props/runtime
- settings test uses unsaved target overrides for the target widget only
- upstream widgets always execute from the current workspace draft/runtime state

This is the only acceptable way to keep `Submit` and `Test request` aligned.

### 8. Make refresh eligibility explicit and conservative

Refresh execution is not implied by “widget is executable”.

Each executable widget may expose `getRefreshPolicy(...)` and the default must be conservative:

- `manual-only` unless explicitly allowed

This matters because `AppComponent` can execute:

- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- `OPTIONS`
- `HEAD`

Mutating request widgets must not auto-run on dashboard refresh by default.

For `AppComponent`, the intended policy is:

- default: `manual-only`
- optionally `allow-refresh` only for safe/idempotent methods such as `GET`, `HEAD`, or `OPTIONS`, and only when explicitly enabled by widget config

### 9. Deduplicate by effective execution identity

The in-flight registry key must be strong enough to prevent accidental joining of distinct runs.

It should include:

- workspace or dashboard identity
- target instance id
- execution reason
- refresh cycle id when present
- effective target override hash when present

This is especially important for settings test runs, where two requests against the same widget id may differ by unsaved draft props or draft values.

### 10. Refresh coordination stays centralized

Dashboard refresh timing remains centralized in [`src/dashboards/DashboardControls.tsx`](../src/dashboards/DashboardControls.tsx).

The rule becomes:

- `DashboardControls` defines refresh timing and cycle boundaries
- the execution coordinator decides which executable graphs run for a cycle
- widgets do not independently react to refresh by starting their own graph runs

React Query invalidation remains for passive/query-driven widgets. Executable graph runs are coordinated separately.

## AppComponent Guidance

`AppComponent` is the first executable widget and should be used as the implementation model, not as a special orchestration exception.

The request-building and submit logic should move into a pure executor module, for example:

- [`src/widgets/core/app-component/appComponentExecution.ts`](../src/widgets/core/app-component/)

That executor should:

- normalize props/runtime state
- resolve bound inputs through the existing overlay logic
- build the request
- submit the request
- return a `WidgetExecutionResult` with a runtime-state patch

It should not directly mutate global graph state and it should not bypass the binding engine.

## Planned Implementation Placement

The first implementation should land in these areas:

- [`src/widgets/types.ts`](../src/widgets/types.ts)
  - add `WidgetDefinition.execution`
  - add execution reason/context/result types
- [`src/dashboards/widget-graph-execution.ts`](../src/dashboards/)
  - traversal
  - cycle detection
  - topological ordering
  - execution snapshot building
  - in-flight dedupe
- [`src/dashboards/DashboardWidgetExecution.tsx`](../src/dashboards/)
  - provider
  - hooks
  - surface adapters for runtime-state writes
- [`src/widgets/core/app-component/appComponentExecution.ts`](../src/widgets/core/app-component/)
  - pure `AppComponent` executor
- [`src/features/dashboards/DashboardCanvas.tsx`](../src/features/dashboards/DashboardCanvas.tsx)
  - mount execution provider for normal view
- [`src/features/dashboards/CustomWidgetSettingsPage.tsx`](../src/features/dashboards/CustomWidgetSettingsPage.tsx)
  - mount execution provider for settings flow
- [`src/dashboards/DashboardControls.tsx`](../src/dashboards/DashboardControls.tsx)
  - hand off refresh cycle ids to the execution coordinator

## Scope

This ADR covers the first implementation slice:

1. add `execution?: WidgetExecutionDefinition` to widget definitions
2. add a separate dashboard execution coordinator module
3. add an execution provider/hook surface independent from the dependency provider
4. implement execution snapshots backed by the dependency model
5. implement upstream traversal, cycle detection, and topological ordering
6. refactor `AppComponent` into a pure executor module
7. wire normal submit and settings test to the same `executeWidgetGraph(...)` API
8. add explicit refresh policy and conservative refresh safety defaults
9. add override-aware in-flight deduplication
10. keep outputs flowing through runtime state and the existing binding engine
11. update docs and affected module READMEs

## Non-Goals

This ADR does not decide:

- automatic downstream execution after the target node finishes
- persistent run history or execution queues
- expression-based execution policies
- replacement of React Query invalidation for passive widgets
- automatic refresh enablement for executable widgets
- graph UI changes beyond execution status integration

## Rejected Alternatives

### Keep execution inline in AppComponent only

Rejected because it would duplicate orchestration between widget view, settings, refresh behavior, and future executable widgets.

### Put execution inside the dependency model

Rejected because the dependency model should remain pure and focused on graph/value resolution.

### Traverse raw bindings instead of dependency snapshots

Rejected because it would duplicate transform logic, ignore dynamic `resolveIo`, and drift from the actual resolved graph state.

### Auto-refresh every executable widget by default

Rejected because executable widgets may be mutating or unsafe to rerun automatically.

### Publish outputs directly from executors

Rejected because outputs already have a canonical path through runtime state and the binding engine.

## Implementation Tasks

1. Extend [`src/widgets/types.ts`](../src/widgets/types.ts) with:
   - `WidgetExecutionReason`
   - `WidgetExecutionTargetOverrides`
   - `WidgetExecutionContext`
   - `WidgetExecutionResult`
   - `WidgetExecutionDefinition`
   - `execution?: WidgetExecutionDefinition` on `WidgetDefinition`

2. Add a new execution module under `src/dashboards/` for:
   - execution snapshot building from current widgets + definitions + target overrides
   - upstream traversal from resolved valid inputs
   - cycle detection
   - topological sorting
   - in-flight dedupe keyed by workspace/target/reason/cycle/override-hash

3. Add a new execution provider under `src/dashboards/` that exposes:
   - `executeWidgetGraph(...)`
   - current execution state by widget instance
   - adapter-based runtime-state patch application

4. Extract a pure executor for `AppComponent` that:
   - uses existing request-building logic
   - uses existing bound-input overlay logic
   - returns `runtimeStatePatch`
   - defines explicit refresh policy

5. Update normal widget submit to call the coordinator instead of inline request execution.

6. Update settings `Test request` to call the same coordinator with target overrides.

7. Rebuild the execution snapshot after each successful upstream run so downstream nodes see fresh outputs.

8. Integrate dashboard refresh with coordinator-managed cycle ids and policy checks.

9. Add execution status/error messaging to surfaces without duplicating orchestration logic.

10. Update docs and affected README files to reflect the new execution architecture.
