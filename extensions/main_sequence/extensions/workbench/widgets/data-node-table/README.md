# Main Sequence Data Node Table Widget

This folder owns the Main Sequence workbench `data-node-table-visualizer` widget id. The UI and
settings are built as a reusable AG Grid Community table formatter around live data-node frames.

## Purpose

`Data Node Table` is the table-formatting surface for the canonical row dataset owned by a sibling
`Data Node` widget. That upstream Data Node may already be filtered, grouped, pivoted, or projected
before the table sees the rows. The widget consumes the shared published dataset contract
(`columns: string[]`, `rows: Record<string, unknown>[]`, optional `status`, optional normalized `fields`,
optional `source`) and adapts it into the local grid frame it needs. The
widget is intentionally configuration-heavy:

- upstream published input shaped as `columns[]` plus `rows<Record<string, unknown>>[]`
- per-instance schema control for keys, labels, descriptions, and base formats
- per-column visibility, pinning, alignment, and numeric display formatting
- prefixes and suffixes per column
- value labels rendered as colored chips from explicit widget mappings
- threshold rules such as `> 0`, `< -5`, or `> 80`
- heatmap cell backgrounds controlled per column as full-cell value tints using proper palettes
  such as Viridis, Plasma, Turbo, Jet, and diverging ramps
- inline filled bars that can be enabled from the formatter on any column
- ring gauges for numeric columns
- surface toggles like density, toolbar, zebra rows, and pagination

## Entry Points

- `definition.ts`: widget registry definition, default props, and settings registration.
- `DataNodeTableWidget.tsx`: runtime renderer that maps the resolved config into AG Grid Community.
- `DataNodeTableWidgetSettings.tsx`: widget settings editor for linked-filter selection, columns,
  value labels, and numeric rules. Column schema and display formatting are edited together inside
  each per-column card. The linked-source section is intentionally minimal: choose a `Data Node`
  widget, then move directly into table formatting. The form uses the shared
  tight-density widget settings classes so large table configs stay compact. It also exposes a
  modal-driven incoming-schema inspector so users can see the resolved field contract before local
  table formatting is applied.
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

The widget resolves source-table metadata from the linked source and adapts the incoming runtime
dataset into a local grid frame contract:

- required:
  - `columns: string[]`
  - `rows: Array<Record<string, unknown>>`
- optional:
  - `status?: "idle" | "loading" | "ready" | "error"`
  - `error?: string`
  - `fields?: Array<{ key, label?, type, description?, nullable?, nativeType? }>`
  - `source?: { kind, id?, label?, updatedAtMs?, context? }`
- `columns[]`
- `rows<Record<string, unknown>>[]`
- optional published `fields[]` schema used before row-sample inference
- schema fallback inferred from column metadata and sampled rows when published field metadata is absent
- field provenance metadata on `fields[]` so the table can distinguish backend, manual, inferred,
  and derived columns

Canonical example:

```ts
{
  status: "ready",
  columns: ["unique_identifier", "price", "asof"],
  rows: [
    {
      unique_identifier: "BBG000B9XRY4",
      price: 84.5,
      asof: "2026-04-03",
    },
  ],
  fields: [
    {
      key: "unique_identifier",
      label: "Unique identifier",
      type: "string",
      description: "Instrument identifier",
      nullable: false,
    },
    {
      key: "price",
      label: "Price",
      type: "number",
      nullable: false,
    },
    {
      key: "asof",
      label: "As of",
      type: "date",
      nullable: false,
    },
  ],
}
```

The safest upstream publication state is still `status: "ready"` when the rows are usable.
If `status` is omitted, the shared normalizer treats a payload with `columns` or `rows` as
`ready`, treats a payload with only `error` as `error`, and otherwise falls back to `idle`.

The settings editor resolves against that live frame preview, so field formatting still happens in the
same per-instance schema/override pipeline on top of the incoming Data Node-owned data. When the linked
Data Node changes, the table resets its source-derived schema state so stale columns from the previous
source do not leak into the next frame.

At runtime, a published linked `Data Node` frame takes precedence over raw source-table metadata.
That keeps the table usable for transformed upstream datasets, including chained aggregate and pivot
nodes whose output shape no longer matches the original source metadata.

When a linked Data Node frame is already available, the mounted table now treats that published
dataset as the canonical runtime source and skips its own `dynamic_table/{id}/` detail lookup on
workspace surfaces. Detail metadata is only fetched when no linked frame is available yet.

The settings page now surfaces the incoming field schema through the shared modal inspector so the
user can see why a column is typed as numeric, date-like, derived, or ambiguous before adjusting
table-specific formatting rules.

The table does not care how many `Data Node` hops exist upstream. It always consumes the selected
Data Node's final published frame only. That keeps the consumer contract stable as the pipeline
grows deeper.

If the instance schema no longer matches the available row shape, the widget and settings both surface
an explicit schema-mismatch error instead of silently rendering a broken grid.

## Config Surface

The widget props are intentionally consumer-focused:

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

The upstream source is now selected through canonical widget `bindings`, not through widget props.

`columns` and `rows` remain the primary local grid contract after the live published rows are
adapted. The widget assumes tabular frame data shaped like:

- `columns = ["a", "b", "c"]`
- `rows = [{ a: 1, b: 2, c: "pedro" }, { a: 3, b: 4, c: "maria" }]`

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
- heatmap mode
- compact-number toggle
- inline bar mode
- gauge mode
- auto/fixed numeric bounds for visuals
- alignment
- pinning

The effective `format` is also the switch for which display treatments can render:

- `Text`: supports value-label chips
- `Number` / `Currency` / `Percent` / `Bps`: support decimals, compact numbers, heatmaps, data bars,
  gauges, and conditional rules

Heatmaps, data bars, and gauges all read from the same numeric-bounds contract:

- `Auto bounds`: derive min/max from the current live column values
- `Fixed bounds`: use instance-owned `min` / `max` values instead

Heatmap mode is intentionally distinct from data bars:

- `Heatmap`: the whole cell background is tinted by normalized value intensity using a selected
  palette
- `Data bar`: width encodes normalized magnitude inside the cell

Heatmap palettes now support:

- `Auto`: diverging `Blue-White-Red` for mixed-sign columns, `Viridis` otherwise
- explicit palettes like `Jet`, `Turbo`, `Viridis`, `Plasma`, `Inferno`, `Magma`,
  `Blue-White-Red`, and `Red-Yellow-Green`

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
  "Select a Data Node" state instead of reintroducing fake row shapes here.
- The linked Data Node owns backend fetch shape and row limits. Keep this widget focused on formatting
  and local slicing of the incoming frame.
