# Markets Widgets

This folder contains widget definitions and widget-owned presentation components for Main Sequence Markets.

## Widgets

- `yield-curve-plot/`: reusable `Yield Curve Plot` widget that renders mock rates curves with Lightweight Charts and remains registered in the live widget catalog.
- `portfolio-weights-table/`: reusable `Portfolio Weights` widget plus the shared table renderer used by the portfolio detail flow; the module remains on disk but is not currently registered in the live widget catalog.

## Rules

- Keep Markets-specific widgets here, not in `../../common/`.
- Shared low-level UI primitives belong in `../../common/components/`.
- Add a local `README.md` for each widget folder with entry points and usage notes.
