# Portfolios

This feature provides the Main Sequence Markets target-portfolio registry screen.

## Entry Points

- `MainSequenceTargetPortfoliosPage.tsx`: list surface backed by the target portfolio DRF endpoint with shared registry search, fixed-page pagination, URL-backed detail state, and bulk delete.
- `MainSequenceTargetPortfolioDetailView.tsx`: canonical summary-backed detail view loaded from the portfolio summary endpoint, with URL-backed `Detail` and `Weights` tabs.
- `../widgets/portfolio-weights-table/`: Markets-owned `Portfolio Weights` widget and shared renderer used by the `Weights` tab.

## Backend Contract

- `GET /orm/api/assets/target_portfolio/`: list portfolios using `search`, `limit`, `offset`, and `fields=id,creation_date,index_asset`.
- `GET /orm/api/assets/target_portfolio/{id}/summary/`: load the canonical detail header for the selected portfolio.
- `GET /orm/api/assets/target_portfolio/{id}/weights-position-details/`: load the weights and position-detail grids for the `Weights` tab.
- `POST /orm/api/assets/target_portfolio/bulk-delete/`: delete selected rows or all rows matching the current filtered URL.

## Notes

- The list screen derives the displayed portfolio name from `index_asset.current_snapshot.name`.
- The index asset column uses `index_asset.current_snapshot.ticker` and links into the Markets asset detail surface when an asset id is present.
- Portfolio detail state is URL-backed through `msTargetPortfolioId` and `msTargetPortfolioTab` on the portfolios surface.
- The `Detail` tab renders `extra.description`, `extra.signal_name`, `extra.signal_description`, `extra.rebalance_strategy_name`, and `extra.rebalance_strategy_description` when the summary payload returns them.
- The `Weights` tab is backed by `weights-position-details/`. The summary weights table treats `weights` as asset rows, shows only `FIGI`, and expands each row into an asset inspector with `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`. The position details grid is also narrowed to those same five columns even if the backend returns more.
- Portfolio summary fields that carry `{ data_node_update, id }` are normalized into links to the Workbench local-update detail on the `data-nodes` surface.
- Bulk delete sends both `ids` and legacy `selected_items_ids` for compatibility with older backend payload handling.
