# AG Grid Widgets

This folder contains the AG Grid-backed widget modules used by the live widget catalog.

## Entry Points

- `definition.ts`: widget registry definition for the `positions-table` widget.
- `PositionsTableWidget.tsx`: AG Grid renderer for the reusable positions table.
- `grid-theme.ts`: AG Grid theme helpers aligned to the current shell tokens.

## Current Status

- `positions-table` keeps its stable widget id here, but its business-source metadata is now
  classified as `main_sequence_markets`.
- The mounted renderer is still a legacy local-query widget, but it now distinguishes first fetch
  loading, query error, and completed empty results before mounting the AG Grid body.

## Maintenance Notes

- Keep AG Grid styling and behavior isolated here rather than leaking grid-specific helpers into generic widget folders.
- If the positions data model changes, update the definition and renderer together so saved dashboards keep a stable widget contract.
- Keep the first-fetch placeholder states aligned with the renderer's local query contract. An
  unexecuted or in-flight first request should not render as an empty grid.
