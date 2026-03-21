# AG Grid Extension

This extension owns the optional AG Grid-backed widget registrations.

## Entry Points

- `index.ts`: registers the extension metadata and its live widget catalog entries.

## Owned Assets

- `positions-table` from `src/widgets/extensions/ag-grid/`

## Maintenance Notes

- Keep AG Grid-specific widget registration isolated here so the main widget catalog can enable or disable the grid integration cleanly.
- If additional AG Grid widgets are added later, document them here and keep their implementation details in the widget module folder.
