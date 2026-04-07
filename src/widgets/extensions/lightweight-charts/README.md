# Lightweight Charts Widgets

This directory contains the Lightweight Charts-backed widget modules used by the live widget
catalog.

## Files

- `definition.ts`: widget registration metadata for the chart widgets in this module.
- `PriceChartWidget.tsx`: realtime price line/area widget backed by the existing market history query and terminal tick stream.

## Notable behavior

- These widgets stay outside the core library so the optional Lightweight Charts dependency remains isolated here.
- The stable `price-chart` widget id is now classified as `main_sequence_markets` in its widget
  definition, while the renderer implementation remains in this module.
- The mock-only heatmap widget was moved into `extensions/demo/widgets/heatmap-matrix/` so
  this module now only owns live-capable Lightweight Charts integrations.

## Maintenance notes

- Keep any future settings for these widgets instance-scoped through the shared widget settings modal instead of hardcoding widget-specific controls into dashboard pages.
