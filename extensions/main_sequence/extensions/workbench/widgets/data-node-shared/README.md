# Main Sequence Data Node Shared Widgets

This folder owns reusable workbench-level building blocks for widgets that consume Main Sequence
data-node metadata and remote rows.

## Entry Points

- `dataNodeShared.ts`: shared metadata helpers such as field inference, date-range resolution,
  and label formatting for data nodes and local updates.
- `dataNodeWidgetSource.tsx`: reusable source/date-range widget contract used by workbench widgets
  that select a data node, expose optional `unique_identifier` filters, and save a fixed or
  dashboard-driven date range. It also resolves latest-observation anchors used to prefill missing
  fixed dates from a data node's last time index, and it can resolve those source settings from a
  sibling `Data Node` widget when a consumer chooses linked-source mode. The shared fixed
  date controls now mark `From` and `To` as half-width schema fields, so they render on the same
  row in settings instead of stacking vertically.
- `DataNodePreviewTable.tsx`: reusable simple table preview used inside settings flows that inspect
  fetched data-node rows without mounting the full table formatter widget.
- `DataNodeQuickSearchPicker.tsx`: reusable remote-search picker for selecting a data node from
  widget settings or companion-card controls.
- `LocalTimeSerieQuickSearchPicker.tsx`: reusable remote-search picker for selecting a
  `local_time_serie` update from widget settings.
- `DataNodeDateTimeField.tsx`: shared local datetime input used by data-node widgets that support
  fixed saved ranges.

## Scope

Keep only reusable data-node widget primitives here. Widget-specific chart transforms, table
formatting, and widget-specific preview behavior should stay in the owning widget folder.

When multiple widgets point at the same resolved source and request the same row shape, keep their
React Query keys aligned through the shared helpers here so identical remote row requests dedupe.

Shared source/date-range widgets should keep fixed-date editing compact. If the shared source schema
adds more small controls in the future, prefer the same `settingsColumnSpan` contract instead of
hardcoding one-off layout wrappers inside individual widget settings screens.
