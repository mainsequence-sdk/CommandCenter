# Main Sequence Markets Asset Categories

This feature owns the Main Sequence Markets asset-category registry, dedicated detail page, and create/edit/delete flows.

## Entry Points

- `MainSequenceAssetCategoriesPage.tsx`: URL-driven category list surface with shared registry search, fixed pagination, and create/delete actions.
- `MainSequenceAssetCategoryDetailPage.tsx`: dedicated category detail route with migrated detail loading, nested asset table loading, and edit/delete actions.

## API Dependencies

- `GET /api/v1/asset-category/?response_format=frontend_list` for the default list flow.
- `GET /api/v1/asset-category/{uid}/?response_format=frontend_detail` for the detail dialog payload.
- `POST /api/v1/asset-category/` for category creation.
- `PATCH /api/v1/asset-category/{uid}/` for category metadata updates.
- `DELETE /api/v1/asset-category/{uid}/` for single-category deletion from detail.
- `POST /api/v1/asset-category/bulk-delete/` for row and bulk delete flows.
- `GET /api/v1/asset/?response_format=frontend_list&categories__uid={uid}&limit={limit}&offset={offset}` for the nested assets table.

## Rules

- Keep list search and pagination URL-backed so category views are refresh-safe and linkable.
- Keep the category list aligned with the shared Main Sequence registry pattern: no category-specific filter row and no page-size picker.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Reuse the shared asset list helper for nested category assets, but scope it from the route category uid instead of trusting backend detail metadata to decide the filter.
