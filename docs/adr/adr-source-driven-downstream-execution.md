# ADR: Source-Driven Downstream Execution After Manual Widget Actions

- Status: Accepted
- Date: 2026-04-05
- Related:
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: AppComponent as a Binding-Native API Widget](./adr-app-component-binding-native-api-widget.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)

## Context

The shared execution runner now gives the platform a clean way to execute a target widget with its
valid upstream executable dependencies first.

Today that runtime path is centered on:

- [`src/dashboards/widget-graph-execution.ts`](../src/dashboards/widget-graph-execution.ts)
- [`src/dashboards/DashboardWidgetExecution.tsx`](../src/dashboards/DashboardWidgetExecution.tsx)
- [`src/widgets/core/app-component/AppComponentWidget.tsx`](../src/widgets/core/app-component/AppComponentWidget.tsx)

That architecture is correct for:

- dashboard refresh
- explicit target recalculation
- settings-side test execution
- any case where the caller means "run this widget graph"

It is not sufficient for source-driven manual actions.

The clearest example is `AppComponent`:

- the normal widget card exposes a `Submit` button
- submit currently calls `executeWidgetGraph(instanceId, { reason: "manual-submit" })`
- that executes upstream executable dependencies and the target widget itself
- it does not execute downstream executable dependents that consume the newly published outputs

So the current user-visible behavior is:

1. click `Submit` on an `AppComponent`
2. the AppComponent request runs and publishes fresh runtime outputs
3. downstream widgets bound to those outputs do not recompute immediately
4. they only update later when a dashboard refresh or explicit recalculation happens

This breaks the expected mental model for binding-native composition:

- manual source actions should propagate through the flow
- downstream execution should not require a second unrelated refresh
- the behavior should stay generic, not AppComponent-specific

There is also a second issue in the passive-resolution layer:

- `useResolveWidgetUpstream(...)` currently keys resolution off topology and dashboard-control state
- it does not include upstream output freshness
- a manual source execution therefore does not naturally invalidate passive upstream-resolution
  requests either

## Decision

We will keep target-graph execution and source-driven flow execution as two separate runtime APIs.

### 1. `executeWidgetGraph(...)` keeps its current meaning

`executeWidgetGraph(targetInstanceId, ...)` continues to mean:

- resolve valid upstream executable dependencies
- execute upstream first
- execute the target last

It remains an upstream-and-target API.

We will not redefine it to also walk downstream dependents.

### 2. Add a new source-driven flow API

We will add a second runtime API at the dashboard execution-provider layer:

```ts
executeWidgetFlow(sourceInstanceId, {
  reason: "manual-submit" | "manual-action" | "upstream-update",
});
```

This API means:

1. execute the source widget graph
2. rebuild the dependency snapshot with the updated runtime state
3. discover downstream execution targets that depend on that source
4. execute those downstream targets in dependency-safe order

This is the correct model for actions like:

- `AppComponent` card submit
- future source widgets with explicit "Run", "Search", or "Load" buttons

### 3. Downstream propagation is topology-based, not resolved-input-state-based

Downstream target discovery must use canonical binding topology, not only current resolved-input
validity.

Reason:

- before the source action runs, some downstream edges may currently be unresolved because the
  source has not published outputs yet
- those edges are still real graph dependencies and must become eligible after the source updates

The downstream walk must therefore inspect canonical bindings, not just `status === "valid"` on the
pre-action snapshot.

### 4. Propagation targets are ordered executable downstream candidates

The runtime should not blindly execute every downstream node, but it also must not collapse the
flow to leaves only.

For a chain such as:

- `AppComponent A -> AppComponent B -> AppComponent C`

the runtime must be able to execute `B` first so it can publish fresh outputs before `C` is
considered.

The downstream target selector therefore returns reachable executable widgets in downstream
topological order. Each selected target still runs through the existing upstream-aware graph runner,
so shared executable ancestors are deduped across the whole flow.

### 5. Settings test stays isolated

Settings-side `Test request` remains a target-only execution path.

It must not propagate through the live workspace graph because it runs against target overrides and
draft state.

Normal widget submit and settings test therefore intentionally diverge here:

- normal widget submit -> source-driven flow execution
- settings test -> target graph execution only

### 6. Passive upstream resolution must gain freshness awareness

Provider-level upstream-resolution invalidation must also include upstream execution freshness, not
only topology plus dashboard controls.

The execution provider will maintain a per-instance execution revision or freshness token and fold
those upstream revisions into the passive request key used by:

- `getUpstreamRequirement(...)`
- `useResolveWidgetUpstream(...)`

This keeps passive consumers coherent after manual source execution.

## Architecture

### 1. Keep the current graph runner intact

The existing runner in
[`src/dashboards/widget-graph-execution.ts`](../src/dashboards/widget-graph-execution.ts)
remains the canonical implementation of:

- cycle detection
- upstream traversal
- topological ordering
- runtime-state patch application
- execution status reporting

That file should continue to own target-graph execution.

### 2. Add downstream graph helpers beside the current upstream helpers

We will add shared helpers for source-driven propagation:

- `collectDirectDownstreamBindingIds(...)`
- `collectTransitiveDownstreamIds(...)`
- `listDashboardDownstreamExecutionTargets(...)`

These helpers should:

- walk canonical bindings from source to dependents
- include passive hops in the traversal
- return executable downstream candidates in stable dependency order
- avoid requiring the pre-action snapshot to already have valid resolved values

### 3. Add provider orchestration for source-driven flows

`DashboardWidgetExecutionProvider` will expose both APIs:

```ts
executeWidgetGraph(targetInstanceId, options)
executeWidgetFlow(sourceInstanceId, options)
```

`executeWidgetFlow(...)` will:

