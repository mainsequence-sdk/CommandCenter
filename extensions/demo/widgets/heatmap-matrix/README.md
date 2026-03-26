# Demo Heatmap Matrix

This folder owns the mock-only `heatmap-matrix-chart` widget used by the Demo extension.

## Entry Points

- `definition.ts`: registry definition for the stable heatmap widget id.
- `HeatmapMatrixWidget.tsx`: interactive heatmap plus drilldown chart renderer.
- `mock-data.ts`: deterministic heatmap scores and drilldown time series.

## Maintenance Notes

- Keep this widget under the Demo extension while it is backed entirely by deterministic mock data.
- The widget writes `selectedCellKey` into widget runtime state so saved layouts can restore the
  last inspected cell.
