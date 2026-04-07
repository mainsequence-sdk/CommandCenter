# AG Grid Extension

This extension owns the AG Grid integration layer used by live widget registrations.

## Entry Points

- `index.ts`: registers the extension metadata and its live widget catalog entries.

## Current Responsibilities

- The `positions-table` widget implementation from `src/widgets/extensions/ag-grid/`
- AG Grid-specific renderer isolation so vendor table dependencies stay out of core widget folders

## Maintenance Notes

- The stable `positions-table` widget id is currently classified as `main_sequence_markets` in its
  widget definition. Keep business ownership metadata there, while continuing to isolate AG Grid
  implementation details under this extension/module boundary.
- If additional AG Grid widgets are added later, document them here and keep their implementation details in the widget module folder.
