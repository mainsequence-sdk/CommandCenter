# Asset Screener Widget

This folder owns the Markets `Asset Screener` widget. It renders a dense terminal-style asset
table from four bound data lanes: latest snapshot seed data, historical reference points, bounded
history series, and live latest updates.

## Entry Points

- `definition.ts`: widget registry definition for the stable `ms-markets-asset-screener`
  widget id.
- `AssetScreenerWidget.tsx`: runtime renderer with compact virtualized rows, grouping, filtering,
  sorting, and diagnostics.
- `AssetScreenerWidgetSettings.tsx`: settings editor for layout, grouping, row cap, and generic
  tabular field mappings.
- `assetScreenerModel.ts`: prop normalization, resolved-input materialization, screener runtime
  model derivation, filtering, and sorting.
- `USAGE_GUIDANCE.md`: backend-synced authoring guidance.

## Data Contract

- `seedData`: latest/current snapshot seed. Usually from `connection-query.dataset`.
- `referenceData`: historical baselines such as previous close, one month ago, year start, or one
  year ago. Usually from `connection-query.dataset`.
- `historyData`: bounded ordered series for trend sparklines. Usually from
  `connection-query.dataset`.
- `liveUpdates`: latest incremental updates. Usually from `connection-stream-query.updates`.

The widget accepts generic `core.tabular_frame@v1` outputs on every input. Snapshot,
reference-point, history-series, and live-update meaning is assigned by the widget input lane plus
explicit field mappings or internal `meta.marketAsset` field-role metadata. Connections should not
advertise Asset Screener-specific market contracts to feed this widget.

The default `Trend` column renders a compact sparkline from full history-series points when they
are available. For terminal-style low-resolution trends, `seedData` may also carry an inline
`sparklineSeries` field such as a CSV number cell. If neither exists, the renderer falls back to
ordered `referenceData` points plus the latest value so common previous-close/month/year baselines
still produce a visible chart.

Columns are dynamic view configuration over stable semantic value keys. A source can add metrics
such as `volume`, `marketCap`, or `peRatio` as additional `valueKey`s, and the widget can render
them through `latest-value`, `reference-value`, `return`, or `sparkline` column definitions without
changing the IO contract.

Frames can also include `meta.tableTransforms.computedColumns` and `meta.tableVisuals.columns`.
Transforms run before `meta.marketAsset` semantic adaptation, so a row-local calculation such as
`one_day_return = percentChange(last_price, previous_close)` can become a normal `valueKey`.
Visual metadata is row-shape guidance for compact visuals and ranges; it is not a connection
contract.

## Metadata Capabilities

- `meta.marketAsset.role` selects how the frame is adapted: `snapshot`, `reference-points`, or
  `history-series`.
- `meta.marketAsset.fieldRoles` maps generic columns to identity, observation, reference, value,
  inline `referenceValue`, and inline `sparklineSeries` semantics.
- `meta.tableTransforms.computedColumns` adds row-local derived fields before field roles are
  evaluated. Supported numeric operators are `percentChange`, `difference`/`subtract`,
  `ratio`/`divide`, `add`, and `multiply`.
- `meta.tableVisuals.columns` carries display hints for formats, color scales, ranges, and compact
  visual encodings. The current renderer consumes `format` and `colorScale`; range, bar, and heatmap
  hints remain available in the runtime model for future Markets widgets.
- Explicit widget field mappings win over metadata. Metadata wins over field-name heuristics.
- Inline `sparklineSeries` parsing uses the encoding and order on the field role itself; duplicate
  visual metadata is descriptive and preserved, but not required for parsing.

## Generic Field Mapping Examples

Latest snapshot frames usually bind to `seedData` from a `dataset` output:

```json
{
  "assetKeyField": "asset_id",
  "symbolField": "symbol",
  "sectorField": "sector",
  "observedAtField": "time",
  "valueFields": {
    "price": "last_price"
  }
}
```

Historical baseline frames usually bind to `referenceData` from a `dataset` output:

```json
{
  "assetKeyField": "asset_id",
  "referenceKeyField": "reference_key",
  "observedAtField": "observed_at",
  "valueFields": {
    "price": "close"
  }
}
```

History series frames usually bind to `historyData` from a `dataset` output:

```json
{
  "assetKeyField": "asset_id",
  "observedAtField": "observed_at",
  "valueFields": {
    "price": "close"
  }
}
```

Live update frames usually bind to `liveUpdates` from an `updates` output and reuse the latest
snapshot mapping shape:

```json
{
  "assetKeyField": "asset_id",
  "observedAtField": "time",
  "valueFields": {
    "price": "last_price"
  }
}
```

## Maintenance Notes

- Keep the screener a passive consumer. Connection Query, Connection Stream Query, and Tabular
  Transform remain the execution owners.
- Keep `mockProps` and `mockRuntimeState` representative. The widget catalog and settings demo
  previews use those fixtures to render without live workspace bindings or connection sessions.
- Do not store backend endpoint URLs, credentials, or transport details in widget props.
- Keep shared asset identity, reference-point, and internal field-role logic in
  `../../widget-contracts/` rather than duplicating it in this widget folder.
- Bump `widgetVersion` when input roles, field mapping semantics, default column behavior, or
  registry guidance changes materially.
