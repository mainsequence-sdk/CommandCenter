# Portfolio Weights Widget

This folder contains the reusable `Portfolio Weights` widget and the shared table renderer for portfolio weights and position-detail payloads from the Main Sequence Markets target-portfolio endpoints.

## Entry Points

- `PortfolioWeightsTable.tsx`: shared TanStack table renderer used by both the widget and the portfolio detail page.
- `PortfolioWeightsWidget.tsx`: widget-owned data loader that fetches weights for a configured portfolio id.
- `PortfolioWeightsWidgetSettings.tsx`: widget settings form for `portfolioId` and `variant`.
- `definition.ts`: widget registry definition for `Portfolio Weights`.

## Notes

- The page-level portfolio detail flow reuses the same table component so widget and surface rendering stay aligned.
- The reusable widget expects a `portfolioId` prop and can render either the summary weights grid or the detailed positions grid through the `variant` prop. `targetPortfolioId` remains accepted as a compatibility fallback.
- In `summary` mode, the widget treats `weights` as serialized assets: the table shows only `FIGI`, and each row expands into a focused asset inspector showing `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`.
- In `positions` mode, the grid is intentionally narrowed to `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`, and each row expands to reveal the remaining returned fields instead of dumping every backend column into the collapsed table.
- Nested object fields in expanded position rows, such as `Current Snapshot`, are rendered as nested key/value sections rather than raw JSON.
- When `Position Type` is `weight_notional_exposure`, the widget formats `Position Value` as a percentage.
- In `positions` mode, the widget also shows a compact summary strip above the table for total longs, total shorts, and total net exposure.
