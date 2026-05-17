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
  builds a resolved table frame, maps source visual metadata into table-native column overrides and
  conditional rules, then renders through `src/widgets/core/table/TableFrameView.tsx`.
- `AssetScreenerWidgetSettings.tsx`: settings editor for layout, grouping, row cap, and generic
  tabular field mappings.
- `assetScreenerModel.ts`: prop normalization, resolved-input materialization, screener runtime
  model derivation, filtering, and sorting.
- `USAGE_GUIDANCE.md`: backend-synced authoring guidance.

## Data Contract

The widget accepts generic `core.tabular_frame@v1` outputs on both inputs. Snapshot, baseline,
trend, and live-update meaning is assigned by the widget input role plus explicit field mappings or
internal `meta.marketAsset` field-role metadata. Connections should not advertise Asset
Screener-specific market contracts to feed this widget.

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
Transforms run before `meta.marketAsset` semantic adaptation, so a row-local calculation such as
`one_day_return = percentChange(last_price, previous_close)` can become a normal `valueKey`.
Visual metadata is row-shape guidance for compact visuals, ranges, and the default settings-visible
column model; it is not a connection contract.

## Metadata Capabilities

- `meta.marketAsset.role` should be `snapshot` for public Asset Screener inputs.
- `meta.marketAsset.fieldRoles` maps generic columns to identity, observation, latest value,
  inline `referenceValue`, and inline `sparklineSeries` semantics.
- `meta.tableTransforms.computedColumns` adds row-local derived fields before field roles are
  evaluated. Supported numeric operators are `percentChange`, `difference`/`subtract`,
  `ratio`/`divide`, `add`, and `multiply`.
- `meta.tableVisuals.columns` carries display hints for formats, table visual behavior, ranges, and
  compact visual encodings. In default `columnConfigMode: "source"`, those metadata keys also propose the
  visible column configuration shown read-only in settings. Source visual hints are copied to each
  derived column's `visual` property so settings and instance overrides can see and edit the same
  color/range config. `tableVisuals.columns` is enough to populate the settings column list even
  when `meta.marketAsset` is absent; market field roles add stronger semantic mapping when the
  source provides them. The runtime maps those hints into the shared table frame renderer, so
  numeric formatting, conditional rules, range-backed bars, and heatmaps follow the core table
  presentation semantics.
- `columnConfigMode: "custom"` plus `columns` is the persisted instance override. Settings copies
  the effective source columns into that prop when the user chooses `Instance override`; the local
  copy wins until the user switches back to source metadata.
- Explicit widget field mappings win over metadata. Metadata wins over field-name heuristics.
- Inline `sparklineSeries` parsing uses the encoding and order on the field role itself; duplicate
  visual metadata is descriptive and preserved, but not required for parsing.

## Generic Field Mapping Examples

Latest snapshot frames bind to `seedData` from a `dataset` output:

```json
{
  "assetKeyField": "asset_id",
  "symbolField": "ticker",
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
  "assetKeyField": "asset_id",
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
- When no source metadata or instance override columns exist, the widget must render an empty
  source-column state. It must not fall back to Symbol/Name/Trend or any other predefined market
  column set.
- The renderer uses `instanceTitle` for its compact in-panel header. Do not hardcode the widget
  definition title there; the visible label should be the workspace card title when one exists.
- The renderer must not draw a rounded nested card inside the workspace frame. Keep the screener
  surface square-edged so it matches workspace widget chrome.
- Do not reintroduce a standalone grid for Asset Screener. Market-specific code should stop at
  adapting seed/live data into table rows, table schema, table column overrides, conditional rules,
  and optional custom cell renderers such as the sparkline cell.
- The Asset Screener uses the shared table frame with column floating filters disabled and a
  transparent surface. Per-column filter rows and opaque card backgrounds belong to the generic
  Table widget, not the market screener workspace presentation.
- Keep `mockProps` and `mockRuntimeState` representative. The widget catalog and settings demo
  previews use those fixtures to render without live workspace bindings or connection sessions.
- Do not store backend endpoint URLs, credentials, or transport details in widget props.
- Keep shared asset identity, reference-point, and internal field-role logic in
  `../../widget-contracts/` rather than duplicating it in this widget folder.
- Bump `widgetVersion` when input roles, field mapping semantics, default column behavior, or
  registry guidance changes materially.
