# Simple Tables Feature

This feature owns the Main Sequence Foundry registry screen for `ts_manager/simple_table/`.

## Entry Points

- `MainSequenceSimpleTablesPage.tsx`: paginated registry page that lists `simple_table` rows, supports client-side filtering over the current page, owns URL-backed detail state, and sends bulk delete requests for the current selection.
- `MainSequenceSimpleTableSchemaGraph.tsx`: tab wrapper for the simple-table `/schema-graph/` endpoint, including depth and incoming-reference controls.
- `MainSequenceSimpleTableUmlExplorer.tsx`: themed UML-style explorer that renders schema tables, columns, indexes, and foreign-key multiplicities.
- `MainSequenceSimpleTableUpdatesTab.tsx`: local-update tab that lists `simple_table/update` rows for the selected table and opens nested update detail.
- `MainSequenceSimpleTableUpdateDetail.tsx`: SimpleTableUpdate detail surface with tabs for update details, dependency graphs, and historical updates.
- `MainSequenceSimpleTableUpdateDependencyGraph.tsx`: feature wrapper that binds the reusable dependency-graph renderer to the `simple_table/update/{id}/dependencies-graph/` endpoint.

## Dependencies

- Data is loaded through `extensions/main_sequence/common/api/index.ts` using the standard offset-paginated list query for `/orm/api/ts_manager/simple_table/`, detail helpers for `/summary/`, `/{id}/`, the schema-graph helper for `/{id}/schema-graph/`, and update helpers rooted at `/orm/api/ts_manager/simple_table/update/`.
- Shared registry controls come from `extensions/main_sequence/common/components/` and `extensions/main_sequence/common/hooks/`.

## Notes

- Top-level detail navigation is URL-backed with `msSimpleTableId` and `msSimpleTableTab`. Nested SimpleTableUpdate detail uses `msSimpleTableUpdateId` and `msSimpleTableUpdateTab`.
- The `ULM diagram` tab calls `/{id}/schema-graph/` and currently exposes two query controls: `depth` and `include_incoming`.
- The top-level summary endpoint now uses the shared `SummaryResponse` contract directly, so this feature consumes the summary payload without local shape adapters.
- The update detail intentionally exposes only the views supported by the current backend surface: details, dependency graphs, run configuration, and historical updates.
