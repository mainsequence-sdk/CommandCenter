# Markets Widgets

This folder contains widget definitions and widget-owned presentation components for Main Sequence Markets.

## Widgets

- [`curve-plot/`](./curve-plot/README.md): live `Curve Plot` widget that renders yield-curve style datasets from a linked
  Main Sequence `Data Node` widget with mapped maturity/value fields and Lightweight Charts. It is
  now tagged as a workspace runtime `consumer`.
- [`zero-curve/`](./zero-curve/README.md): live `Zero Curve` widget that renders compressed Main Sequence curve payloads on
  a numeric days axis with ECharts. It is now tagged as a workspace runtime `consumer`.
- [`price-chart`](../../../../../src/widgets/extensions/lightweight-charts/README.md): the stable `price-chart` widget id is classified as `main_sequence_markets`, even
  though its Lightweight Charts renderer implementation still lives in
  `src/widgets/extensions/lightweight-charts/`.
- [`positions-table`](../../../../../src/widgets/extensions/ag-grid/README.md): the stable `positions-table` widget id is classified as
  `main_sequence_markets`, even though its AG Grid renderer implementation still lives in
  `src/widgets/extensions/ag-grid/`.
- [`portfolio-weights-table/`](./portfolio-weights-table/README.md): reusable `Portfolio Weights` widget plus the shared table renderer used by the portfolio detail flow. The widget now has an execution-owner runtime path, but the module remains on disk and is not currently registered in the live widget catalog.

## Browser Grouping

- `Curve Plot`, `Zero Curve`, `Price Chart`, `Positions Table`, and `Portfolio Weights` should all
  appear under the `Main Sequence Markets` widget-browser category.

## Rules

- Keep Markets-specific widgets here, not in `../../common/`.
- Mock-only demo widgets belong in `extensions/demo/widgets/` instead of the live markets
  extension.
- Shared low-level UI primitives belong in `../../common/components/`.
- Add a local `README.md` for each widget folder with entry points and usage notes.
- Add a local `DESCRIPTION.md` for each widget type and import it into `definition.ts`; the resolved
  description string is part of the backend widget-type sync payload.
- Every registered widget definition in this folder now publishes `widgetVersion` plus an explicit
  backend-facing `registryContract` so the widget registry can describe consumer vs execution-owner
  behavior, configuration surface, and agent authoring guidance consistently.
- Widget authors must bump `widgetVersion` when a Markets widget's configuration semantics,
  accepted upstream contract, or runtime behavior changes materially.
- The current `curve-plot/` widget temporarily reuses the Workbench DataNode-source helpers as a
  maintenance shortcut. If another Markets widget needs the same source contract, move that shared
  layer into `../../common/` instead of duplicating or extending the cross-extension dependency.
