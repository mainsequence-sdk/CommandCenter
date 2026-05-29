# Main Sequence Markets Catalogue

This feature owns the `Catalogue` surface under the `Platform` navigation section in Main Sequence Markets.

## Entry Points

- `MainSequenceCataloguePage.tsx`: paginated catalogue registry page that deep-links recognized catalogue resources into Main Sequence Foundry detail pages and falls back to inline catalogue detail for unrecognized resource types.

## API Dependencies

- `GET /api/v1/catalog/` for the top-level catalogue registry. The corrected contract returns `results`, `limit`, and `offset` only.
- `GET /api/v1/catalog/{catalog_uid}/rows/` for the selected catalogue row listing, including `catalog`, `columns`, `results`, `limit`, and `offset`.
- `DELETE /api/v1/catalog/{catalog_uid}/rows/{uid}/` for single-row deletion from the selected catalogue detail.

## Rules

- Do not render or derive `physical_schema` or `physical_table_name`; they were removed from the frontend handoff.
- If `resource_type` is `datanode` or `metatable`, row clicks should open the corresponding Main Sequence Foundry detail screen using the catalogue record `uid` and the standard `msDataNodeUid` / `msMetaTableUid` query params.
- Keep catalogue detail focused on the backend contract that is actually exposed: record metadata, row-listing capability, column definitions, and row deletion.
- Treat pagination as offset-based without a total count. The current UI therefore exposes previous/next controls based on `limit`, `offset`, and the number of loaded rows.
