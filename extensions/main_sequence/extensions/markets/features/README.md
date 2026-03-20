# Main Sequence Markets Features

Feature folders in this extension should contain market-facing Main Sequence screens and the local UI that belongs to them.

## Current Feature Areas

- `asset-categories/`: migrated asset-category registry, dedicated detail page, and nested assets table.
- `asset-translation-tables/`: translation table registry, dedicated detail page, and embedded rules manager.
- `assets/`: read-only asset registry list with dedicated detail loading.
- `execution-venues/`: execution venue registry with dedicated detail editing and deletion.

## Rules

- Extract reusable Main Sequence building blocks into `extensions/main_sequence/common/` only after they are shared.
- Keep page-level composition and route-specific state in this extension.
