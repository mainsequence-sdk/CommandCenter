# Lightweight Charts Widgets

This directory contains the optional widget set owned by the `lightweight-charts` extension.

## Files

- `definition.ts`: widget registration metadata for the extension-owned chart widgets.
- `PriceChartWidget.tsx`: realtime price line/area widget backed by the existing market history query and terminal tick stream.

## Notable behavior

- These widgets stay outside the core library so the optional Lightweight Charts dependency remains isolated to this extension.
- The extension now registers `price-chart` while keeping the more mock-specific heatmap widget in
  the external Demo extension.
- The mock-only heatmap widget was moved into `extensions/demo/widgets/heatmap-matrix/` so
  this module now only owns live-capable Lightweight Charts integrations.

## Maintenance notes

- Keep any future settings for these widgets instance-scoped through the shared widget settings modal instead of hardcoding widget-specific controls into dashboard pages.
