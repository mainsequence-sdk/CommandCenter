# Lightweight Charts Widgets

This directory contains the optional widget set registered by the `lightweight-charts` extension.

## Files

- `definition.ts`: widget registration metadata for the extension-owned chart widgets.
- `PriceChartWidget.tsx`: realtime price line/area widget backed by the existing market history query and terminal tick stream.
- `HeatmapMatrixWidget.tsx`: mocked cross-asset heatmap matrix with a selected-cell drilldown rendered through TradingView Lightweight Charts.
- `mock-data.ts`: deterministic mocked heatmap cell values and drilldown series used by the heatmap widget.

## Notable behavior

- These widgets stay outside the core library so the optional Lightweight Charts dependency remains isolated to this extension.
- `HeatmapMatrixWidget` keeps the matrix itself mocked for now, but still uses Lightweight Charts for the lower drilldown panel so selection changes feel like a chart workflow instead of a static table.
- The heatmap widget writes its selected cell into `runtimeState.selectedCellKey`, so workspace snapshots can round-trip the last inspected cell.

## Maintenance notes

- If the heatmap moves from mock data to backend data later, keep the matrix payload and the drilldown series payload separate so the widget can stay responsive when a user clicks through cells.
- Keep any future settings for these widgets instance-scoped through the shared widget settings modal instead of hardcoding widget-specific controls into dashboard pages.
