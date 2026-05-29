# Main Sequence Markets Features

Feature folders in this extension should contain market-facing Main Sequence screens and the local UI that belongs to them.

## Current Feature Areas

- `asset-categories/`: migrated asset-category registry, dedicated detail page, and nested assets table.
- `assets/`: read-only asset registry list with dedicated detail loading.
- `catalogue/`: catalogue registry with backend row-listing and row-delete detail flows.
- `managed-accounts/`: read-only managed-account registry with dedicated detail pages.
- `funds/`: read-only virtual-fund registry with shared search and pagination.
- `indices/`: index registry with shared list search, embedded detail loading, and delete support.
- `portfolio-groups/`: portfolio-group registry with shared list behavior and a dedicated read-only detail page.
- `portfolios/`: target-portfolio registry with shared list search, offset pagination, and bulk delete.

## Rules

- Extract reusable Main Sequence building blocks into `extensions/main_sequence/common/` only after they are shared.
- Keep page-level composition and route-specific state in this extension.
