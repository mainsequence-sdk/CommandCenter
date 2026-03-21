# Main Sequence Markets Funds

This feature owns the Main Sequence Markets funds registry screen.

## Entry Points

- `MainSequenceFundsPage.tsx`: read-only virtual-fund registry with shared search and pagination.

## Dependencies

- `../../../../common/api/`: shared Main Sequence request helpers and pagination normalization.
- `../../../../common/components/`: shared registry search, pagination, and table styling.

## Backend Contract

- `GET /orm/api/assets/virtualfund/?response_format=frontend_list` for the reduced list used by the
  Markets screen.

## Notes

- The page is intentionally read-only until a dedicated React detail flow exists for funds.
