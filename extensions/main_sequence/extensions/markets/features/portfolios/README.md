# Portfolios

This feature provides the Main Sequence Markets portfolio registry screen.

## Entry Points

- `MainSequenceTargetPortfoliosPage.tsx`: list surface backed by the portfolio endpoint with shared registry search, fixed-page pagination, URL-backed detail state, and selected-row bulk delete.
- `MainSequenceTargetPortfolioDetailView.tsx`: canonical summary-backed detail view loaded from the portfolio summary endpoint, with URL-backed `Detail`, `Weights`, `Signal Weights`, and `Portfolio Values` tabs plus a confirmed delete action for portfolio weights.
- `../widgets/position-detail/`: Markets-owned `Position Detail` widget and shared renderer used by the `Weights` tab.

## Backend Contract

- `GET /api/v1/portfolio/?response_format=frontend_list`: list portfolios using `search`, `limit`, `offset`, optional calendar filters, and UID-only rows.
- `GET /api/v1/portfolio/{uid}/`: load portfolio detail metadata for the `Detail` tab.
- `GET /api/v1/portfolio/{uid}/summary/`: load the canonical detail header for the selected portfolio.
- `GET /api/v1/portfolio/{uid}/weights/?order=desc&limit=1&include_asset_detail=true`: load the latest weights for the `Weights` tab.
- `GET /api/v1/portfolio/{uid}/signals_weights/`: load signal weights as a `core.tabular_frame@v1` response. The UI requests `order=desc&limit=100`; the endpoint also accepts `start_date` and `end_date`.
- `GET /api/v1/portfolio/{uid}/portfolio_values/`: load portfolio values as a `core.tabular_frame@v1` response. The UI requests `order=desc&limit=100`; the endpoint also accepts `start_date` and `end_date`.
- `DELETE /api/v1/portfolio/{uid}/weights/`: delete portfolio weight rows. The optional `weights_date` query parameter deletes only the exact `PortfolioWeightsStorage.time_index`; when omitted, the backend deletes all weight rows for the portfolio's resolved portfolio index identifier.
- `POST /api/v1/portfolio/bulk-delete/`: delete selected portfolio UIDs. This API surface does not support create, update, or filtered bulk delete.

## Notes

- The list screen derives the displayed portfolio name from `unique_identifier`.
- List rows are UID-only and do not include numeric ids or nested index-asset snapshots.
- Portfolio detail state is URL-backed through `msTargetPortfolioUid` and `msTargetPortfolioTab` on the portfolios surface.
- The `Detail` tab renders the detail metadata description, falling back to `summary.extensions.description`.
- The `Weights` tab is backed by `weights/`. The API layer adapts the latest-weights payload into the shared position-detail table contract and renders the existing `Position Details` table only. Asset labels come from `asset.current_snapshot.{name,ticker}` returned by the portfolio weights endpoint. The portfolio detail delete action intentionally omits `weights_date`, so the backend deletes all rows for the resolved portfolio index identifier.
- The `Signal Weights` and `Portfolio Values` tabs render canonical tabular frame responses with the shared tabular preview table. They accept both already-normalized `{ columns, rows }` frames and Command Center `{ frames: [{ contract, fields }] }` payloads.
- Portfolio summary fields that carry `{ data_node_update, uid }` are normalized into links to the Workbench local-update detail on the `data-nodes` surface.
- Bulk delete sends `uids` only; numeric-ID, `select_all`, and `current_url` delete payloads are not supported for this UID-only contract.