1. run the source graph
2. rebuild the execution snapshot from updated widgets/runtime state
3. compute downstream execution targets
4. run those downstream target graphs
5. share one `executedInstanceIds` set across the whole flow to prevent duplicate execution

### 4. Use a distinct execution reason for downstream propagation

We will extend `WidgetExecutionReason` with a dedicated downstream-propagation reason:

```ts
type WidgetExecutionReason =
  | "manual-submit"
  | "settings-test"
  | "dashboard-refresh"
  | "manual-recalculate"
  | "upstream-update";
```

This lets request tracing and execution diagnostics distinguish:

- the source widget explicitly triggered by the user
- downstream widgets rerun because upstream state changed

### 5. `AppComponent` card submit becomes a flow trigger

The normal submit path in
[`src/widgets/core/app-component/AppComponentWidget.tsx`](../src/widgets/core/app-component/AppComponentWidget.tsx)
will switch from:

- `executeWidgetGraph(instanceId, { reason: "manual-submit" })`

to:

- `executeWidgetFlow(instanceId, { reason: "manual-submit" })`

The settings path in
[`src/widgets/core/app-component/AppComponentWidgetSettings.tsx`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx)
must keep using isolated target execution.

## Why This Split

This is the cleanest way to preserve the current architecture while fixing the user-visible gap.

It keeps:

- one clear meaning for target-graph execution
- one clear meaning for source-driven propagation
- one shared runner for actual node execution
- one shared dependency model for topology and input resolution

It avoids:

- overloading `executeWidgetGraph(...)` with two contradictory semantics
- AppComponent-specific downstream hacks in widget components
- treating settings preview/test as if it were live workspace execution
- forcing passive widgets to become executable just to see source updates

## Flow Semantics

### 1. Linear executable chain

Given:

- `AppComponent A -> AppComponent B -> AppComponent C`
- all three widgets are executable
- `B` and `C` have every required request field satisfied through bindings, defaults, prefills, or
  optional empty inputs

When the user clicks `Submit` on `A`, the runtime does this:

1. execute `A` with reason `manual-submit`
2. rebuild the snapshot from `A`'s updated runtime state
3. schedule downstream executable candidates in order
4. execute `B` with reason `upstream-update`
5. rebuild the snapshot from `B`'s updated runtime state
6. execute `C` with reason `upstream-update`

The visible result is a full chained flow from the source button click without requiring a separate
dashboard refresh.

### 2. Linear chain with a missing required request argument

Given:

- `AppComponent A -> AppComponent B -> AppComponent C`
- `B` has a required request field that is not satisfied by bindings, defaults, or user input

When the user clicks `Submit` on `A`, the runtime does this:

1. execute `A`
2. attempt `B`
3. `B` fails during request build/execution because its required request input is missing
4. `B` clears its published outputs and response snapshot for that failed execution
5. `C` does not execute because the chain is now blocked at `B`

So the execution stops on that branch at the first widget whose required runtime inputs are still
unsatisfied.

Important detail:

- for `AppComponent`, missing required request arguments do not fail topology discovery or
  `canExecute(...)`
- they fail at request-build time inside execution
- that still counts as a branch-local execution stop

### 3. Branching flow with one failing branch

Given:

- `AppComponent A -> AppComponent B`
- `AppComponent A -> AppComponent C`
- `B` is missing a required request field
- `C` is fully satisfiable

When the user clicks `Submit` on `A`, the runtime does this:

1. execute `A`
2. attempt downstream candidates in dependency order
3. `B` fails and stops its own branch
4. `C` can still execute because it is an independent downstream branch of `A`

So downstream propagation is branch-local, not all-or-nothing for the whole workspace.

### 4. Target-graph failure vs flow failure

Each selected downstream target still runs through `executeWidgetGraph(...)`.

That means:

- a failure inside one selected target stops that target graph immediately
- the outer source-driven flow may still consider later downstream candidates
- only candidates whose upstream requirements still resolve from the updated snapshot will run

This is why the runtime can both:

- stop a broken linear chain at the first missing required input
- continue a separate sibling branch that does not depend on the broken target

## Consequences

Positive:

- manual source actions propagate immediately to bound downstream executable widgets
- `AppComponent` behaves like a real flow source instead of a refresh-only source
- source-driven actions and refresh-driven actions stay distinct in traces and reasoning
- the runtime model stays generic for future executable source widgets

Negative:

- the execution provider gains a second public orchestration API
- downstream flow behavior becomes more explicit and therefore more important to document for widget
  authors, especially around branch-local stopping behavior and request-build failures
- downstream target selection adds another graph traversal concept to maintain
- passive freshness invalidation becomes more stateful because execution revisions must be tracked

## Guardrails

- Do not redefine `executeWidgetGraph(...)` to include downstream propagation.
- Do not discover downstream targets only from currently valid resolved inputs.
- Do not let settings test execution propagate into the live workspace graph.
- Do not execute every downstream node when a smaller set of executable leaves is sufficient.
- Do not rely only on topology-based request keys for passive upstream resolution after manual
  source execution.

## Verification

After implementation, the platform should prove these cases:

1. `AppComponent -> executable downstream`
   Manual submit runs the AppComponent and immediately reruns the downstream executable widget.

2. `AppComponent -> passive -> executable`
   Manual submit propagates through the passive hop and reruns the downstream executable leaf.

3. `settings test`
   Test request updates only the isolated target preview and does not mutate the live workspace
   flow.

4. `refresh`
   Dashboard refresh behavior remains unchanged and continues to use the target-graph refresh path.

5. `shared upstream`
   When multiple downstream targets share the same upstream executable widgets, propagation dedupes
   correctly through shared `executedInstanceIds`.
