# Main Sequence Markets

This nested extension is the separate application shell for market-facing Main Sequence workflows.

## Entry Points

- `index.ts`: registers the Markets extension.
- `app.ts`: declares the `AppDefinition` for `main_sequence_markets`.
- `features/`: Markets surfaces and feature-owned workflows.
- `widget-contracts/`: Markets-scoped data models and adapters shared by market widgets,
  including internal asset snapshot, reference-point, and history-series semantics over generic
  tabular frames.
- `widgets/`: Markets-owned widgets that can also be reused by Markets surfaces, including the live
  `Asset Screener`, `Curve Plot`, `Zero Curve`, `OHLC Bars`, and `Position Detail`.

## Current Surfaces

- `Assets`
- `asset-categories/`: category registry with create/edit/delete flows, a dedicated detail page, and nested asset loading.
- `assets/`: read-only asset registry list with dedicated detail loading.
- `indices/`: index registry with shared list search, embedded detail loading, and single-record delete support.
- `managed-accounts/`: managed-account registry with a dedicated list/detail surface under the `Managed Accounts` navigation section.
- `Platform`
- `catalogue/`: catalogue registry with backend row-listing and row-delete detail flows.
- `Portfolios`
- `funds/`: read-only virtual-fund registry showing linked portfolios and accounts.
- `portfolio-groups/`: portfolio-group registry with bulk delete from the list and a dedicated direct-detail page.
- `portfolios/`: target-portfolio registry with shared list search, fixed pagination, and bulk-delete support.
- `Pricing`
- `pricing-market-data/`: pricing-oriented market data surface reserved for curves, fixings, and inspection workflows.

## Dependencies

- Shared Main Sequence UI, hooks, and API helpers come from `../../common/`.
- Markets backend calls use the shared `/api/v1/...` API helpers. Set
  `VITE_DEBUG_MAIN_SEQUENCE=http://127.0.0.1:8021` in local development when the Markets backend
  root differs from the main Command Center API base.
- Markets-specific widget data models live in `widget-contracts/`; keep asset and price semantics
  scoped there unless another Main Sequence extension also needs the same interpretation layer.
- The live `Curve Plot` and `Zero Curve` widgets currently reuse the existing Workbench
  DataNode-source helpers so they can bind to a `Data Node` widget runtime without introducing a
  second source contract.
- The live `Position Detail` widget definition is classified as `main_sequence_markets` and is the
  registered positions-oriented table widget for Markets surfaces and demos.

## Rules

- Keep this extension independent from Workbench. Shared code must move into `../../common/`.
- Add a local `README.md` whenever you introduce a new feature folder here.
- Markets surfaces in `app.ts` now also own assistant-facing summaries and action lists through
  `assistantContext`; update them when the visible workflow or supported actions change.
- Treat the current Markets widget dependency on the Workbench DataNode-source helpers as
  temporary. If another Markets widget needs that same binding model, extract it into
  `../../common/`.
