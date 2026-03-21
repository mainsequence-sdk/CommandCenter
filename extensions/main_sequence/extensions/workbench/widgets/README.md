# Main Sequence Widgets

This folder contains Main Sequence workbench widget modules. The workbench extension currently registers the data-node visualizer in the live widget catalog.

## Rules

- Each widget must follow the platform `WidgetDefinition` contract when it is re-enabled from `extensions/main_sequence/extensions/workbench/index.ts`.
- Each widget folder should document both the reusable widget definition and the expected instance-level configuration model.
- Main Sequence apps may mount preconfigured widget instances, while dashboard/workspace builders may expose instance settings for the same widget definition.
- Current widget folders include `dependency-graph/` for LocalTimeSerie graph exploration and `data-node-visualizer/` for Grafana-style table-to-chart preview flows.
- `data-node-visualizer/` is currently registered in the app-wide widget catalog from `extensions/main_sequence/extensions/workbench/index.ts`.
- `dependency-graph/` remains available in the repo but is not currently registered in the app-wide widget catalog.
- Keep reusable widget logic close to the widget folder, and reuse `extensions/main_sequence/common/` building blocks when the rendering contract stays clean.
- Add a `README.md` for each widget subfolder.
