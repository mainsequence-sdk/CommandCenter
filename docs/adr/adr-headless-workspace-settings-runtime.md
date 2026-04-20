# ADR: Headless Workspace Widget Settings Runtime

- Status: Accepted
- Date: 2026-04-03
- Related:
  - [Workspace Settings Headless Runtime Investigation](../workspaces/settings-headless-runtime-investigation.md)
  - [Workspace Runtime Performance Remediation](../workspaces/runtime-performance-remediation.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

The widget settings route used to keep the full workspace runtime alive by rendering every widget
component into an invisible offscreen container inside
[`src/features/dashboards/CustomWidgetSettingsPage.tsx`](../src/features/dashboards/CustomWidgetSettingsPage.tsx).

That workaround kept three things available while the user edited one widget:

- dependency resolution
- executable widget graph context
- runtime-derived source outputs from sibling widgets

The investigation showed that the generic settings shell was not the real blocker. The main
problem was the Main Sequence `Data Node` source family:

- passive consumers resolved source context from upstream widget `runtimeState`
- `main-sequence-data-node` materialized that runtime only when its visual component mounted
- settings therefore paid near-full-dashboard cost just to keep source widgets publishing

This was architecturally wrong for two reasons:

1. hidden component mounts were acting as a fake runtime host
2. widget settings performance scaled with all widgets in the workspace, not just the edited one

## Decision

We will keep the widget settings route provider-backed, but we will stop hidden-mounting sibling
widget components.

To make that safe, `main-sequence-data-node` becomes a first-class executable widget:

- the widget now owns `execution` through
  [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/dataNodeFilterExecution.ts`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/dataNodeFilterExecution.ts)
- direct Data Node queries and bound-source transforms now materialize runtime state through the
  shared dashboard execution layer
- execution contexts now carry dashboard time-range state so headless execution still respects the
  active workspace controls even outside the canvas surface

The settings route keeps:

- `DashboardControlsProvider`
- `DashboardWidgetRegistryProvider`
- `DashboardWidgetExecutionProvider`
- `DashboardWidgetDependenciesProvider`

But it no longer renders the full widget tree offscreen.

## Architecture

### 1. Settings runtime stays provider-backed, not component-backed

`CustomWidgetSettingsPage` still uses the shared dashboard providers so settings can resolve:

- controller context
- bindings
- execution state
- upstream requirements

The route no longer uses hidden sibling component mounts as the mechanism that keeps that runtime
alive.

### 2. Data Node publication moves into the execution contract

`main-sequence-data-node` now publishes its canonical dataset bundle through runtime state produced
by `dataNodeFilterExecutionDefinition`.

That execution contract handles both modes:

- direct source queries against Main Sequence APIs
- bound-source transforms that consume an upstream `sourceData` input and republish the transformed
  dataset

This keeps Data Node source publication aligned with the rest of the executable widget graph rather
than inventing a second settings-only runtime mechanism.

### 3. Headless execution receives dashboard control state

The execution context now includes a small dashboard-state payload:

- `timeRangeKey`
- `rangeStartMs`
- `rangeEndMs`
- `refreshIntervalMs`

This is required because Data Node source execution depends on the active dashboard time range when
`dateRangeMode === "dashboard"`.

The shared execution provider and graph runner carry this state into widget executors so settings,
canvas, and refresh flows all evaluate against the same effective dashboard controls.

### 4. Visible preview remains explicit and scoped

If widget settings need a visible preview, that preview must be mounted intentionally for the
edited widget only.

The route must not bring back the old pattern of mounting the whole workspace invisibly just to
make sibling runtime state available.

## Consequences

Positive:

- opening one widget settings page no longer mounts every widget component in the workspace
- Data Node-family settings can resolve upstream sources through the same execution layer as the
  rest of the executable graph
- dashboard time-range semantics stay consistent between canvas and settings
- settings runtime ownership is clearer: providers own runtime, components own visible UI

Negative:

- the execution layer now has one more runtime dependency: dashboard control state
- Data Node source execution logic is more centralized, so changes to its runtime contract must be
  tested against both canvas and settings consumers

## Guardrails

- Do not reintroduce hidden full-workspace component mounts in widget settings.
- New runtime-producing widgets should prefer `WidgetDefinition.execution` over mount-side effects.
- If a widget settings page needs preview behavior, mount only the edited widget or an explicit
  preview surface.
