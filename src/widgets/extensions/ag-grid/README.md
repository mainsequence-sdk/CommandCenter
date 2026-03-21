# AG Grid Widgets

This folder contains the AG Grid-backed widget modules owned by the `ag-grid` extension.

## Entry Points

- `definition.ts`: widget registry definition for the `positions-table` widget.
- `PositionsTableWidget.tsx`: AG Grid renderer for the reusable positions table.
- `grid-theme.ts`: AG Grid theme helpers aligned to the current shell tokens.

## Current Status

- `positions-table` is currently registered in the live widget catalog from `src/extensions/ag-grid/index.ts`.

## Maintenance Notes

- Keep AG Grid styling and behavior isolated here rather than leaking grid-specific helpers into generic widget folders.
- If the positions data model changes, update the definition and renderer together so saved dashboards keep a stable widget contract.
