# Physical Data Sources Feature

This feature contains the Main Sequence physical data source registry and editor flows.

## Files

- `MainSequencePhysicalDataSourcesPage.tsx`: server-paginated list surface, bulk actions, and detail/create routing.
- `MainSequencePhysicalDataSourceEditor.tsx`: create and edit flow for physical data source records, including the shared summary header in edit mode.

## Notes

- Keep physical data source form behavior and list-specific filtering in this folder unless it becomes shared across features.
- Edit mode now shows the standardized `data_source/{id}/summary/` payload above the editor form through the shared Main Sequence summary card.
- The registry exposes only the Timescale DB create flow; Duck DB and managed data source creation are intentionally not available from this screen.
