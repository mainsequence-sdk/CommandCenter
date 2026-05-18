## buildPurpose

Renders a dense Main Sequence Markets asset screener from generic `core.tabular_frame@v1` inputs.
The public widget contract has two bindings only:

- `seedData`: the full semantic snapshot
- `liveUpdates`: optional incremental latest updates

Historical baselines and compact sparkline history are carried inside `seedData` through
`meta.marketAsset.fieldRoles`, not through separate widget inputs.

The screener can also own one hidden generic connection source. `connection` mode creates a hidden
`connection-query` and binds its `dataset` output to `seedData`; `connection-stream` mode creates a
hidden `connection-stream-query` and binds its `updates` output to `liveUpdates`.

## whenToUse

- Use when a workspace needs a terminal-style asset table with latest values, dynamic metric
  columns, return columns, grouping, sorting, compact trend sparklines, and live recalculation.
- Use when an existing generic tabular source can publish a snapshot containing asset identity,
  current values, reference values such as previous close or year start, and compact trend cells.
- Use when a WebSocket or refresh source can publish latest updates that patch current values
  without resending all seeded baselines.
- Use the managed connection flow when this screener should own its own hidden generic
  `connection-query` or `connection-stream-query` source instead of sharing a visible upstream
  source widget.
- Use when a generic table needs widget-side calculations such as `1D % = (last_price /
  previous_close - 1) * 100` through `meta.tableTransforms`, without creating a screener-specific
  connection.

## whenNotToUse

- Do not treat the visible screener as a backend data source. It can own a hidden generic
  connection source, but `connection-query` and `connection-stream-query` still own requests and
  WebSockets.
- Do not create a special Asset Screener connection contract. Connections should publish generic
  `core.tabular_frame@v1`; this widget owns the market semantics.
- Do not add separate reference or history bindings. Baselines and low-resolution sparklines belong
  in `seedData` metadata for this widget.
- Do not use for a one-off generic table without asset, value, reference, or trend semantics; use
  the core Table widget instead.

## authoringSteps

- Bind the full snapshot to `seedData` from a `dataset` output using the exact shape shown in
  `seedDataSnapshotExample`.
- Or click `Add connection` in the settings header or in `Bindings -> Data connection` when the
  screener should create and manage one hidden generic source widget.
- Configure the `Connection` tab after adding the managed source. HTTP/query sources bind
  `dataset` to `seedData`; WebSocket stream sources bind `updates` to `liveUpdates`.
- Include current values such as `last_price`, identity fields such as `ticker` and `sector`, and
  baseline fields such as `previous_close`, `one_month_ago`, `year_start`, and `one_year_ago` in
  that same `seedData` table when return columns need them.
- Include compact trend data in a seed cell such as `sparkline_prices`, encoded as CSV numbers, a
  JSON number array, or a native number array.
- Optionally bind WebSocket or incremental latest rows to `liveUpdates` from an `updates` output
  using the exact live-update shape shown in `liveUpdatesExample`.
- Add `meta.tableTransforms.computedColumns` when a displayed metric should be derived client-side
  from fields in the same incoming row.
- Let source metadata configure the default visible columns through `meta.marketAsset`,
  `meta.tableTransforms`, and `meta.tableVisuals`, or switch the settings panel to `Instance
  override` to save a local `columns` copy for that widget instance.
- Configure columns dynamically. Columns are view configuration over stable semantic `valueKey`s,
  `referenceKey`s, and source/computed field ids, for example `price`, `volume`, `marketCap`,
  `previousClose`, `yearStart`, `oneYearAgo`, or `one_day_return`.

## blockingRequirements

- `seedData` must include exact columns named `unique_identifier` and `Symbol`. `unique_identifier`
  is the canonical stable row key; `Symbol` is the canonical display symbol used by the settings
  and runtime table model.
- `seedData` must expose `unique_identifier` as the stable asset key through
  `meta.marketAsset.fieldRoles` role `assetKey` or an explicit `assetKeyField` mapping.
- Every numeric measure used by a latest, return, reference, or sparkline column must be declared as
  role `value`, `referenceValue`, or `sparklineSeries` with a stable `valueKey`.
