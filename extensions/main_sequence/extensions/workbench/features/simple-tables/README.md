# Meta Tables Feature

This feature owns the Main Sequence Foundry registry screen for `ts_manager/meta_table/`.
The directory name is still `simple-tables` only because older local imports used that path.

## Entry Points

- `MainSequenceSimpleTablesPage.tsx`: exports `MainSequenceMetaTablesPage`, the paginated registry page for `meta_table` rows. It owns URL-backed detail state and sends MetaTable bulk actions using UID arrays.
- `MainSequenceSimpleTableSnapshotTab.tsx`: exports `MainSequenceMetaTableSnapshotTab`, which loads `/get-data-snapshot/` for the selected MetaTable and renders a searchable row preview.
- `MainSequenceSimpleTableSchemaGraph.tsx`: exports `MainSequenceMetaTableSchemaGraph`, the tab wrapper for the MetaTable `/schema-graph/` endpoint.
- `MainSequenceSimpleTableUmlExplorer.tsx`: exports `MainSequenceMetaTableUmlExplorer`, the themed UML-style explorer for schema tables, columns, indexes, and foreign-key multiplicities.

## Dependencies

- Data is loaded through `extensions/main_sequence/common/api/index.ts` using `/orm/api/ts_manager/meta_table/`.
- Detail tabs use `/{uid}/summary/`, `/{uid}/`, `/{uid}/get-data-snapshot/`, and `/{uid}/schema-graph/`.
- Bulk actions use `/bulk-delete/` and `/bulk-refresh-table-search-index/` with `{ "uids": string[] }`.
- Shared registry controls come from `extensions/main_sequence/common/components/` and `extensions/main_sequence/common/hooks/`.

## Notes

- There is no MetaTable update-node endpoint. Update-node screens remain only under Data Nodes and LocalTimeSerie workflows.
- Bulk delete removes MetaTable registrations only; it does not drop physical database tables.
- Top-level detail navigation is URL-backed with `msMetaTableUid` and `msMetaTableTab`.
- The `Data Snapshot` tab intentionally uses the lightweight preview endpoint instead of the heavier Data Node widget pipeline.
- The `ULM diagram` tab calls `/{uid}/schema-graph/` and exposes `depth` and `include_incoming`.
