# Project Data Sources Feature

This feature contains the Main Sequence project data source registry and editor flows.

## Files

- `MainSequenceProjectDataSourcesPage.tsx`: server-paginated list surface, bulk actions, and detail/create routing.
- `MainSequenceProjectDataSourceEditor.tsx`: create and edit flow for project data source records.
- `MainSequenceProjectDataSourceMetaTableImportDialog.tsx`: dry-run, relation-selection, and confirm flow for importing MetaTables from the selected DynamicTable Data Source through `/orm/api/ts_manager/meta_table/import-from-data-source/`.

## Notes

- Keep project data source editing logic local to this folder unless it is reused by another feature.
- The related physical data-source selector uses the shared `MainSequenceDataSourcePickerField`
  and data-source picker option builders from `common/components`; keep it on that shared path so
  source icons, class labels, status metadata, and search keywords match project create/settings
  selectors.
- The MetaTable import action is detail-only. It always runs a dry-run preview first, preselects every visible relation from that preview, and sends only the user-selected `relation_names` on the confirm import request.
- Preview remains a review step. Per-relation issues stay visible in the preview without turning the whole selection flow into a hard error state.
