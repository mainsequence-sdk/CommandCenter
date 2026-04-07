# AG Grid Widgets

This folder contains the AG Grid-backed widget modules used by the live widget catalog.

## Entry Points

- `definition.ts`: widget registry definition for the `positions-table` widget.
- `PositionsTableWidget.tsx`: AG Grid renderer for the reusable positions table.
- `grid-theme.ts`: AG Grid theme helpers aligned to the current shell tokens.

## Current Status

- `positions-table` keeps its stable widget id here, but its business-source metadata is now
  classified as `main_sequence_markets`.

## Maintenance Notes

- Keep AG Grid styling and behavior isolated here rather than leaking grid-specific helpers into generic widget folders.
- If the positions data model changes, update the definition and renderer together so saved dashboards keep a stable widget contract.
