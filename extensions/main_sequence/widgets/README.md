# Main Sequence Widgets

This folder contains Main Sequence widgets registered with the Command Center widget platform.

## Rules

- Each widget must follow the platform `WidgetDefinition` contract and be registered from `extensions/main_sequence/index.ts`.
- Each widget folder should document both the reusable widget definition and the expected instance-level configuration model.
- Main Sequence apps may mount preconfigured widget instances, while dashboard/workspace builders may expose instance settings for the same widget definition.
- Current widget folders include `dependency-graph/` for LocalTimeSerie graph exploration and `data-node-visualizer/` for Grafana-style table-to-chart/table translation.
- Keep reusable widget logic close to the widget folder, and reuse feature components only when the rendering contract stays clean.
- Add a `README.md` for each widget subfolder.
