# Physical Data Sources Feature

This feature contains the Main Sequence physical data source registry and editor flows.

## Files

- `MainSequencePhysicalDataSourcesPage.tsx`: server-paginated list surface, bulk actions, and detail/create routing.
- `MainSequencePhysicalDataSourceEditor.tsx`: create and edit flow for physical data source records, including the shared summary header and detail tabs in edit mode.

## Notes

- Keep physical data source form behavior and list-specific filtering in this folder unless it becomes shared across features.
- Edit mode now shows the standardized `connections/data_source/{uid}/summary/` payload above the editor form through the shared Main Sequence summary card.
- Edit mode includes a Connections tab backed by `connections/data_source/{uid}/connections/`; the tab accepts plain arrays and common list envelopes so it can render backend and mock responses. Each row links to the shared Connections Data Sources detail surface with `connectionUid`.
- Timescale DB creation still uses this feature's editor flow, but the primary entry action now lives on the TimeScaleDB service detail screen instead of the registry header.