- Return columns require inline `referenceValue` fields on `seedData` with stable `referenceKey`s
  such as `previousClose`, `oneMonthAgo`, `yearStart`, or `oneYearAgo`.
- Sparkline columns require inline `sparklineSeries` fields on `seedData` when a trend should
  render before or without live updates.
- `meta.tableTransforms.computedColumns` expressions can only reference fields present in the same
  incoming row after tabular normalization.
- `liveUpdates` must use the same `assetKey` and `valueKey` semantics as `seedData`; a live price
  update is just the newest `valueKey: "price"` observation for that asset.
- Managed connection mode requires a valid backend-owned connection instance selected in the hidden
  source widget. Stream mode also requires a streamable connection query model.

## commonPitfalls

- Do not bind historical baselines to `liveUpdates`; live updates mutate latest state only.
- Do not expect `Add connection` to create a market-specific endpoint. It creates the same generic
  hidden connection source used by Graph/Table/Statistic and then applies Asset Screener semantics
  on the returned tabular frame.
- Do not rely on display symbols as unique identifiers unless the source universe guarantees they
  are unique; prefer provider asset ids as `assetKey`.
- Do not hardcode one fixed column pack in source data. Add metrics as semantic `valueKey`s and let
  the widget column config choose what to render.
- Missing inline reference values affect only dependent return columns; missing inline sparkline
  values affect only sparkline columns.
- Do not send high-resolution intraday history in one cell. Inline `sparklineSeries` is for compact
  visual context, not a chart-grade historical data API.
- Computed columns are row-local. If a live update only includes `last_price`, the widget still
  calculates return columns from the seeded inline references, but `meta.tableTransforms` on that
  live frame cannot read fields that are not present in the live row.

## semanticRelationship

The stable relationship is `assetKey + valueKey`, with optional `referenceKey` and ordered inline
sparkline values.

- `seedData` initializes asset identity, latest values, inline references, inline sparklines, and
  row-local computed values.
- `liveUpdates` patches latest values by `assetKey` and `valueKey`.
- `referenceValue` fields on `seedData` create named baselines such as `previousClose`,
  `oneMonthAgo`, `yearStart`, and `oneYearAgo`.
- `sparklineSeries` fields on `seedData` create compact ordered history points from CSV strings,
  JSON number arrays, or number arrays.
- `meta.tableTransforms` runs before market semantic adaptation, so computed fields can be declared
  as normal `value` roles in `meta.marketAsset.fieldRoles`.
- Return columns compare the latest `valueField` against the seeded `referenceValue` with the same
  `valueKey` and matching `referenceKey`.
- Sparkline columns render the seeded `sparklineSeries` for the same `valueKey`; live updates may
  append or patch the latest point without replacing the seeded trend.

## metadataCapabilities

The widget understands three optional metadata blocks on bound `core.tabular_frame@v1` frames.
`meta.marketAsset` is Asset Screener-specific semantic metadata. `meta.tableTransforms` and
`meta.tableVisuals` are shared table/tabular metadata blocks that the generic Table widget also
consumes. None of them are new connection output contracts.

### `meta.marketAsset`

Use `meta.marketAsset` to describe market semantics for generic table columns:

```json
{
  "marketAsset": {
    "role": "snapshot",
    "fieldRoles": [
      { "field": "unique_identifier", "role": "assetKey" },
      { "field": "time", "role": "observedAt" },
      { "field": "last_price", "role": "value", "valueKey": "price" },
      {
        "field": "previous_close",
        "role": "referenceValue",
        "referenceKey": "previousClose",
        "valueKey": "price"
      },
      {
        "field": "price_sparkline",
        "role": "sparklineSeries",
        "valueKey": "price",
        "encoding": "csv-number",
        "order": "oldest-to-newest"
      }
    ]
  }
}
```

Supported public frame role:

- `snapshot`: used for `seedData` and `liveUpdates`.

Supported public field roles:

- Identity roles: `assetKey`, `symbol`, `displayName`, `exchange`, `currency`, `country`,
  `assetClass`, `sector`, `industry`, `group`, `tags`.
- Observation roles: `observedAt`, `sequence`, `quality`.
- Value roles: `value`, `referenceValue`, `sparklineSeries`.

Role attributes:

