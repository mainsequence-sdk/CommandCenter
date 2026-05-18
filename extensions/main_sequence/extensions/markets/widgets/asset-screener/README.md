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
  Shared table metadata now flows through the base table model instead of being owned privately by
  the screener.
- `AssetScreenerWidgetSettings.tsx`: settings editor for layout, grouping, row cap, generic
  tabular field mappings, and the shared core Table display settings mounted in presentation mode.
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

The default `Trend` column renders a compact sparkline from an inline `sparklineSeries` seed field
such as a `sparkline_prices` CSV number cell. Return columns compare latest values against inline
`referenceValue` seed fields such as `previous_close`, `one_month_ago`, `year_start`, and
`one_year_ago`.

Columns are dynamic view configuration over stable semantic value keys. A source can add metrics
such as `volume`, `marketCap`, or `peRatio` as additional `valueKey`s, and the widget can render
them through `latest-value`, `reference-value`, `return`, or `sparkline` column definitions without
changing the IO contract.

Frames can also include `meta.tableTransforms.computedColumns` and `meta.tableVisuals.columns`.
Those are shared table/tabular metadata blocks, not screener-specific metadata. Transforms run
before `meta.marketAsset` semantic adaptation, so a row-local calculation such as
`one_day_return = percentChange(last_price, previous_close)` can become a normal `valueKey`.
Visual metadata is row-shape guidance for compact visuals, ranges, and the default
settings-visible column model; the base table path consumes it directly and the screener inherits
those defaults through its table-backed frame.

## Metadata Capabilities

- `meta.marketAsset.role` should be `snapshot` for public Asset Screener inputs.
- `meta.marketAsset.fieldRoles` maps generic columns to identity, observation, latest value,
  inline `referenceValue`, and inline `sparklineSeries` semantics.
- `meta.tableTransforms.computedColumns` adds row-local derived fields before field roles are
  evaluated. This block is owned by the shared table/tabular layer and is also consumed directly by
  the generic Table widget. Supported numeric operators are `percentChange`,
  `difference`/`subtract`, `ratio`/`divide`, `add`, and `multiply`.
- `meta.tableVisuals.columns` carries display hints for formats, table visual behavior, ranges, and
  compact visual encodings. This block is also shared table/tabular metadata. In default
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
- The old shipped `Symbol/Name/Trend/Last/...` preset is treated as legacy display config and is
  stripped during prop normalization. Existing widgets that still carry that preset are migrated
  back to source-driven columns instead of forcing stale local headers forever.
- Persisted screener columns must not become the owner of shared table visuals. Source metadata
  should win over any stale copied screener `visual` snapshot so the screener resolves colors and
  gauges through the same shared table contract as the generic Table widget on the same frame.
- When no source metadata or instance override columns exist, the widget must render an empty
  source-column state. It must not fall back to Symbol/Name/Trend or any other predefined market
  column set.
- The renderer must not draw a rounded nested card inside the workspace frame. Keep the screener
  surface square-edged so it matches workspace widget chrome.
- Do not reintroduce a standalone grid for Asset Screener. Market-specific code should stop at
  adapting seed/live data into table rows, table schema, table column overrides, conditional rules,
  and optional custom cell renderers such as the sparkline cell.
- The Asset Screener uses the shared table frame with column floating filters disabled and a
  transparent surface and no internal toolbar or footer strip. Per-column filter rows,
  quick-filter search, in-panel titles, row-count headers, empty-state footers, pagination panels,
  diagnostics bars, and opaque card backgrounds belong to the generic Table widget, not the market
  screener workspace presentation.
- `groupBy` is a screener presentation setting, not a backend query feature. The renderer inserts
  synthetic section rows into the first visible column, for example `Technology` or `Financials`,
  buckets rows contiguously under that header, and keeps the underlying dataset rows unchanged.
- Keep `mockProps` and `mockRuntimeState` representative. The widget catalog and settings demo
  previews use those fixtures to render without live workspace bindings or connection sessions.
- Do not store backend endpoint URLs, credentials, or transport details in widget props.
- Keep shared asset identity, reference-point, and internal field-role logic in
  `../../widget-contracts/` rather than duplicating it in this widget folder.
- Bump `widgetVersion` when input roles, field mapping semantics, default column behavior, or
  registry guidance changes materially.
