# AG Grid Utilities

This folder now holds the shared AG Grid theme utilities reused by table-oriented widgets and
editors.

## Entry Points

- `grid-theme.ts`: AG Grid theme helpers aligned to the current shell tokens.

## Maintenance Notes

- Keep AG Grid styling and behavior isolated here rather than leaking grid-specific helpers into
  generic widget folders.
- Keep AG Grid wrapper corners square. Workspace widget shells use hard edges, so shared AG Grid
  themes must set wrapper and base border radius to `0`.