- `field` is the source column name.
- `role` is the semantic role.
- `valueKey` is required for `value`, `referenceValue`, and `sparklineSeries`; examples are
  `price`, `volume`, `marketCap`, and `oneDayReturn`.
- `referenceKey` is required for `referenceValue`; examples are `previousClose`, `oneMonthAgo`,
  `yearStart`, and `oneYearAgo`.
- `encoding` is supported on `sparklineSeries`: `csv-number`, `json-number-array`, or
  `number-array`.
- `order` is supported on `sparklineSeries`: `oldest-to-newest` or `newest-to-oldest`. If omitted,
  the encoded order is treated as oldest-to-newest.

Explicit widget field mappings take precedence over `meta.marketAsset`. Metadata takes precedence
over naming heuristics. Explicit mappings can map identity and latest value fields; inline
references and sparklines should be expressed with `meta.marketAsset` field roles so their
`referenceKey`, `valueKey`, encoding, and order stay unambiguous.

### `meta.tableTransforms`

Use `meta.tableTransforms.computedColumns` to derive row-local fields before market semantic
adaptation:

```json
{
  "tableTransforms": {
    "computedColumns": [
      {
        "id": "one_day_return",
        "label": "1D %",
        "type": "number",
        "expression": {
          "op": "percentChange",
          "current": { "field": "last_price" },
          "reference": { "field": "previous_close" }
        }
      }
    ]
  }
}
```

Supported expression forms:

- `{ "field": "field_name" }`
- `{ "value": 123 }`
- `{ "op": "percentChange", "current": expression, "reference": expression }`
- `{ "op": "difference", "left": expression, "right": expression }`
- `{ "op": "subtract", "left": expression, "right": expression }`
- `{ "op": "ratio", "numerator": expression, "denominator": expression }`
- `{ "op": "divide", "numerator": expression, "denominator": expression }`
- `{ "op": "add", "args": [expression, expression] }`
- `{ "op": "multiply", "args": [expression, expression] }`

Transform rules:

- Computed fields are added to each row before `meta.marketAsset.fieldRoles` are evaluated.
- A computed field can become a normal `value` role by adding a matching field role.
- Computations are row-local only; they cannot read external bindings, previous rows, or backend
  state.
- Missing or non-numeric operands produce `null` for numeric operations.
- Division by zero produces `null`.
- The same `meta.tableTransforms` block is consumed by the generic Table widget. Asset Screener
  inherits the computed fields through its table-backed frame instead of owning a separate
  transform engine.

### `meta.tableVisuals`

Use `meta.tableVisuals.columns` to attach display hints to source or computed fields:

```json
{
  "tableVisuals": {
    "columns": {
      "one_day_return": {
        "format": "percent",
        "thresholds": [
          { "operator": "lt", "value": 0, "tone": "warning" },
          { "operator": "eq", "value": 0, "tone": "neutral" },
          { "operator": "gt", "value": 0, "tone": "success" }
        ],
        "heatmap": true,
        "gradientMode": "fill",
        "visualRangeMode": "fixed",
        "visualMin": -10,
        "visualMax": 10
      },
      "price_sparkline": {
        "kind": "sparkline",
        "encoding": "csv-number",
        "order": "oldest-to-newest"
      }
    }
  }
}
```

These visual hints are shared with the generic Table widget. In Asset Screener they become the
effective source defaults shown in the shared Table settings, and the first user edit writes only a
local instance override for the touched field.

Supported visual fields:

- `label`: optional display label for the settings-visible derived column.
- `format`: `number`, `price`, `percent`, `volume`, or `currency`.
- `decimals`: optional numeric precision override for rendered number-like columns.
- `kind`: `sparkline`, `bar`, or `heatmap`.
- `encoding`: `csv-number`, `json-number-array`, or `number-array`.
- `order`: `oldest-to-newest` or `newest-to-oldest`.
- `thresholds`: table-style conditional rules with `operator`, `value`, optional theme `tone`, and
  optional `textColor` or `backgroundColor`.
- `heatmap`, `barMode`, `gradientMode`, `heatmapPalette`, `gaugeMode`, `visualRangeMode`,
  `visualMin`, and `visualMax`: table visual controls matching the core Table widget.
