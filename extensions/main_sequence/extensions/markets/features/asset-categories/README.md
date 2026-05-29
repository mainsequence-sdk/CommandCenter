# Main Sequence Markets Asset Categories

This feature owns the Main Sequence Markets asset-category registry, dedicated detail page, and create/edit/delete flows.

## Entry Points

- `MainSequenceAssetCategoriesPage.tsx`: URL-driven category list surface with shared registry search, fixed pagination, and create/delete actions.
- `MainSequenceAssetCategoryDetailPage.tsx`: dedicated category detail route with migrated detail loading, nested asset table loading, and edit/delete actions.

## API Dependencies

- `GET /api/v1/asset-category/?response_format=frontend_list&search=&limit=&offset=` for the default list flow. Rows are uid-only and include `uid`, `unique_identifier`, `display_name`, `description`, and `number_of_assets`; no numeric `id` is expected.
- `GET /api/v1/asset-category/{uid}/?response_format=frontend_detail` for the detail payload. The response is uid-only, includes `selected_category.uid`, `details` for display name, identifier, description, and asset count, plus backend-provided `actions` and `assets_list`.
- `POST /api/v1/asset-category/` for category creation with `display_name`, `description`, `unique_identifier`, and `assets`; the response returns `uid`, metadata fields, and `assets`.
- `PATCH /api/v1/asset-category/{uid}/` for category metadata updates with `display_name`, `description`, and optionally `assets` when replacing membership; the response returns `uid`, metadata fields, and `assets`.
- `DELETE /api/v1/asset-category/{uid}/` for single-category deletion from detail and returns `null`.
- `POST /api/v1/asset-category/bulk-delete/` for row and bulk delete flows. The request supports `uids`, `select_all`, `current_url`, `search`, display-name, identifier, description filters, and `organization_owner__uid`; the response returns `detail` and `deleted_count`, while errors use `{ detail }`.
- `GET /api/v1/asset/?response_format=frontend_list&categories__uid={uid}` for the nested assets table, with standard list pagination as needed.

## Rules

- Keep list search and pagination URL-backed so category views are refresh-safe and linkable.
- Keep the category list aligned with the shared Main Sequence registry pattern: no category-specific filter row and no page-size picker.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Reuse the shared asset list helper for nested category assets, but scope it from the route category uid instead of trusting backend detail metadata to decide the filter.
