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
- The top-level registry loads the MetaTable list immediately. Namespace options from
  `/orm/api/ts_manager/meta_table/namespaces/` load in parallel for the filter picker instead of
  blocking the registry.
- Detail tabs use `/{uid}/summary/`, `/{uid}/`, `/{uid}/get-data-snapshot/`, and `/{uid}/schema-graph/`.
- Destructive actions use:
  - `DELETE /orm/api/ts_manager/meta_table/{uid}/` for strict single-table delete
  - `POST /orm/api/ts_manager/meta_table/bulk-delete-with-cascade/` for recursive cascade delete across one or more selected MetaTables
  - `/bulk-delete/` only for multi-select registry delete
  - `POST /orm/api/ts_manager/meta_table/bulk-clear-data/` for destructive selected-row data clearing with `confirm_clear_data: true`
  - `/bulk-refresh-table-search-index/` for search-index refresh
  - `POST /orm/api/ts_manager/meta_table/{uid}/heal-from-physical/` to introspect the physical table and sync projection details
- Shared registry controls come from `extensions/main_sequence/common/components/` and `extensions/main_sequence/common/hooks/`.

## Notes

- The `Details` tab is built from the normalized `GET /orm/api/ts_manager/meta_table/{uid}/`
  contract. It renders top-level metadata plus `columns`, `indexes_meta`, `foreign_keys`, and
  `incoming_fks` directly from that payload instead of relying on Data Node source-table metadata.
- The `Description` tab renders the generated search document, matching the Data Nodes detail
  behavior. A summary field such as `Generated Search Document: Yes` is an availability flag, not
  the document body; the tab fetches
  `GET /orm/api/ts_manager/meta_table/{uid}/generated-search-document/` for the actual markdown
  content and only exposes the refresh-search-index action when no generated document is available.
- There is no MetaTable update-node endpoint. Update-node screens remain only under Data Nodes and LocalTimeSerie workflows.
- Strict delete blocks on inbound foreign-key references. The UI exposes a separate `Delete with Cascade`
  action that uses the bulk cascade endpoint, even from detail view, when the operator intends to
  remove referencing MetaTables and Data Nodes too.
- Bulk delete removes MetaTable registrations only; it does not drop physical database tables.
- Bulk clear data keeps the MetaTable registrations and sends the selected MetaTable UIDs with
  `confirm_clear_data: true` after a danger confirmation dialog. The dialog includes an explicit
  checkbox for protected tables; only when checked does the request include
  `override_protection: true`. The backend treats `protect_from_deletion` as protection against
  destructive storage actions, including truncating/clearing physical rows, and still restricts
  that override to organization admins.
- Top-level detail navigation is URL-backed with `msMetaTableUid` and `msMetaTableTab`.
- Namespace preselection can also be deep-linked with `msMetaTableNamespace`, which is used by
  the DynamicTable Data Source MetaTable import flow to open the imported namespace directly in the
  registry.
- Meta Table display identity uses table names, explicit identifiers, and UIDs. Do not surface
  `storage_hash`; that field is deprecated and is not part of the UI identity model.
- The list view supports namespace filtering without blocking initial list rendering. Deep links can
  preselect a namespace with `msMetaTableNamespace`; otherwise the registry starts from `All
  namespaces` and lets the backend paginate the list.
- Meta Table search must be backend-driven. The page forwards the current search string to
  `/orm/api/ts_manager/meta_table/` with the selected namespace and pagination params so matches
  can be found across the full registry, not only inside the currently loaded page.
- The namespace picker uses the shared custom `Select` secondary-line support. Keep the primary
  label as the namespace name and put the row count on a supporting line as `Meta tables: <count>`
  instead of appending a bare number in parentheses.
- The `Data Snapshot` tab intentionally uses the lightweight preview endpoint instead of the heavier Data Node widget pipeline.
- The `Data Snapshot` tab caps displayed cell text to 320 characters so massive JSON/text rows do
  not expand the registry detail layout. Filtering still uses the original loaded values.
- The `ULM diagram` tab calls `/{uid}/schema-graph/` and exposes `depth` and `include_incoming`.
  The backend payload is a custom graph contract (`root_uid`, `depth`, `include_incoming`,
  `nodes`, `edges`), not a MetaTable serializer. The shared API layer normalizes that response for
  the explorer.
- UML cards start with columns collapsed. Expanding a card changes the layout geometry and triggers
  a fit pass so long column sets reflow instead of overflowing the initial viewport.
- The selected-table detail rail is intentionally single-column for top metadata fields. Namespace
  and physical table values can be long hashes or dotted identifiers, so they must wrap within one
  card instead of sharing a narrow two-column row.
- The UML toolbar includes an explicit edge legend. Color indicates whether a relationship touches
  the root table or is indirect in the current traversal, while stroke style indicates delete
  behavior (`cascade` vs any other policy).
