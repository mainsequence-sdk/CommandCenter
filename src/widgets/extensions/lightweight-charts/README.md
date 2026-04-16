# Lightweight Charts Widgets

This directory contains the Lightweight Charts-backed widget modules used by the live widget
catalog.

## Files

- `definition.ts`: widget registration metadata for the chart widgets in this module.
- `PriceChartWidget.tsx`: realtime price line/area widget backed by the existing market history query and terminal tick stream.
- `LightweightChartsSpecWidget.tsx`: safe JSON spec-driven Lightweight Charts renderer with
  theme/palette resolution, bound props JSON support, and organization-scoped resource budgets.
- `LightweightChartsSpecWidgetSettings.tsx`: custom settings surface for authoring the declarative
  spec JSON and previewing the effective organization configuration.

## Notable behavior

- These widgets stay outside the core library so the optional Lightweight Charts dependency remains isolated here.
- The stable `price-chart` widget id is now classified as `main_sequence_markets` in its widget
  definition, while the renderer implementation remains in this module.
- `lightweight-charts-spec` is the spec-driven sibling to `echarts-spec`, but it stays aligned to
  Lightweight Charts' time-series-native runtime model instead of trying to mirror the full ECharts
  option surface.
- The spec widget is JSON-only in this first version. Saved content is a declarative chart spec
  with chart options, series, data, markers, and price lines, plus theme tokens and chart palette
  references for color fields.
- The mock-only heatmap widget was moved into `extensions/demo/widgets/heatmap-matrix/` so
  this module now only owns live-capable Lightweight Charts integrations.

## Maintenance notes

- Keep any future settings for these widgets instance-scoped through the shared widget settings modal instead of hardcoding widget-specific controls into dashboard pages.
- Keep theme token and chart palette syntax aligned with `echarts-spec` so upstream JSON-producing
  widgets can target both spec widgets consistently.
