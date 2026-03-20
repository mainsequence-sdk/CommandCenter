# Main Sequence Markets Asset Translation Tables

This feature owns the Main Sequence Markets asset translation table registry, the dedicated detail page, and the embedded rules manager.

## Entry Points

- `MainSequenceAssetTranslationTablesPage.tsx`: URL-driven translation table list with search, create, row navigation, and bulk delete.
- `MainSequenceAssetTranslationTableDetailPage.tsx`: dedicated translation table detail route with rename/delete actions and the embedded rules manager.
- `assetTranslationTableShared.tsx`: local path helpers, form dialogs, value formatting, and delete summary builders used by both screens.

## API Dependencies

- `GET /orm/api/assets/asset-translation-tables/?response_format=frontend_list` for the default list flow.
- `POST /orm/api/assets/asset-translation-tables/query/` for optional POST-based list querying.
- `POST /orm/api/assets/asset-translation-tables/` for table creation.
- `POST /orm/api/assets/asset-translation-tables/bulk-delete/` for selected-row and filtered delete flows.
- `GET /orm/api/assets/asset-translation-tables/{id}/?response_format=frontend_detail` for the detail payload.
- `PATCH /orm/api/assets/asset-translation-tables/{id}/` for rename.
- `DELETE /orm/api/assets/asset-translation-tables/{id}/` for table deletion.
- `GET /orm/api/assets/asset-translation-tables/{id}/rules/?response_format=frontend_list` for the embedded rules list.
- `POST /orm/api/assets/asset-translation-tables/{id}/rules/` for rule creation.
- `PATCH /orm/api/assets/asset-translation-tables/{id}/rules/{rule_id}/` for rule updates.
- `DELETE /orm/api/assets/asset-translation-tables/{id}/rules/{rule_id}/` for rule deletion.

## Rules

- Keep the top-level list aligned with the shared Main Sequence registry pattern: shared search, fixed pagination, and no page-size picker.
- Keep the rules manager embedded on the detail page; do not split it into a separate app surface.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