- `range.min`, `range.max`, `range.midpoint`, and `range.clamp`: legacy range metadata. Prefer
  `visualRangeMode`, `visualMin`, and `visualMax` for table-backed rendering.
- `colorScale.negative`, `colorScale.neutral`, and `colorScale.positive`: legacy shorthand. Prefer
  `thresholds` for new payloads.
- `width`: optional pixel width for the derived column.

Current table-backed renderer behavior:

- `columnConfigMode: "source"` is the default. In that mode, the settings panel derives the
  visible column JSON from `meta.marketAsset.fieldRoles`, `meta.tableTransforms.computedColumns`,
  and `meta.tableVisuals.columns`.
- If neither source metadata nor instance override columns exist, the widget shows a no-source-
  columns state. It does not invent predefined Symbol, Name, Trend, Last, or return columns.
- `tableVisuals.columns` is the source's column proposal. Its keys should match source field ids or
  computed column ids, for example `last_price`, `one_day_return`, or `sparkline_prices`.
- When `tableVisuals.columns` is present, it is authoritative for the visible source column list
  and order. Semantic identity fields not listed there stay available for screener calculations and
  grouping, but they do not appear as visible columns until the source includes them or the user
  saves an instance override.
- `tableVisuals.columns` is enough to make columns appear in settings. `meta.marketAsset` improves
  semantic mapping for asset identity, reference values, and sparklines, but it is not required for
  the settings column list itself.
- `meta.marketAsset.fieldRoles` can also create source columns for asset identity fields, latest
  value fields, and sparkline fields when `tableVisuals.columns` is absent. Reference-value fields
  are treated as calculation inputs and are shown only when the source explicitly includes them in
  `tableVisuals.columns`.
- Explicit field mappings are reconciled against the current frame shape case-insensitively. If a
  saved mapping points at an old field name that no longer exists, the widget falls back to source
  metadata and then to field-name heuristics instead of dropping all rows.
- Settings display the derived source columns read-only so backend-driven configuration is visible
  and reviewable. Source columns may still expose a descriptive `visual` block in settings, but
  runtime rendering does not rebuild visuals from that property. The live screener reuses the same
  shared table source-visual contract as the generic Table widget and only aliases source field ids
  onto screener column ids.
- Switching settings to `Instance override` copies the current effective source columns into the
  widget's local `columns` prop. The settings flow strips copied source `visual` snapshots there so
  the local override remains a semantic column definition. Shared table visuals stay source-owned
  and continue to resolve from live metadata or shared table settings until the user switches back
  to `Source metadata`. Existing saved screener columns also ignore any persisted `visual`
  snapshots on read, so stale local blobs cannot fork the live source palette.
- Instance override columns still try to inherit source visual metadata by semantic match. A local
  return column such as `1D` can therefore keep the source gauge, threshold, and theme-tone
  behavior even when its local column id differs from the source computed field id.
- `format` can supply the display format when the widget column does not specify one.
- The Asset Screener renders through the shared core table frame view. Numeric formatting, value
  thresholds, heatmaps, data bars, and visual ranges should follow table-widget semantics rather
  than a separate market-only renderer.
- The Asset Screener settings mount the shared core Table settings in presentation mode. Source
  ownership stays with `seedData` and `liveUpdates`, while display settings such as density,
  schema labels, column overrides, value labels, threshold rules, and pagination use the same
  table configuration model.
- The workspace renderer disables the generic table's floating per-column filters and uses a
  transparent surface so the screener does not look like a nested table card. It also suppresses
  the generic table toolbar and footer strips, including the quick filter, clear button, internal
  title or row-count header, empty-message footer, diagnostics footer, and pagination panel.
- `groupBy` groups the rendered screener by injecting section rows into the first visible column.
  It is a local presentation feature only; it does not change the incoming source rows or the
  shared table-backed schema. Groups are rendered contiguously in first-seen group order, while
  row order inside each group still follows the current screener sort.
- `colorScale` is currently treated as a compatibility shorthand and is converted into table
  conditional rules for the derived column id. Prefer table-native threshold/conditional-rule
  semantics for new payloads.
- `range`, `kind: "bar"`, and `kind: "heatmap"` are mapped into the table frame's visual range,
  data-bar, and heatmap behavior.
