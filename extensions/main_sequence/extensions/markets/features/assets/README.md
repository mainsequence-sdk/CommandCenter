# Main Sequence Markets Assets

This feature owns the Main Sequence Markets asset registry screen and the asset detail workflow.

## Entry Points

- `MainSequenceAssetsPage.tsx`: URL-driven asset list surface with shared registry search and click-through navigation into the asset detail state.
- `MainSequenceAssetDetailView.tsx`: URL-selected asset detail screen with the backend summary card, canonical detail tab, and pricing-details tab.
- `MainSequenceAssetRegistryTable.tsx`: shared asset list table used by the Master List and nested asset-category asset lists.

## API Dependencies

- `GET /api/v1/asset/` with `response_format=frontend_list` for the default list flow.
- `GET /api/v1/asset/{uid}/` with `response_format=frontend_detail` for the asset detail screen.
- `GET /api/v1/asset/{uid}/summary/` for the reusable detail summary card.
- `GET /api/v1/asset/{uid}/get_pricing_details/` for the pricing-details tab on asset detail.

## Rules

- Keep screen params URL-backed so filtered asset views are refresh-safe and linkable.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Use namespaced query params such as `msAssetUid` and `msAssetTab` for detail state.
- Asset rows should open the detail view directly from the registry and keep a visible details affordance in the list.
- Keep category nested asset rows on `MainSequenceAssetRegistryTable` so they stay visually aligned with Master List rows.
- Strip unsupported asset-specific filter params from the URL on load so this screen stays aligned with the rest of Main Sequence.
- Render the detail header from `GET /api/v1/asset/{uid}/summary/` through `MainSequenceEntitySummaryCard`.
- Treat order submission, TradingView actions, and order-form helpers as out of scope until the asset detail contract exposes active data for those surfaces again.
