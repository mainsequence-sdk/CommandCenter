# Main Sequence Markets Funds

This feature owns the Main Sequence Markets funds registry screen.

## Entry Points

- `MainSequenceFundsPage.tsx`: read-only virtual-fund registry with shared search and pagination.

## Dependencies

- `../../../../common/api/`: shared Main Sequence request helpers and pagination normalization.
- `../../../../common/components/`: shared registry search, pagination, and table styling.

## Backend Contract

- `GET /orm/api/assets/virtualfund/?response_format=frontend_list` for the reduced list used by the
  Markets screen. List rows now carry `uid`, and the React registry treats that as the canonical
  identifier instead of numeric `id`.
- UID-based virtual-fund detail/write helpers are available in the shared API layer for:
  - `GET /orm/api/assets/virtualfund/<fund_uid>/`
  - `POST /orm/api/assets/virtualfund/`
  - `PATCH /orm/api/assets/virtualfund/<fund_uid>/`

## Notes

- The page is intentionally read-only until a dedicated React detail flow exists for funds.
