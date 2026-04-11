# Main Sequence Markets

This nested extension is the separate application shell for market-facing Main Sequence workflows.

## Entry Points

- `index.ts`: registers the Markets extension.
- `app.ts`: declares the `AppDefinition` for `main_sequence_markets`.
- `features/`: Markets surfaces and feature-owned workflows.
- `widgets/`: Markets-owned widgets that can also be reused by Markets surfaces, including the live
  `Curve Plot`, `Zero Curve`, `Price Chart`, `Positions Table`, and the reusable `Portfolio Weights`
  table module.

## Current Surfaces

- `Assets`
- `asset-categories/`: category registry with create/edit/delete flows, a dedicated detail page, and nested asset loading.
- `assets/`: read-only asset registry list with dedicated detail loading.
- `Portfolios`
- `funds/`: read-only virtual-fund registry showing linked portfolios and accounts.
- `portfolio-groups/`: portfolio-group registry with bulk delete from the list and a dedicated direct-detail page.
- `portfolios/`: target-portfolio registry with shared list search, fixed pagination, and bulk-delete support.
- `Settings`
- `asset-translation-tables/`: translation table registry with a dedicated detail page and embedded rules manager.
- `instruments/`: quick editor for the org-scoped instrument storage-node configuration.
- `execution-venues/`: execution venue registry with create flow and a dedicated detail page for edit/delete.

## Dependencies

- Shared Main Sequence UI, hooks, and API helpers come from `../../common/`.
- The live `Curve Plot` and `Zero Curve` widgets currently reuse the existing Workbench
  DataNode-source helpers so they can bind to a `Data Node` widget runtime without introducing a
  second source contract.
- The live `Price Chart` and `Positions Table` widget definitions are also classified as
  `main_sequence_markets`, but their low-level renderer implementations still live under
  `src/widgets/extensions/` to keep vendor chart/table dependencies isolated from the Main Sequence
  extension tree.

## Rules

- Keep this extension independent from Workbench. Shared code must move into `../../common/`.
- Add a local `README.md` whenever you introduce a new feature folder here.
- Markets surfaces in `app.ts` now also own assistant-facing summaries and action lists through
  `assistantContext`; update them when the visible workflow or supported actions change.
- Treat the current Markets widget dependency on the Workbench DataNode-source helpers as
  temporary. If another Markets widget needs that same binding model, extract it into
  `../../common/`.
