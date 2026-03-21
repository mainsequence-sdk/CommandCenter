# Yield Curve Plot Widget

This folder contains the reusable `Yield Curve Plot` widget for Main Sequence Markets.

## Entry Points

- `YieldCurvePlotWidget.tsx`: widget renderer that turns the mock curve deck into a chart-only Lightweight Charts yield-curve plot with time-depth lines rendered as a color gradient from newest to oldest.
- `YieldCurvePlotWidgetSettings.tsx`: typed widget settings for curve family, curve shape, and history mode.
- `mock-data.ts`: deterministic mock curve generator and option metadata for Markets rate curves.
- `definition.ts`: widget registry definition for `Yield Curve Plot`.

## Notes

- The current version is intentionally mock-only so the Markets dashboard layer can adopt the widget before a live rates endpoint exists.
- Lightweight Charts is a time-series library, so the widget maps maturities onto synthetic time points and overrides the x-axis tick labels to show tenor names such as `2Y` and `10Y`.
- The widget body is intentionally chart-only right now. Supporting annotations or bubble overlays later should happen as separate chart-layer additions, not as permanent surrounding chrome.
- The chart now sizes directly to the available widget body and should shrink with dashboard resize handles instead of relying on a hardcoded minimum chart height.
- Historical mode now renders a time-gradient stack using a single market tone, with newer curves more saturated and older curves progressively lighter.
- The settings contract is already typed and instance-scoped, so replacing the mock deck with backend data later should not require changing how dashboards configure the widget.