- For inline sparkline parsing, put `encoding` and `order` on the `sparklineSeries` field role in
  `meta.marketAsset`; duplicate them in `tableVisuals` only as display/readability guidance.

## seedDataSnapshotExample

Bind this to `seedData` from a `dataset` output. This is the expected shape for a table with
Ticker, Sector grouping, Last Price, 1D Return, 1M Return, YTD Return, 1Y Return, and Trend:

```json
{
  "status": "ready",
  "columns": [
    "unique_identifier",
    "Symbol",
    "sector",
    "as_of",
    "last_price",
    "previous_close",
    "one_month_ago",
    "year_start",
    "one_year_ago",
    "sparkline_prices"
  ],
  "rows": [
    {
      "unique_identifier": "uid:AAPL",
      "Symbol": "AAPL",
      "sector": "Technology",
      "as_of": "2026-05-17T14:30:00.000Z",
      "last_price": 112.25,
      "previous_close": 110,
      "one_month_ago": 101.5,
      "year_start": 94.25,
      "one_year_ago": 88.1,
      "sparkline_prices": "101.5,103.2,104.8,107.1,109.4,112.25"
    },
    {
      "unique_identifier": "uid:MSFT",
      "Symbol": "MSFT",
      "sector": "Technology",
      "as_of": "2026-05-17T14:30:00.000Z",
      "last_price": 219.5,
      "previous_close": 221,
      "one_month_ago": 205.25,
      "year_start": 198,
      "one_year_ago": 182.75,
      "sparkline_prices": "205.25,207.8,211.4,216.0,221.0,219.5"
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "snapshot",
      "fieldRoles": [
        { "field": "unique_identifier", "role": "assetKey" },
        { "field": "Symbol", "role": "symbol" },
        { "field": "sector", "role": "sector" },
        { "field": "as_of", "role": "observedAt" },
        { "field": "last_price", "role": "value", "valueKey": "price" },
        {
          "field": "previous_close",
          "role": "referenceValue",
          "referenceKey": "previousClose",
          "valueKey": "price"
        },
        {
          "field": "one_month_ago",
          "role": "referenceValue",
          "referenceKey": "oneMonthAgo",
          "valueKey": "price"
        },
        {
          "field": "year_start",
          "role": "referenceValue",
          "referenceKey": "yearStart",
          "valueKey": "price"
        },
        {
          "field": "one_year_ago",
          "role": "referenceValue",
          "referenceKey": "oneYearAgo",
          "valueKey": "price"
        },
        {
          "field": "sparkline_prices",
          "role": "sparklineSeries",
          "valueKey": "price",
          "encoding": "csv-number",
          "order": "oldest-to-newest"
        },
        { "field": "one_day_return", "role": "value", "valueKey": "oneDayReturn" },
        { "field": "one_month_return", "role": "value", "valueKey": "oneMonthReturn" },
        { "field": "ytd_return", "role": "value", "valueKey": "ytdReturn" },
        { "field": "one_year_return", "role": "value", "valueKey": "oneYearReturn" }
      ]
    },
    "tableTransforms": {
      "computedColumns": [
        {
          "id": "one_day_return",
          "label": "1D",
          "type": "number",
          "expression": {
            "op": "percentChange",
            "current": { "field": "last_price" },
            "reference": { "field": "previous_close" }
          }
        },
        {
          "id": "one_month_return",
          "label": "1M",
          "type": "number",
          "expression": {
            "op": "percentChange",
            "current": { "field": "last_price" },
            "reference": { "field": "one_month_ago" }
          }
        },
        {
          "id": "ytd_return",
          "label": "YTD",
          "type": "number",
          "expression": {
            "op": "percentChange",
            "current": { "field": "last_price" },
            "reference": { "field": "year_start" }
          }
        },
        {
          "id": "one_year_return",
          "label": "1Y",
          "type": "number",
          "expression": {
            "op": "percentChange",
            "current": { "field": "last_price" },
            "reference": { "field": "one_year_ago" }
          }
        }
      ]
    },
    "tableVisuals": {
      "columns": {
        "last_price": {
          "format": "price"
        },
        "one_day_return": {
          "format": "percent",
          "thresholds": [
            { "operator": "lt", "value": 0, "tone": "warning" },
            { "operator": "eq", "value": 0, "tone": "neutral" },
            { "operator": "gt", "value": 0, "tone": "success" }
          ],
          "heatmap": true,
          "gradientMode": "fill",
          "visualRangeMode": "fixed",
          "visualMin": -10,
          "visualMax": 10
        },
        "one_month_return": {
          "format": "percent",
          "thresholds": [
            { "operator": "lt", "value": 0, "tone": "warning" },
            { "operator": "eq", "value": 0, "tone": "neutral" },
            { "operator": "gt", "value": 0, "tone": "success" }
          ]
        },
        "ytd_return": {
          "format": "percent",
          "thresholds": [
            { "operator": "lt", "value": 0, "tone": "warning" },
            { "operator": "eq", "value": 0, "tone": "neutral" },
            { "operator": "gt", "value": 0, "tone": "success" }
          ]
        },
        "one_year_return": {
          "format": "percent",
          "thresholds": [
            { "operator": "lt", "value": 0, "tone": "warning" },
            { "operator": "eq", "value": 0, "tone": "neutral" },
            { "operator": "gt", "value": 0, "tone": "success" }
          ]
        },
        "sparkline_prices": {
          "kind": "sparkline",
          "encoding": "csv-number",
          "order": "oldest-to-newest"
        }
      }
    }
  }
}
```

