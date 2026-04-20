# Workspace Settings Headless Runtime Investigation

- Status: Investigated, then implemented
- Date: 2026-04-03
- Related:
  - [Workspace Runtime Performance Remediation](./runtime-performance-remediation.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](../adr/adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](../adr/adr-executable-widget-graph-runner.md)
  - [ADR: Headless Workspace Widget Settings Runtime](../adr/adr-headless-workspace-settings-runtime.md)

## Goal

Determine whether the widget settings route can stop hidden-mounting the full workspace, and if
not, identify the exact blockers before we change runtime behavior.

## Historical note

This document records the investigation before the fix landed.

The hidden full-workspace mount described below has since been removed from
[`src/features/dashboards/CustomWidgetSettingsPage.tsx`](../src/features/dashboards/CustomWidgetSettingsPage.tsx),
and `main-sequence-data-node` now publishes headlessly through its execution contract:

- [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/dataNodeFilterExecution.ts`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/dataNodeFilterExecution.ts)
- [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts)

The findings remain important because they explain why the old implementation existed and why the
Data Node source family had to change first.

## Implementation at the time of investigation

The settings route currently mounts the full dashboard provider stack, then also renders every
widget component into an invisible offscreen container:

- [`src/features/dashboards/CustomWidgetSettingsPage.tsx#L324`](../src/features/dashboards/CustomWidgetSettingsPage.tsx#L324)
- [`src/features/dashboards/CustomWidgetSettingsPage.tsx#L335`](../src/features/dashboards/CustomWidgetSettingsPage.tsx#L335)
- [`src/features/dashboards/CustomWidgetSettingsPage.tsx#L364`](../src/features/dashboards/CustomWidgetSettingsPage.tsx#L364)

That means opening settings for one widget still mounts every other widget in the workspace.

Because those are real component mounts, hidden widgets still run:

- hooks
- React Query requests
- controller-driven dependency reads
- runtime-state effects
- execution-state reads

## Verified findings

### 1. Generic settings/controller wiring is already mostly headless-capable

The shared settings shell does not require widget components to be mounted. It resolves controller
context directly from the widget definition through the dependency provider:

- [`src/widgets/shared/widget-schema.ts#L198`](../src/widgets/shared/widget-schema.ts#L198)
- [`src/widgets/shared/widget-settings.tsx#L210`](../src/widgets/shared/widget-settings.tsx#L210)

This means schema visibility, controller-derived field options, and binding-aware settings do not
inherently require the full hidden widget tree.

### 2. Some settings components are already safe without hidden sibling mounts

These settings surfaces are local forms or route-local queries and do not depend on hidden sibling
widget components:

- [`src/widgets/core/markdown-note/MarkdownNoteWidgetSettings.tsx`](../src/widgets/core/markdown-note/MarkdownNoteWidgetSettings.tsx)
- [`src/widgets/core/workspace-row/WorkspaceRowWidgetSettings.tsx`](../src/widgets/core/workspace-row/WorkspaceRowWidgetSettings.tsx)
- [`extensions/demo/widgets/yield-curve-plot/YieldCurvePlotWidgetSettings.tsx`](../extensions/demo/widgets/yield-curve-plot/YieldCurvePlotWidgetSettings.tsx)
- [`extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table/PortfolioWeightsWidgetSettings.tsx`](../extensions/main_sequence/extensions/markets/widgets/portfolio-weights-table/PortfolioWeightsWidgetSettings.tsx)
- [`extensions/main_sequence/extensions/workbench/widgets/dependency-graph/MainSequenceDependencyGraphWidgetSettings.tsx`](../extensions/main_sequence/extensions/workbench/widgets/dependency-graph/MainSequenceDependencyGraphWidgetSettings.tsx)

These can run in a provider-backed settings host without any hidden full-workspace mount.

### 3. AppComponent settings are already much closer to headless-safe

`AppComponent` settings explicitly use the dependency and execution providers:

- [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L165`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L165)
- [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L166`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L166)
- [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L168`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L168)

It also owns its own OpenAPI discovery query in settings:

- [`src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L182`](../src/widgets/core/app-component/AppComponentWidgetSettings.tsx#L182)

And unlike passive data widgets, `AppComponent` has a first-class execution contract:

- [`src/widgets/core/app-component/definition.ts#L45`](../src/widgets/core/app-component/definition.ts#L45)
- [`src/widgets/core/app-component/definition.ts#L46`](../src/widgets/core/app-component/definition.ts#L46)

So AppComponent settings do not appear to need hidden sibling widget mounts as the main runtime
mechanism.

### 4. The main blocker is the Data Node source runtime model

The Data Node source resolution helper still depends on source widget runtime state:

- [`extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx#L466`](../extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx#L466)
- [`extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx#L504`](../extensions/main_sequence/extensions/workbench/widgets/data-node-shared/dataNodeWidgetSource.tsx#L504)

Specifically, it resolves source data from:

- canonical resolved input value, or
- referenced source widget `runtimeState`

That second path matters because the source widget itself is passive.

The `main-sequence-data-node` widget publishes its output from `runtimeState`:

- [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts#L67`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts#L67)
- [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts#L74`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/definition.ts#L74)

But that runtime state is materialized by the real widget component through mounted queries and an
`onRuntimeStateChange(...)` effect:

- query work: [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidget.tsx#L155`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidget.tsx#L155)
- runtime write: [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidget.tsx#L389`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidget.tsx#L389)

This widget has no `execution` contract today. It is not headlessly executable by the dashboard
execution provider.

So the hidden mount is currently acting as a fake runtime host for Data Node source widgets.

### 5. Multiple consumer families inherit the same blocker

The following settings flows depend on the shared Data Node source binding/context helpers and
therefore depend on source runtime being available:

- Data Node filter settings
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidgetSettings.tsx#L200`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidgetSettings.tsx#L200)
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidgetSettings.tsx#L213`](../extensions/main_sequence/extensions/workbench/widgets/data-node-filter/MainSequenceDataNodeFilterWidgetSettings.tsx#L213)
- Data Node visualizer settings
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidgetSettings.tsx#L93`](../extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidgetSettings.tsx#L93)
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidgetSettings.tsx#L103`](../extensions/main_sequence/extensions/workbench/widgets/data-node-visualizer/MainSequenceDataNodeVisualizerWidgetSettings.tsx#L103)
- Data Node statistic settings
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-statistic/StatisticWidgetSettings.tsx#L135`](../extensions/main_sequence/extensions/workbench/widgets/data-node-statistic/StatisticWidgetSettings.tsx#L135)
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-statistic/StatisticWidgetSettings.tsx#L139`](../extensions/main_sequence/extensions/workbench/widgets/data-node-statistic/StatisticWidgetSettings.tsx#L139)
- Data Node table settings
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-table/DataNodeTableWidgetSettings.tsx#L272`](../extensions/main_sequence/extensions/workbench/widgets/data-node-table/DataNodeTableWidgetSettings.tsx#L272)
  - [`extensions/main_sequence/extensions/workbench/widgets/data-node-table/DataNodeTableWidgetSettings.tsx#L276`](../extensions/main_sequence/extensions/workbench/widgets/data-node-table/DataNodeTableWidgetSettings.tsx#L276)

The Markets widgets that use the same controller context also inherit this dependency:

- curve plot controller
  - [`extensions/main_sequence/extensions/markets/widgets/curve-plot/controller.ts#L53`](../extensions/main_sequence/extensions/markets/widgets/curve-plot/controller.ts#L53)
- zero curve controller
  - [`extensions/main_sequence/extensions/markets/widgets/zero-curve/controller.ts#L34`](../extensions/main_sequence/extensions/markets/widgets/zero-curve/controller.ts#L34)

These widgets are not blocked because their settings components are unusually complex. They are
blocked because the shared Data Node source model still expects mounted source widget runtime.

## Investigation matrix

### Safe now with provider-backed settings only

- Markdown Note
- Workspace Row
- Yield Curve Plot demo widget
- Portfolio Weights
- Main Sequence Dependency Graph widget
- shared bindings tab
- generic schema/controller-driven settings shell

### Largely headless-safe already

- AppComponent

Reason:

- has its own execution contract
- queries OpenAPI directly in settings
- reads dependency/execution context directly from providers

### Not safe yet

- Data Node source widget (`main-sequence-data-node`)
- Data Node consumer settings family
- Markets widgets built on `useDataNodeWidgetSourceControllerContext(...)`

Reason:

- source output is derived from `runtimeState`
- runtime state is populated by component mount side effects
- there is no equivalent headless source execution/materialization path

## Conclusion

We should not remove the hidden full-workspace mount first.

The hidden mount is a bad implementation, but the current system still relies on it for one real
architectural reason:

- passive Data Node source widgets are being used as runtime publishers without a headless runtime path

If we remove the hidden mount today, the most likely regressions are:

- stale or missing source datasets in Data Node consumer settings
- broken field-option derivation in Data Node / Curve / Zero Curve settings
- incorrect preview state for widgets that depend on source runtime rows

## Minimal safe direction

The first real runtime change for this area should be:

1. make the Data Node source widget publish its dataset headlessly
2. stop depending on component mount side effects for source runtime materialization
3. only then remove the hidden full-workspace component tree from settings

There are two plausible follow-up designs:

### Option A: Make `main-sequence-data-node` executable

Add a first-class `execution` contract to the Data Node source widget so the execution provider can
materialize and refresh its runtime state without mounting the visual component.

This is the cleaner fit with the current executable widget graph architecture.

### Option B: Add a headless source materializer for passive data widgets

Keep the widget non-executable, but move its runtime publication logic into a provider-level
headless data-source host used by settings.

This may be narrower in scope, but it creates a second runtime mechanism next to the execution
system and is therefore less desirable.

## Recommendation

Treat this investigation as complete and use it to drive the next plan.

The implementation plan for item 4 in the remediation document should start with:

- headless runtime materialization for the Data Node source family
- verification that Data Node consumers no longer depend on mounted sibling widgets
- then removal of the hidden full-workspace mount from the settings route

## Implemented outcome

That recommendation is now the implemented path:

1. `main-sequence-data-node` became an executable widget that materializes direct-query and
   bound-source runtime state headlessly through the shared execution layer.
2. execution contexts now carry dashboard control state so headless Data Node execution still
   respects the active workspace range.
3. `CustomWidgetSettingsPage` keeps the dashboard provider stack but no longer hidden-mounts the
   full workspace component tree.
