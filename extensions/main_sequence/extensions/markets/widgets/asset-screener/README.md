# Asset Screener Widget

This folder owns the Markets `Asset Screener` widget. It adapts market asset semantics into the
shared core table frame renderer and displays a dense terminal-style asset table from two public
data bindings:

- `seedData`: the full semantic snapshot, including latest values, inline historical baselines,
  and compact sparkline cells.
- `liveUpdates`: optional incremental latest updates from a stream or refresh source.

Reference points and sparkline history remain part of the screener runtime model, but this widget
does not expose separate baseline or history inputs. They are seeded from `meta.marketAsset`
field roles on `seedData`.

## Entry Points

- `definition.ts`: widget registry definition for the stable `ms-markets-asset-screener`
  widget id.
- `managedConnectionConsumer.ts`: shared managed-connection adapter that lets the settings page
  create one hidden `connection-query` or `connection-stream-query` source for this screener.
- `AssetScreenerWidget.tsx`: market-to-table adapter and runtime renderer. It derives market rows,
  builds a resolved table frame, and renders through `src/widgets/core/table/TableFrameView.tsx`.
  Shared table metadata and local formula columns now flow through the base table model instead of
  being owned privately by the screener.
- `AssetScreenerWidgetSettings.tsx`: settings editor for screener runtime caps, generic tabular
  field mappings, columns, and the shared core Table display settings mounted in presentation
  mode. The embedded table settings now inherit the same Pro-table capability path as
  `pro-table`, including column-formula authoring and the shared live merge mapping editor.
- `assetScreenerModel.ts`: prop normalization, resolved-input materialization, screener runtime
  model derivation, filtering, and sorting.
- `USAGE_GUIDANCE.md`: backend-synced authoring guidance.

## Data Contract

The widget accepts generic `core.tabular_frame@v1` outputs on both inputs. Snapshot, baseline,
trend, and live-update meaning is assigned by the widget input role plus explicit field mappings or
internal `meta.marketAsset` field-role metadata. Connections should not advertise Asset
Screener-specific market contracts to feed this widget.

`seedData` is deliberately stricter than a generic table: it must include exact columns named
`unique_identifier` and `Symbol`. `unique_identifier` is the canonical asset key used for merging
seed rows and live updates. `Symbol` is the canonical display symbol exposed in the table-backed
settings model.

The widget can either bind visible upstream sources or own one hidden managed source from the
settings page:

- `bound`: normal widget-to-widget bindings.
- `connection`: hidden `connection-query.dataset` is bound to `seedData`.
- `connection-stream`: hidden `connection-stream-query.updates` is bound to `liveUpdates`.

The managed source is still a generic connection widget. The screener remains a consumer and
interprets market semantics from generic tabular data.

## Interaction Outputs

The screener now publishes the same interaction-style outputs as the core Table widget:

- `selectedRows`
- `activeRow`
- `activeCell`
- `activeCellValue`
- `selectedCellValues`

These outputs are runtime-only. They do not mutate saved widget props or upstream data.

Asset Screener interactions are row-oriented even when a downstream widget consumes
`activeCell`, `activeCellValue`, or `selectedCellValues`. Clicking any screener cell selects the
full asset row first, then records the clicked column as the active cell inside that selected row.
The screener does not use free-form cell-range selection as its primary interaction model.

Selection identity is always derived from the canonical asset key, not from a user-configured row
field list. Internally the screener uses `unique_identifier` / `assetKey` so active selection can
survive sorting, filtering, grouping, and live updates.

When a downstream widget reference actively consumes one of those interaction outputs and saved
`table.selectionMode` is still `none`, the screener runtime now infers the minimal interaction mode
needed for that consumer. The saved widget props stay unchanged.

Grouped section headers are synthetic presentation rows only. They are never published as
`selectedRows`, `activeRow`, or `activeCell` outputs.

Those outputs now resolve through the same shared table-selection helper path used by the core
Table widget. The screener still owns asset-key sanitization and public-row projection, but nested
variable references such as `$(screener).activeRow.symbol` now depend on the same interaction
state semantics as the base table.

