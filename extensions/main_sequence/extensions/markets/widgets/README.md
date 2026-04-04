# Markets Widgets

This folder contains widget definitions and widget-owned presentation components for Main Sequence Markets.

## Widgets

- `curve-plot/`: live `Curve Plot` widget that renders yield-curve style datasets from a linked
  Main Sequence `Data Node` widget with mapped maturity/value fields and Lightweight Charts. It is
  now tagged as a workspace runtime `consumer`.
- `zero-curve/`: live `Zero Curve` widget that renders compressed Main Sequence curve payloads on
  a numeric days axis with ECharts. It is now tagged as a workspace runtime `consumer`.
- `portfolio-weights-table/`: reusable `Portfolio Weights` widget plus the shared table renderer used by the portfolio detail flow. The widget now has an execution-owner runtime path, but the module remains on disk and is not currently registered in the live widget catalog.

## Rules

- Keep Markets-specific widgets here, not in `../../common/`.
- Mock-only demo widgets belong in `extensions/demo/widgets/` instead of the live markets
  extension.
- Shared low-level UI primitives belong in `../../common/components/`.
- Add a local `README.md` for each widget folder with entry points and usage notes.
- The current `curve-plot/` widget temporarily reuses the Workbench DataNode-source helpers as a
  maintenance shortcut. If another Markets widget needs the same source contract, move that shared
  layer into `../../common/` instead of duplicating or extending the cross-extension dependency.
