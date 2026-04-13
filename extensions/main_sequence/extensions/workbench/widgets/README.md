# Main Sequence Widgets

This folder contains Main Sequence workbench widget modules. The workbench extension currently
registers the Dependency Graph, the Project Infrastructure Graph, and the Main Sequence Data Node
widget family in the live widget catalog.

## Rules

- Each widget must follow the platform `WidgetDefinition` contract when it is re-enabled from `extensions/main_sequence/extensions/workbench/index.ts`.
- Main Sequence widget definitions now inherit the shared platform default widget size. If a
  Main Sequence route needs a larger or smaller presentation, override that at the app/route
  surface instead of baking a route-specific size into the reusable widget definition.
- Each widget folder should document both the reusable widget definition and the expected instance-level configuration model.
- Main Sequence apps may mount preconfigured widget instances, while dashboard/workspace builders may expose instance settings for the same widget definition.
- Current widget folders include `dependency-graph/` for mixed update dependency-graph rendering,
  `project-infra-graph/` for project-scoped infrastructure graph exploration in the project detail
  shell and reusable workspace widget,
  `data-node-visualizer/` for the data-node graph widget, `data-node-filter/` for the lightweight
  source-and-transform Data Node widget, `data-node-statistic/` for the statistic/KPI consumer
  widget, `data-node-table/` for the data-node table widget, and `data-node-shared/` for reusable
  picker/date-range primitives plus the shared published-dataset contract reused by those widgets.
- Treat `data-node-filter/`, `data-node-visualizer/`, `data-node-statistic/`, `data-node-table/`,
  and the shared `data-node-shared/` contract bundle as the Main Sequence Data Node family.
  `dependency-graph/` and `project-infra-graph/` are separate infrastructure widgets and should
  not be bucketed into the Data Node family just because they can inspect Data Node-related
  backend objects.
- In the workspace component browser, the Data Node family should appear under
  `Main Sequence Data Nodes`, while both `dependency-graph/` and `project-infra-graph/` should
  appear under `Main Sequence Infrastructure`.
- Main Sequence data-node consumers now adapt the platform-level generic tabular-frame contract
  (`core.tabular_frame@v1`) rather than inventing a widget-local table payload. Keep source-specific
  metadata under `source.context` and keep reusable field metadata normalized as `fields[]` with
  `type` plus optional `roles[]`.
- Shared contract ids and contract payload types that cross widget boundaries now live one level up
  in `../widget-contracts/`. Widget folders should consume those contracts instead of inventing
  local ad hoc runtime shapes for composition.
- `dependency-graph/`, `project-infra-graph/`, `data-node-visualizer/`, `data-node-filter/`,
  `data-node-statistic/`, and `data-node-table/` are currently registered in the app-wide widget
  catalog from `extensions/main_sequence/extensions/workbench/index.ts`.
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so platform-admin registry sync can describe configuration,
  runtime behavior, IO semantics, capabilities, and agent authoring guidance without scraping the
  React settings UI.
- Widget authors must bump `widgetVersion` when a widget's authoring semantics, runtime behavior,
  supported modes, or machine-readable contract changes materially.
- Keep reusable widget logic close to the widget folder, and reuse `extensions/main_sequence/common/` building blocks when the rendering contract stays clean.
- Add a `README.md` for each widget subfolder.
