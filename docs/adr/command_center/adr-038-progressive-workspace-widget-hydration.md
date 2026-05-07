# ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration

- Status: Proposed
- Date: 2026-04-28
- Related:
  - [ADR 039: Unified Upstream Consumer State Contract](./adr-039-unified-upstream-consumer-state-contract.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)
  - [ADR: Single Runtime Owner for Workspace Widgets](./adr-single-runtime-owner-workspace-widgets.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)
  - [Workspace Runtime Performance Remediation](../../workspaces/runtime-performance-remediation.md)

## Context

Workspace entry currently treats first-load execution as a page-level readiness gate.

This ADR depends on the mounted consumer-state standardization described in `ADR 039`.

That prerequisite is now implemented and accepted. The remaining work in this ADR is the workspace
execution-provider and shell-loading rollout that builds on top of that shared consumer-state
contract.

Today:

- the dashboard layout can be resolved immediately from the saved workspace document
- widget runtime execution starts in the shared dashboard execution provider
- but the execution provider withholds all workspace children until the initial refresh cycle
  settles
- many widgets already implement local loading or placeholder states once they are mounted

That creates a weak first-load experience:

1. the user enters a workspace and sees delayed or blank content instead of the real layout
2. the page communicates "nothing exists yet" even though widget positions and titles are already
   known
3. first meaningful paint is coupled to the slowest initial widget graph instead of the visible
   canvas shell

The obvious fix is to mount the workspace immediately and let widgets resolve independently. That
is directionally correct, but there is a real architectural hazard:

- passive consumer widgets such as graph, table, and statistic already call the shared
  upstream-resolution hook when their source is not ready
- the initial dashboard refresh cycle also executes refreshable widget graphs on first load
- if both paths are allowed to own first-load execution at the same time, the same upstream graph
  can execute twice with different request reasons and different dedupe keys

So the problem is not only presentation. It is a coordination problem between:

- workspace-level initial refresh
- per-widget upstream resolution
- widget-shell loading presentation

## Decision

Workspace runtime surfaces will use progressive initial rendering.

This means:

- the workspace canvas layout renders immediately on entry
- widget shells mount immediately in their final positions
- initial data execution continues in the background
- each widget communicates its own pending state while its runtime data resolves
- the shared execution provider remains the owner of first-load execution
- passive consumer widgets must not trigger duplicate upstream execution while the initial
  hydration cycle is active

We will stop using initial dashboard refresh as a page-level render gate.

## Architecture

### 1. Render the workspace shell immediately

`DashboardWidgetExecutionProvider` must stop withholding children during initial refresh.

The workspace surface should always mount:

- dashboard controls
- workspace grid layout
- widget frames
- hidden managed runtime mounts
- widget components

This preserves layout continuity and lets the user see what is loading.

### 2. Treat initial refresh as background hydration

The existing initial refresh cycle remains valid, but its role changes:

- it is no longer a visibility gate
- it becomes the canonical first-load hydration pass
- it still owns refresh-cycle tracing and execution state for refreshable targets

The provider should expose an explicit runtime flag such as `initialHydrationActive` so mounted
consumers can distinguish:

- "workspace is mounted but hydration is still running"
- "normal post-hydration runtime behavior"

### 3. Prevent duplicate upstream execution during hydration

Mounted passive consumers may still need upstream resolution after hydration, but they must not
race the initial hydration cycle.

Rule:

- while `initialHydrationActive` is true, `useResolveWidgetUpstream(...)` must not schedule a
  duplicate first-load execution for the same dependency path

This keeps first-load ownership coherent:

- initial workspace hydration owns first-load execution
- passive consumers render pending UI from mounted state
- passive consumers can resume normal upstream-resolution behavior after hydration completes

### 4. Move loading communication to the widget shell

The workspace should communicate progress per tile rather than by withholding the page.

Shared shell behavior should include:

