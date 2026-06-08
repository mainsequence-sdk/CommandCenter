# Main Sequence Markets Features

Feature folders in this extension should contain market-facing Main Sequence screens and the local UI that belongs to them.

## Current Feature Areas

- `asset-categories/`: migrated asset-category registry, dedicated detail page, and nested assets table.
- `assets/`: read-only asset registry list with summary-backed detail and pricing-details tabs.
- `calendars/`: calendar registry list with summary-backed detail pages and dates, sessions, and events relationship tabs.
- `managed-accounts/`: read-only managed-account registry with dedicated detail pages.
- `funds/`: virtual-fund registry with shared search, pagination, detail navigation, and holdings.
- `indices/`: index registry with shared list search, embedded detail loading, and delete support.
- `portfolio-groups/`: portfolio-group registry with shared list behavior and a dedicated read-only detail page.
- `portfolios/`: portfolio registry with shared list search, offset pagination, and bulk delete.
- `pricing-market-data/`: pricing market-data sets and bindings registry backed by `/api/v1/pricing/market_data/`.

## Rules

- Extract reusable Main Sequence building blocks into `extensions/main_sequence/common/` only after they are shared.
- Keep page-level composition and route-specific state in this extension.
