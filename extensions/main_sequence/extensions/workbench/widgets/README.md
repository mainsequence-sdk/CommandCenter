# Main Sequence Widgets

This folder contains Main Sequence workbench widget modules. The workbench extension currently
registers the Dependency Graph and the Project Infrastructure Graph in the live widget catalog.
Generic workspace source, transform, table, graph, and statistic behavior now belongs to core
widgets.

## Widget Readmes

- [Dependency Graph](./dependency-graph/README.md)
- [Project Infrastructure Graph](./project-infra-graph/README.md)
- [Data Node Shared Contracts](./data-node-shared/README.md)

## Rules

- Each widget must follow the platform `WidgetDefinition` contract when it is re-enabled from `extensions/main_sequence/extensions/workbench/index.ts`.
- Main Sequence widget definitions now inherit the shared platform default widget size. If a
  Main Sequence route needs a larger or smaller presentation, override that at the app/route
  surface instead of baking a route-specific size into the reusable widget definition.
- Each widget folder should document both the reusable widget definition and the expected instance-level configuration model.
- Main Sequence apps may mount preconfigured widget instances, while dashboard/workspace builders may expose instance settings for the same widget definition.
- Each widget listed above must keep its own local `README.md` current; do not rely on this folder
  index as the only documentation.
- Each registered widget must keep a colocated `USAGE_GUIDANCE.md` as the source of
  `WidgetDefinition.description` and `registryContract.usageGuidance`; those resolved values are what
  backend widget-type sync publishes.
- Current widget folders include `dependency-graph/` for mixed update dependency-graph rendering,
  `project-infra-graph/` for project-scoped infrastructure graph exploration in the project detail
  shell and reusable workspace widget, and `data-node-shared/` for reusable Data Node-specific
  picker/date-range primitives still used by Main Sequence connection and feature surfaces.
- Treat the shared `data-node-shared/` helper bundle as legacy/Data Node-specific support code.
  `dependency-graph/` and `project-infra-graph/` are separate infrastructure widgets and should
  not be bucketed into the Data Node family just because they can inspect Data Node-related
  backend objects.
- In the workspace component browser, both `dependency-graph/` and `project-infra-graph/` should
  appear under `Main Sequence Infrastructure`.
- Main Sequence data-node consumers now adapt the platform-level generic tabular-frame contract
  (`core.tabular_frame@v1`) rather than inventing a widget-local table payload. Keep source-specific
  metadata under `source.context` and keep reusable field metadata normalized as `fields[]` with
  `type` plus optional `roles[]`.
- Shared contract ids and contract payload types that cross widget boundaries now live one level up
  in `../widget-contracts/`. Widget folders should consume those contracts instead of inventing
  local ad hoc runtime shapes for composition.
- `dependency-graph/` and `project-infra-graph/` are currently registered in the app-wide widget
  catalog from `extensions/main_sequence/extensions/workbench/index.ts`. The old
  `main-sequence-data-node` source widget code has been removed; connection-backed source querying
  now belongs to the `mainsequence.data-node` connection plus core presentation widgets.
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so platform-admin registry sync can describe configuration,
  runtime behavior, IO semantics, capabilities, and agent authoring guidance without scraping the
  React settings UI.
- Main Sequence widgets that appear in workspaces may also implement the shared
  `buildAgentSnapshot(...)` hook so the workspace live snapshot archive can include structured
  Data Node and infrastructure-widget state without reverse-engineering those widgets from
  screenshots alone.
- Main Sequence widgets that implement `buildAgentSnapshot(...)` now also publish one synthetic
  `agent-context` output with contract `core.widget-agent-context@v1`. Agent-facing consumers such
  as `Agent Terminal` can bind to that output to reason over what the widget currently shows.
- Widget authors must bump `widgetVersion` when a widget's authoring semantics, runtime behavior,
  supported modes, or machine-readable contract changes materially.
- Keep reusable widget logic close to the widget folder, and reuse `extensions/main_sequence/common/` building blocks when the rendering contract stays clean.
- Add a `README.md` for each widget subfolder.
