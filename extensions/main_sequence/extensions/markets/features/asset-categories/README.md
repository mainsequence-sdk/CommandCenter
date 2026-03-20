# Main Sequence Markets Asset Categories

This feature owns the Main Sequence Markets asset-category registry, dedicated detail page, and create/edit/delete flows.

## Entry Points

- `MainSequenceAssetCategoriesPage.tsx`: URL-driven category list surface with shared registry search, fixed pagination, and create/delete actions.
- `MainSequenceAssetCategoryDetailPage.tsx`: dedicated category detail route with migrated detail loading, nested asset table loading, and edit/delete actions.

## API Dependencies

- `GET /orm/api/assets/asset-category/?response_format=frontend_list` for the default list flow.
- `GET /orm/api/assets/asset-category/{id}/?response_format=frontend_detail` for the detail dialog payload.
- `POST /orm/api/assets/asset-category/` for category creation.
- `PATCH /orm/api/assets/asset-category/{id}/` for category metadata updates.
- `DELETE /orm/api/assets/asset-category/{id}/` for single-category deletion from detail.
- `POST /orm/api/assets/asset-category/bulk-delete/` for row and bulk delete flows.
- `GET /orm/api/assets/asset/?response_format=frontend_list&categories__id={id}&limit={limit}&offset={offset}` for the nested assets table.

## Rules

- Keep list search and pagination URL-backed so category views are refresh-safe and linkable.
- Keep the category list aligned with the shared Main Sequence registry pattern: no category-specific filter row and no page-size picker.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Reuse the shared asset list helper for nested category assets, but scope it from the route category id instead of trusting backend detail metadata to decide the filter.