- a subtle animated loading treatment at the widget-frame level while execution is running or the
  runtime state is loading
- optional header-level progress affordance for widgets that show standard chrome
- no special-case loading layout per widget family when a generic shell signal is enough

Widget-local loading UI still matters for content-specific states such as:

- missing source
- awaiting upstream source value
- invalid query configuration
- empty result set
- execution error

The shared shell should communicate "this tile is still resolving." Widget content should
communicate "what kind of unresolved state this tile is in."

### 5. Preserve the single-runtime-owner model

This ADR does not reopen runtime ownership.

Execution-owner widgets still own canonical runtime requests. Consumer widgets still render shared
runtime outputs rather than becoming a second request owner.

Progressive mounting must not reintroduce:

- component-owned canonical fetches
- hidden duplicate runtime owners
- per-widget execution orchestration outside the shared provider

### 6. Keep refresh tracing aligned with the new UX

The existing refresh trace line and request-debug surfaces remain valid.

What changes is the user-facing interpretation:

- page visible does not mean hydration complete
- hydration complete does not require a page transition
- request traces should show active first-load execution while the layout is already visible

This is a better match for how the runtime actually works.

## Consequences

Positive:

- users see the actual workspace structure immediately
- slow widgets no longer block fast widgets from appearing
- local widget loading states finally become visible during first load instead of being hidden by a
  page-level gate
- first-load execution ownership stays centralized in the shared execution layer

Negative:

- execution coordination becomes slightly more explicit because hydration state must be exposed
- a small set of source-owner or local-query widgets needed explicit pending-state polish during
  rollout so mounted first-load states did not read like empty, invalid, or broken outcomes
- request dedupe rules must stay coherent across refresh-owned and component-requested execution

## Widget Audit

This ADR includes a full widget audit against the progressive-mount requirement.

### Already compliant or low risk

These widgets already distinguish first-load pending from real error or empty states well enough for
progressive mounting:

- `src/widgets/core/graph/GraphWidget.tsx`
- `src/widgets/core/statistic/StatisticWidget.tsx`
- `src/widgets/core/debug-stream/DebugStreamWidget.tsx`
- `src/widgets/core/table/TableWidget.tsx`
- `src/widgets/core/tabular-transform/TabularTransformWidget.tsx`
- `src/widgets/core/workspace-row/WorkspaceRowWidget.tsx`
- `src/widgets/core/markdown-note/MarkdownNoteWidget.tsx`
- `src/widgets/core/rich-text-note/RichTextNoteWidget.tsx`
- `src/widgets/extensions/echarts/EChartsSpecWidget.tsx`
- `src/widgets/extensions/lightweight-charts/LightweightChartsSpecWidget.tsx`
- `extensions/main_sequence_ai/widgets/workspace/WorkspaceWidget.tsx`
- `extensions/main_sequence_ai/widgets/agent-terminal/AgentTerminalWidget.tsx`
- `extensions/main_sequence_ai/widgets/upstream-inspector/UpstreamInspectorWidget.tsx`
- `extensions/main_sequence/extensions/markets/widgets/curve-plot/CurvePlotWidget.tsx`
- `extensions/main_sequence/extensions/markets/widgets/ohlc-bars/OhlcBarsWidget.tsx`
- `extensions/main_sequence/extensions/markets/widgets/zero-curve/ZeroCurveWidget.tsx`
- `extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table/PortfolioWeightsWidget.tsx`
- `extensions/main_sequence/extensions/workbench/widgets/dependency-graph/MainSequenceDependencyGraphWidget.tsx`
- `extensions/main_sequence/extensions/workbench/widgets/project-infra-graph/MainSequenceProjectInfraGraphWidget.tsx`
- `extensions/demo/widgets/heatmap-matrix/HeatmapMatrixWidget.tsx`
- `extensions/demo/widgets/yield-curve-plot/YieldCurvePlotWidget.tsx`

### Widgets updated during rollout

