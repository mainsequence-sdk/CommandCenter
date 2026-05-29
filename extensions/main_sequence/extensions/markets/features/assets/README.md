# Main Sequence Markets Assets

This feature owns the Main Sequence Markets asset registry screen and the asset detail workflow.

## Entry Points

- `MainSequenceAssetsPage.tsx`: URL-driven asset list surface with shared registry search and click-through navigation into the asset detail state.
- `MainSequenceAssetDetailView.tsx`: URL-selected asset detail screen with a synthesized summary card, tabbed metadata, TradingView, pricing-details sections, and order-field helper flows.

## API Dependencies

- `GET /api/v1/asset/` with `response_format=frontend_list` for the default list flow.
- `GET /api/v1/asset/{uid}/` with `response_format=frontend_detail` for the asset detail screen.
- `GET /api/v1/asset/{uid}/get_pricing_details/` for the pricing-details tab on asset detail.
- `GET /api/v1/asset/{uid}/order-form-fields/?order_type=...` for the order drawer field helper.

## Rules

- Keep screen params URL-backed so filtered asset views are refresh-safe and linkable.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Use namespaced query params such as `msAssetUid` and `msAssetTab` for detail state.
- Asset rows should open the detail view directly from the registry instead of acting as a read-only static table.
- Strip unsupported asset-specific filter params from the URL on load so this screen stays aligned with the rest of Main Sequence.
- Do not issue a collection-level asset summary request unless the Markets backend exposes a supported summary endpoint again.
- Treat order submission as out of scope here; this feature only migrates detail data, the synthesized summary card, the pricing-details tab, and the dynamic order-form helper.
