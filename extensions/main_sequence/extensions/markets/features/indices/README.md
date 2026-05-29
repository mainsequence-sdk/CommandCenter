# Main Sequence Markets Indices

This feature owns the Main Sequence Markets index registry surface, embedded detail view, and single-record delete flow.

## Entry Points

- `MainSequenceIndicesPage.tsx`: URL-driven index list surface with shared registry search, fixed pagination, and embedded detail selection through `msIndexUid`.
- `MainSequenceIndexDetailView.tsx`: read-only detail view for one index with raw metadata rendering and delete confirmation.

## API Dependencies

- `GET /api/v1/index/?response_format=frontend_list&search=&limit=&offset=` for the list view. Rows are uid-based and include `uid`, `unique_identifier`, `display_name`, `description`, and `provider`.
- `GET /api/v1/index/{uid}/` for the detail payload. The response includes the list fields plus `metadata_json`.
- `DELETE /api/v1/index/{uid}/` for single-record deletion and returns `null`.

## Rules

- Keep list search and pagination URL-backed so index views are refresh-safe and linkable.
- Keep detail selection in the same page flow through `msIndexUid` instead of introducing a second route.
- Keep transport logic in `extensions/main_sequence/common/api/index.ts`.
- Treat `metadata_json` as read-only backend data; render it directly without assuming a stronger frontend schema.