The default `Trend` column renders a compact sparkline from an inline `sparklineSeries` seed field
such as a `sparkline_prices` CSV number cell. Return columns compare latest values against inline
`referenceValue` seed fields such as `previous_close`, `one_month_ago`, `year_start`, and
`one_year_ago`.

Columns are dynamic view configuration over stable semantic value keys. A source can add metrics
such as `volume`, `marketCap`, or `peRatio` as additional `valueKey`s, and the widget can render
them through `latest-value`, `reference-value`, `return`, or `sparkline` column definitions without
changing the IO contract.

Frames can include `meta.tableVisuals.columns` as the source-owned column proposal. That block can
declare raw columns, hidden formula inputs, sparklines, and formula display columns. Mock
connection responses that publish raw checkpoints such as `previous_close`, `one_month_ago`,
`year_start`, and `one_year_ago` should keep those as flat row fields and declare return columns
with `format: "formula"` plus a `formulaExpression` in `tableVisuals.columns`; they should not
publish those returns as source-owned market `value` roles.
`meta.tableTransforms.computedColumns` is still consumed for backward compatibility and for
upstream `tabular-transform` output, but it is no longer the recommended way to hand-author an
Asset Screener mock response.

Local screener formulas now belong to the shared Pro-table settings path as well. If a user wants
one screener-only computed display column such as `YTD` or `Spread %`, that column is authored in
the embedded shared table settings and rendered through the same formula runtime used by
`pro-table`. Asset Screener itself still only owns market identity, latest/reference semantics,
and sparkline cell rendering.

## Metadata Capabilities

- `meta.marketAsset.role` should be `snapshot` for public Asset Screener inputs.
- `meta.marketAsset.fieldRoles` maps generic columns to identity, observation, latest value,
  inline `referenceValue`, and inline `sparklineSeries` semantics.
- `meta.tableVisuals.columns` carries display hints for formats, table visual behavior, ranges, and
  compact visual encodings. It also carries source-declared formula display columns with
  `format: "formula"`, `formulaExpression`, and `formulaResultFormat`. This block is shared
  table/tabular metadata. In default
  `columnConfigMode: "source"`, those metadata keys propose the visible column configuration shown
  in settings. `tableVisuals.columns` is enough to populate the settings column list even when
  `meta.marketAsset` is absent; market field roles add stronger semantic mapping when the source
  provides them. The base table path consumes those hints for numeric formatting, conditional
  rules, decimal precision, range-backed bars, and heatmaps before any instance-local override is
  saved. Asset Screener now reuses that exact shared table source-visual contract and only aliases
  source field ids onto screener column ids. When `tableVisuals.columns` is present, it is the
  authoritative visible-column proposal and order; semantic identity/reference roles not listed
  there remain semantic inputs unless the user saves an instance override.
- `columnConfigMode: "custom"` plus `columns` is the persisted instance override. Settings copies
  the effective source columns into that prop when the user chooses `Instance override`; the
  settings flow strips shared source `visual` snapshots so the local copy remains a semantic
  column override. At runtime, shared table visuals such as thresholds, gauges, heatmaps, and
  visual ranges stay source-owned and are resolved from the shared table visual-contract builder
  plus any explicit local shared-table settings. Persisted screener `columns[].visual` blobs are
  ignored on read so old widgets cannot fork the live source palette. The local semantic copy wins
  until the user switches back to source metadata.
- Custom screener columns still inherit source visual metadata by semantic match when possible. For
  example, a local `1D` return column can keep the source `one_day_return` gauge, thresholds, and
  theme tones even if the instance override uses a different local column id.
- Explicit widget field mappings are matched against the incoming frame case-insensitively. If a
  saved explicit field no longer exists on the frame, the adapter falls back to semantic metadata
  and then to field-name heuristics instead of dropping rows.
- Inline `sparklineSeries` parsing uses the encoding and order on the field role itself; duplicate
  visual metadata is descriptive and preserved, but not required for parsing.

## Generic Field Mapping Examples

Latest snapshot frames bind to `seedData` from a `dataset` output:

```json
{
  "assetKeyField": "unique_identifier",
  "symbolField": "Symbol",
  "sectorField": "sector",
  "observedAtField": "time",
  "valueFields": {
    "price": "last_price",
    "volume": "volume"
  }
}
```

Live update frames bind to `liveUpdates` from an `updates` output and reuse the latest snapshot
mapping shape:

```json
{
  "assetKeyField": "unique_identifier",
  "observedAtField": "time",
  "valueFields": {
    "price": "last_price",
    "volume": "volume"
  }
}
```

Inline historical baselines and sparklines should be described with `meta.marketAsset` metadata
because explicit field mappings do not encode `referenceKey`, sparkline encoding, or sparkline
order.

## Maintenance Notes

- Keep the screener a passive consumer. Connection Query, Connection Stream Query, and Tabular
  Transform remain the execution owners.
- `assetScreenerSourceMode`, `embeddedConnectionQuery`, and `embeddedConnectionPresentation` are
  persisted optional props used only by the managed-connection adapter. Keep custom settings changes
  based on `normalizeAssetScreenerProps(...)` so those fields are preserved.
- `columnConfigMode` defaults to `source`. Do not reintroduce hardcoded default `columns` into
  `assetScreenerDefaultProps`; source metadata must be able to drive the effective table columns
  and settings must expose those derived columns before local overrides are saved.
- The old shipped screener market preset is treated as legacy display config and is stripped
  during prop normalization. Existing widgets that still carry that copied preset are migrated
  back to source-driven columns instead of forcing stale local headers forever.
- Persisted screener columns must not become the owner of shared table visuals. Source metadata
  should win over any stale copied screener `visual` snapshot so the screener resolves colors and
  gauges through the same shared table contract as the generic Table widget on the same frame.
- When no source metadata or instance override columns exist, the widget must render an empty
  source-column state. It must not fall back to Symbol/Name/Trend or any other predefined market
  column set. If the bound source is still loading or has failed, prefer a source-status message
  over raw metadata jargon; reserve the source-column empty state for frames that arrived without a
  usable visible-column proposal.
- The renderer must not draw a rounded nested card inside the workspace frame. Keep the screener
  surface square-edged so it matches workspace widget chrome.
- Do not reintroduce a standalone grid for Asset Screener. Market-specific code should stop at
  adapting seed/live data into table rows, table schema, table column overrides, conditional rules,
  and Enterprise sparkline column wiring for the shared table frame.
- Do not add screener-only formula semantics. Column formulas now belong to the shared Pro-table
  settings/runtime path so `pro-table` and Asset Screener stay aligned.
- The Asset Screener uses the shared table frame with column floating filters disabled and a
  transparent surface and no internal toolbar or footer strip. Per-column filter rows,
  quick-filter search, in-panel titles, row-count headers, empty-state footers, pagination panels,
  diagnostics bars, and opaque card backgrounds belong to the generic Table widget, not the market
  screener workspace presentation.
- Grouped sections now belong to the shared table settings surface via `table.groupBy`. Asset
  Screener no longer owns a parallel layout/grouping control; it passes market rows into the
  shared table layer and lets that renderer synthesize section headers.
- `table.liveMergeKeyMappings` is exposed through the embedded shared table settings. It uses the
  same seed/live row identity model as Table and Pro Table, so a screener can patch retained rows
  when live update rows use different field names or arrive as repeated latest events.
- Interaction outputs resolve against real asset rows after grouping is applied. Synthetic section
  headers remain non-semantic presentation rows and are scrubbed from published selection state.
- Legacy top-level screener `groupBy` props are still normalized into `table.groupBy` so existing
  workspaces keep rendering, but new edits should persist grouping through the shared table
  settings path.
- Keep `mockProps` and `mockRuntimeState` representative. The widget catalog and settings demo
  previews use those fixtures to render without live workspace bindings or connection sessions.
- Do not store backend endpoint URLs, credentials, or transport details in widget props.
- Keep shared asset identity, reference-point, and internal field-role logic in
  `../../widget-contracts/` rather than duplicating it in this widget folder.
- Bump `widgetVersion` when input roles, field mapping semantics, default column behavior, or
  registry guidance changes materially.
