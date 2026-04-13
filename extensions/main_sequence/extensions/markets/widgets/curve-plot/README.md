# Curve Plot Widget

This folder owns the Markets `Curve Plot` widget. It renders yield-curve style charts with
TradingView Lightweight Charts and reads its dataset from a linked `Data Node` widget already
mounted in the dashboard/workspace.

## Entry Points

- `definition.ts`: registry definition for the stable `main-sequence-curve-plot` widget id.
- `CurvePlotWidget.tsx`: runtime renderer built on `createYieldCurveChart(...)`.
- `curvePlotModel.ts`: widget prop normalization, maturity parsing, and curve-series construction.
- `controller.ts`: schema controller context built on the shared DataNode-source layer.
- `schema.tsx`: generic settings schema for DataNode source selection and curve field mapping.

## Data Contract

- The widget expects rows coming from a linked `Data Node` widget runtime.
- On workspace runtime surfaces it now behaves as a `consumer`: it reads the canonical published dataset and asks the shared execution layer to resolve upstream executable sources when that dataset is not ready yet.
- `maturityField` should contain tenors like `3M`, `2Y`, or numeric maturity values.
- `valueField` should contain the numeric yield/rate values.
- `curveField` is optional and splits the dataset into multiple named curves such as `Current`,
  `1D ago`, or scenario labels.
- Curve values are treated as already-percent values. The widget does not divide by `100` or
  multiply by `100`; it only formats the existing numeric value with a trailing percent sign.

## Maintenance Notes

- This first pass intentionally depends on the existing Workbench DataNode-source helpers under
  `../../../workbench/widgets/data-node-shared/` and the published dataset runtime from the Data
  Node widget. If more Markets widgets need the same source contract, that layer should be
  promoted into `extensions/main_sequence/common/` instead of growing more cross-extension imports.
- The widget uses the official Lightweight Charts yield-curve chart API rather than emulating the
  axis with a time-series chart.
- The compressed Main Sequence `curve` payload contract now belongs to the sibling `zero-curve/`
  widget. This widget should stay focused on generic mapped maturity/value datasets.
- Runtime fetch ownership should stay with upstream execution owners such as `main-sequence-data-node`.
  This widget may derive local chart series from the published rows, but it must not introduce its
  own canonical backend data fetch path on workspace surfaces.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real consumer behavior here: accepted maturity/value
  dataset shape, optional curve grouping, and Lightweight Charts rendering semantics.
- Bump `widgetVersion` when the mapped-field contract, chart behavior, or agent-facing authoring
  guidance changes materially.