## liveUpdatesExample

Bind this to `liveUpdates` from an `updates` output. It only needs the changed latest values and
the same asset key semantics:

```json
{
  "status": "ready",
  "columns": ["unique_identifier", "time", "last_price", "volume"],
  "rows": [
    {
      "unique_identifier": "uid:AAPL",
      "time": "2026-05-16T13:01:00.000Z",
      "last_price": 112,
      "volume": 42100000
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "snapshot",
      "fieldRoles": [
        { "field": "unique_identifier", "role": "assetKey" },
        { "field": "time", "role": "observedAt" },
        { "field": "last_price", "role": "value", "valueKey": "price" },
        { "field": "volume", "role": "value", "valueKey": "volume" }
      ]
    }
  }
}
```

## dynamicColumnExamples

The source can publish any metric as a `valueKey`; the widget columns decide which metrics to show:

```json
[
  {
    "id": "Symbol",
    "kind": "asset-field",
    "label": "Symbol",
    "field": "symbol",
    "width": 86
  },
  {
    "id": "sector",
    "kind": "asset-field",
    "label": "Sector",
    "field": "sector",
    "width": 130,
    "groupable": true
  },
  {
    "id": "last",
    "kind": "latest-value",
    "label": "Last",
    "valueField": "price",
    "format": "price",
    "width": 96
  },
  {
    "id": "oneDayComputed",
    "kind": "latest-value",
    "label": "1D %",
    "valueField": "oneDayReturn",
    "format": "percent",
    "width": 86
  },
  {
    "id": "oneMonthReturn",
    "kind": "return",
    "label": "1M",
    "referenceKey": "oneMonthAgo",
    "valueField": "price",
    "returnMode": "percent",
    "format": "percent",
    "width": 76
  },
  {
    "id": "ytdReturn",
    "kind": "return",
    "label": "YTD",
    "referenceKey": "yearStart",
    "valueField": "price",
    "returnMode": "percent",
    "format": "percent",
    "width": 76
  },
  {
    "id": "oneYearReturn",
    "kind": "return",
    "label": "1Y",
    "referenceKey": "oneYearAgo",
    "valueField": "price",
    "returnMode": "percent",
    "format": "percent",
    "width": 76
  },
  {
    "id": "trend",
    "kind": "sparkline",
    "label": "Trend",
    "valueField": "price",
    "width": 118
  }
]
```

## explicitFieldMappingsExample

If a frame cannot include `meta.marketAsset`, configure equivalent widget field mappings for the
identity and latest-value parts of the snapshot. Inline references and sparklines should still use
metadata because explicit mappings do not carry `referenceKey`, encoding, or order:

```json
{
  "seed": {
    "assetKeyField": "unique_identifier",
    "symbolField": "Symbol",
    "sectorField": "sector",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price",
      "volume": "volume"
    }
  },
  "live": {
    "assetKeyField": "unique_identifier",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price",
      "volume": "volume"
    }
  }
}
```
