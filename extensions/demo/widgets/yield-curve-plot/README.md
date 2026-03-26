# Demo Yield Curve Plot

This folder owns the mock-only `yield-curve-plot` widget used by the Demo extension.

## Entry Points

- `definition.ts`: registry definition for the stable `yield-curve-plot` widget id.
- `YieldCurvePlotWidget.tsx`: Lightweight Charts renderer for the curve comparison view.
- `YieldCurvePlotWidgetSettings.tsx`: instance-scoped settings for market, scenario, and comparison
  mode.
- `mock-data.ts`: deterministic rates curve generator and option metadata.

## Maintenance Notes

- Keep this widget under the Demo extension until it has a real backend data source.
- The widget id stays stable so existing saved layouts can continue to resolve after the ownership
  move.
