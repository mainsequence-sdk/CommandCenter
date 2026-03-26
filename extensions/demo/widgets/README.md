# Demo Widgets

This folder owns the widget modules that belong only to the Demo extension.

## Widgets

- `yield-curve-plot/`: mock multi-curve rates plot used by demo dashboards.
- `heatmap-matrix/`: mock cross-asset heatmap with a Lightweight Charts drilldown.

## Maintenance Notes

- Keep widget ids stable when moving implementation details so saved dashboard layouts continue to
  resolve.
- Do not move live-capable chart widgets here; this folder is only for mock-only widget modules.