These widgets required first-load state fixes as part of the rollout:

- `src/widgets/core/connection-query/ConnectionQueryWidget.tsx`
  - `idle` now renders as a first-load waiting state instead of `0 rows / 0 columns`.
- `src/widgets/core/app-component/AppComponentWidget.tsx`
  - live OpenAPI discovery now has dedicated loading and failure states before the terminal
    `Request form not compiled` fallback.
- `src/widgets/extensions/ag-grid/PositionsTableWidget.tsx`
  - the local query path now distinguishes first fetch loading, query error, and completed empty
    results before the grid mounts.

No remaining widget-specific blockers are known from the implementation pass. The remaining open
items for this ADR are runtime verification of hidden managed mounts and request-trace behavior.

## Widget Fixes

The following widget-specific fixes were required so progressive workspace mounting could ship
without misleading first-load UI.

### Connection Query Widget

- [x] Add an explicit first-mount pending state for `idle`.
- [x] Do not render `0 rows / 0 columns` until the widget has actually executed at least once.
- [x] Reserve the current metrics-card presentation for `ready` data or a true completed empty
      response.

### App Component Widget

- [x] Add an explicit discovery-loading state while the OpenAPI document query is still in flight.
- [x] Do not render `Request form not compiled` while live discovery is still pending.
- [x] Keep `Request form not compiled` reserved for the real failure case: no persisted compiled
      form and no usable runtime discovery result.

### Positions Table Widget

- [x] Add an explicit loading state for the first `useQuery(...)` fetch.
- [x] Do not render an empty grid before the first query settles.
- [x] Distinguish clearly between `loading`, `query error`, and `loaded with zero rows`.

## Backend And Storage Impact

This ADR is frontend-only.

It does not change:

- persisted workspace storage shape
- widget props shape
- widget binding shape
- widget runtime-state contract
- backend widget registry contract

## Guardrails

- Do not reintroduce a page-level `null` render gate for initial workspace refresh.
- Do not let passive consumer widgets and initial hydration execute the same upstream graph in
  parallel on first load.
- Do not collapse loading, empty, and misconfigured states into one generic placeholder.
- Do not add per-widget-family first-load orchestration when the shared execution provider should
  own it.
- Do not use progressive mounting as an excuse to create new component-owned canonical fetch paths.

## Implementation Checklist

- [x] Land `ADR 039` shared upstream-consumer state contract before progressive hydration rollout for
      consumer widgets.
- [x] Remove the initial child-render gate from `DashboardWidgetExecutionProvider`.
- [x] Expose `initialHydrationActive` or an equivalent first-load execution flag from the shared
      execution context.
- [x] Update `useResolveWidgetUpstream(...)` so passive consumers do not schedule duplicate
      first-load execution while initial hydration is active.
- [x] Add shared widget-frame loading presentation driven by execution state and runtime loading
      state.
- [x] Keep widget-local content states intact for source-missing, awaiting-upstream, empty,
      invalid-config, and error cases.
- [x] Update `ConnectionQueryWidget` so `idle` is presented as first-load hydration, not `0 rows /
      0 columns`.
- [x] Update `TabularTransformWidget` so `idle` is presented as first-load hydration, not a
      quasi-empty completed transform.
- [x] Update `TableWidget` so unresolved first-load source hydration does not render `Source dataset
      is invalid`.
- [x] Update `AppComponentWidget` so OpenAPI discovery loading does not render `Request form not
      compiled`.
- [x] Update `PositionsTableWidget` so the first query fetch presents a loading state instead of an
      empty grid.
- [ ] Verify hidden managed runtime mounts still participate in execution without becoming a second
      runtime owner.
- [ ] Run the workspace request debugger against a representative bound workspace and confirm that
      first-load execution is not duplicated.
- [x] Update the nearest implementation README files so the runtime behavior change is documented
      before the ADR moves from `Proposed` to `Accepted`.
