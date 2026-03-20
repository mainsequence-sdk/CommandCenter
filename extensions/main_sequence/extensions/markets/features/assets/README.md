# Main Sequence Markets Assets

This feature owns the Main Sequence Markets asset registry screen.

## Entry Points

- `MainSequenceAssetsPage.tsx`: URL-driven asset list surface with shared registry search and a read-only registry table.
- `MainSequenceAssetDetailView.tsx`: URL-selected asset detail screen with metadata, TradingView, and order-field helper flows.

## API Dependencies

- `GET /orm/api/assets/asset/` with `response_format=frontend_list` for the default list flow.
- `GET /orm/api/assets/asset/{id}/` with `response_format=frontend_detail` for the asset detail screen.
- `GET /orm/api/assets/asset/{id}/order-form-fields/?order_type=...` for the order drawer field helper.

## Rules

- Keep screen params URL-backed so filtered asset views are refresh-safe and linkable.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Use namespaced query params such as `msAssetId` and `msAssetTab` for detail state.
- Strip unsupported asset-specific filter params from the URL on load so this screen stays aligned with the rest of Main Sequence.
- Treat order submission as out of scope here; this feature only migrates detail data and the dynamic order-form helper.
