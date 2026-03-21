# data-node-table-visualizer Widget

This folder owns the Flow Lab `data-node-table-visualizer` widget id. The UI and settings are built
as a reusable AG Grid Community table formatter.

## Purpose

`data-node-table visualizer` is the complex table-formatting surface for mock trading datasets. It is
meant to exercise the formatter layer before the real backend feed is connected. The widget is intentionally
configuration-heavy:

- dataset switching across multiple mock row shapes
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
- `DataNodeTableVisualizerWidget.tsx`: runtime renderer that maps the resolved config into AG Grid Community.
- `DataNodeTableVisualizerWidgetSettings.tsx`: widget settings editor for dataset, columns, value labels, and
  numeric rules. The form now uses the shared tight-density widget settings classes so large table
  configs stay compact.
- `data-node-table-visualizer-model.ts`: shared config model, mock datasets, defaults, formatters, and helper
  functions used by both renderer and settings.

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

## Mock Data Model

`data-node-table-visualizer-model.ts` ships three mock datasets:

- `positions`: position and strategy-level rows with PnL, exposure, conviction, and status fields
- `risk-monitor`: desk-level risk rows with drawdown, utilization, VaR, and regime fields
- `execution-quality`: venue/routing diagnostics with fill rate, slippage, latency, and score

The mock dataset layer exists so the formatter can be developed independently from backend transport.
Each widget instance now owns its active data frame and field schema in props, while the selected mock
dataset only seeds that frame with sample rows and a starting field shape. When live data is introduced
later, keep that instance-owned frame + field contract stable and swap only the row source adapters.

If the instance schema no longer matches the available row shape, the widget and settings both surface
an explicit schema-mismatch error instead of silently rendering a broken grid.

## Config Surface

The widget props are intentionally the contract for future live integration:

- `datasetId`
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

`columns` and `rows` are the primary input contract. The widget assumes tabular frame data shaped like:

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
- If the mock datasets or formatter contract changes, update both `data-node-table-visualizer-model.ts` and this
  README in the same change.
- If real backend data replaces the mock rows, keep the settings schema and formatting helpers stable
  so existing saved widget props continue to render.
