# AG Grid Utilities

This folder now holds the shared AG Grid utilities reused by table-oriented widgets and editors.

## Entry Points

- `grid-theme.ts`: AG Grid theme helpers aligned to the current shell tokens.
- `community-modules.ts`: Community module bundle used by the default `table` widget and shared
  editors unless a variant injects another module set.
- `enterprise-modules.ts`: Enterprise module bundle plus optional license-key bootstrap for
  `pro-table`. This bundle registers Enterprise grid features and wires only the Enterprise
  `SparklinesModule` through the free `ag-charts-community` runtime instead of enabling paid
  integrated charts.

## Maintenance Notes

- Keep AG Grid styling and behavior isolated here rather than leaking grid-specific helpers into
  generic widget folders.
- Keep Community and Enterprise module wiring here instead of scattering AG Grid edition imports
  through widget implementation files.
- The Enterprise helper reads `VITE_AG_GRID_ENTERPRISE_LICENSE_KEY` if present and registers it
  once when the Pro table path is loaded.
- Keep AG Grid wrapper corners square. Workspace widget shells use hard edges, so shared AG Grid
  themes must set wrapper and base border radius to `0`.
