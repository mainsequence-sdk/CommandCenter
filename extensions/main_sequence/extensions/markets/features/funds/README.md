# Main Sequence Markets Funds

This feature owns the Main Sequence Markets funds registry screen.

## Entry Points

- `MainSequenceFundsPage.tsx`: virtual-fund registry and detail surface with shared search,
  pagination, summary, detail fields, and holdings.
- `fundShared.ts`: route helpers for the virtual-fund list and query-param-backed detail view.

## Dependencies

- `../../../../common/api/`: shared Main Sequence request helpers and pagination normalization.
- `../../../../common/components/`: shared registry search, pagination, and table styling.

## Backend Contract

- `GET /api/v1/virtualfund/?response_format=frontend_list` for the reduced list used by the
  Markets screen. List rows are UID-only and should only rely on:
  - `uid`
  - `unique_identifier`
  - `account_uid`
  - `target_portfolio_uid`
- List filters supported by the page/API helper are `search`, `account_uid`, `portfolio_uid`,
  `limit`, and `offset`.
- Detail reads use the backend handoff directly:
  - `GET /api/v1/virtualfund/<fund_uid>/`
  - `GET /api/v1/virtualfund/<fund_uid>/summary/`
  - `GET /api/v1/virtualfund/<fund_uid>/holdings/?order=desc&limit=1&include_asset_detail=true`
- Virtual funds are account-owned allocation views. They are not assets, accounts, or portfolios;
  do not infer display labels from removed account or portfolio name fields.
- UID-based virtual-fund write helpers remain available in the shared API layer for:
  - `POST /api/v1/virtualfund/`
  - `PATCH /api/v1/virtualfund/<fund_uid>/`

## Notes

- The registry places the fund first, followed by account UID, portfolio UID, and an explicit
  Details action. The detail view uses the shared summary card and the shared Position Detail
  widget for holdings, without adding extra summary rows not provided by the backend.
