# Main Sequence Data Node Table Widget

This folder owns the Main Sequence workbench `data-node-table-visualizer` widget id. The UI and
settings are built as a reusable AG Grid Community table formatter around live data-node frames.

## Purpose

`Data Node Table` is the table-formatting surface for live data-node rows fetched from the backend.
The widget is intentionally configuration-heavy:

- data-node selection, date range selection, row limit, and optional `unique_identifier` filtering
- raw-frame input shaped as `columns[]` plus `rows[][]`
- per-instance schema control for keys, labels, descriptions, and base formats
- per-column visibility, pinning, alignment, and numeric display formatting
- prefixes and suffixes per column
- value labels rendered as colored chips from explicit widget mappings
- threshold rules such as `> 0`, `< -5`, or `> 80`
- heatmap cell backgrounds controlled per column
- inline filled bars that can be enabled from the formatter on any column
- surface toggles like density, toolbar, zebra rows, and pagination

## Entry Points

- `definition.ts`: widget registry definition, default props, and settings registration.
- `DataNodeTableWidget.tsx`: runtime renderer that maps the resolved config into AG Grid Community.
- `DataNodeTableWidgetSettings.tsx`: widget settings editor for data-node selection, date range,
  columns, value labels, and numeric rules. Column schema and display formatting are edited together
  inside each per-column card. The form uses the shared
  tight-density widget settings classes so large table configs stay compact.
- `dataNodeTableModel.ts`: shared config model, live frame helpers, defaults, formatters, and helper
  functions used by both renderer and settings.
- `../data-node-shared/`: shared data-node picker, datetime field, metadata inference, and range
  helpers reused by both the table and graph widgets.

## AG Grid Community Scope

This widget deliberately stays inside the free/community feature set. Current usage:

- column sorting
- text and number filtering
- floating filters
- column resizing and movement
- pinned columns
- pagination
- custom React cell renderers
- custom cell background styling
- quick filtering from the widget toolbar

Not used here:

- enterprise side panels
- pivoting
- row grouping
- aggregation
- Excel export

If a future change depends on AG Grid Enterprise, document that explicitly before wiring it into this
widget. The current intent is to keep this formatter removable and license-light.

## Data Sources

The widget fetches source-table metadata plus remote rows from a selected data node, then adapts
them into a common frame contract:

- `columns[]`
- `rows[][]`
- schema fallback inferred from column metadata and sampled rows

The settings editor resolves against that live frame preview, so field formatting still happens in the
same per-instance schema/override pipeline on top of the remote data.

If the instance schema no longer matches the available row shape, the widget and settings both surface
an explicit schema-mismatch error instead of silently rendering a broken grid.

## Config Surface

The widget props are intentionally data-node-only:

- `dataNodeId`
- `dateRangeMode`
- `fixedStartMs`
- `fixedEndMs`
- `uniqueIdentifierList`
- `limit`
- `columns`
- `rows`
- `schema`
- `density`
- `showToolbar`
- `showSearch`
- `zebraRows`
- `pagination`
- `pageSize`
- `columnOverrides`
- `valueLabels`
- `conditionalRules`

`columns` and `rows` remain the primary runtime contract after the live rows are adapted. The widget
assumes tabular frame data shaped like:

- `columns = ["a", "b", "c"]`
- `rows = [[1, 2, "pedro"], [3, 4, "maria"]]`

`schema` owns the instance-level field contract:

- key
- label
- description
- base format

`columnOverrides` owns presentation for each field:

- visibility
- decimals
- prefix
- suffix
- heatmap toggle
- compact-number toggle
- inline bar mode
- alignment
- pinning

The effective `format` is also the switch for which display treatments can render:

- `Text`: supports value-label chips
- `Number` / `Currency` / `Percent` / `Bps`: support decimals, compact numbers, heatmaps, data bars,
  and conditional rules

The settings UI and resolved renderer both follow that effective format instead of hardcoding
source-schema assumptions.

`valueLabels` are explicit value mappings like `Long`, `Short`, `Active`, `Critical`, or `Crowded`.
They support semantic tones (`primary`, `success`, `warning`, `danger`, `neutral`) so configured chips
follow the active theme, with optional raw hex overrides still available when a widget instance needs
custom colors. The widget now ships with no pre-seeded label mappings, so badge rendering is fully
instance-configured.
`conditionalRules` act like thresholds and currently apply in order, first match wins. They use
the same semantic tone contract before falling back to any custom hex overrides. The widget ships with
no pre-seeded threshold rules, so numeric tinting is also fully instance-configured. Rules can be attached
to any non-text display column from settings; non-numeric cells are ignored at render time.

## Maintenance Notes

- Keep all `assistant-ui` and chat work out of this folder. This widget should remain isolated to table
  formatting only.
- If the source adapters or formatter contract changes, update both
  `dataNodeTableModel.ts` and this README in the same change.
- Keep this widget free of shipped mock datasets. Explorer/demo previews should tolerate the empty
  "Select a data node" state instead of reintroducing fake row shapes here.
- Live data-node mode should keep the per-instance schema and formatter helpers stable so existing
  saved widget props continue to render after backend changes.
