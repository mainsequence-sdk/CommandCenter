# Main Sequence Data Node Shared Widgets

This folder owns reusable workbench-level building blocks for widgets that consume Main Sequence
data-node metadata and remote rows.

## Entry Points

- `dataNodeShared.ts`: shared metadata helpers such as field inference, date-range resolution,
  and label formatting for data nodes.
- `DataNodeQuickSearchPicker.tsx`: reusable remote-search picker for selecting a data node from
  widget settings or companion-card controls.
- `DataNodeDateTimeField.tsx`: shared local datetime input used by data-node widgets that support
  fixed saved ranges.

## Scope

Keep only reusable data-node widget primitives here. Widget-specific chart transforms, table
formatting, and preview logic should stay in the owning widget folder.
