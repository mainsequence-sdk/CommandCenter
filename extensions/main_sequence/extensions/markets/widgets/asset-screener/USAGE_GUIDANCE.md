## buildPurpose

Renders a dense Main Sequence Markets asset screener from generic `core.tabular_frame@v1` inputs
annotated with Markets asset semantics for latest snapshots, named reference points, bounded
history series, compact inline sparkline cells, computed table columns, and live latest updates.

## whenToUse

- Use when a workspace needs a terminal-style asset table with latest values, dynamic metric
  columns, return columns, grouping, sorting, compact trend sparklines, and live recalculation.
- Use when latest values, historical baselines, history-series rows, and live updates arrive from
  generic tabular source widgets instead of a screener-specific connection.
- Use when the source can provide stable `assetKey`, `valueKey`, and `observedAt` semantics through
  `meta.marketAsset` field roles or explicit widget field mappings.
- Use when a generic table needs widget-side calculations such as `1D % = (last_price /
  previous_close - 1) * 100` through `meta.tableTransforms`, without creating a screener-specific
  connection.

## whenNotToUse

- Do not use as a backend data source. It does not query connections or open WebSockets.
- Do not create a special Asset Screener connection contract. Connections should publish generic
  `core.tabular_frame@v1`; this widget owns the market semantics.
- Do not use for a one-off generic table without asset/reference/history semantics; use the core
  Table widget instead.

## authoringSteps

- Bind latest snapshot rows to `seedData` from a `dataset` output using the exact snapshot shape
  shown in `seedDataSnapshotExample`; include inline fields such as `previous_close` and
  `price_sparkline` when the source can return them cheaply.
- Bind named historical baselines to `referenceData` from a `dataset` output using the exact
  reference-point shape shown in `referenceDataExample` when baselines are not already carried as
  inline `referenceValue` fields on `seedData`.
- Optionally bind bounded historical series rows to `historyData` from a `dataset` output using the
  exact history-series shape shown in `historyDataExample`; sparkline columns read this lane first.
  For low-resolution terminal sparklines, prefer an inline CSV or number-array cell marked as
  `sparklineSeries` on `seedData`.
- Optionally bind WebSocket or incremental latest rows to `liveUpdates` from an `updates` output
  using the exact live-update shape shown in `liveUpdatesExample`.
- Add `meta.tableTransforms.computedColumns` when a displayed metric should be derived client-side
  from fields in the same incoming row.
- Configure columns dynamically. Columns are view configuration over stable semantic `valueKey`s,
  for example `price`, `volume`, `marketCap`, or `peRatio`.

## blockingRequirements

- Every lane must expose a stable asset key through `meta.marketAsset.fieldRoles` role `assetKey`
  or an explicit `assetKeyField` mapping.
- Every numeric measure used by a latest, return, reference, or sparkline column must be declared as
  role `value` with a stable `valueKey`, or mapped in `valueFields`.
- `referenceData` rows must expose a stable `referenceKey` such as `previousClose`, `oneMonthAgo`,
  `yearStart`, or `oneYearAgo`, unless the same baseline is carried as an inline `referenceValue`
  field on `seedData`.
- `historyData` rows must expose `observedAt` or `sequence` so the sparkline has an ordering. Inline
  `sparklineSeries` fields are already ordered by their encoded array or CSV order.
- `meta.tableTransforms.computedColumns` expressions can only reference fields present in the same
  incoming row after tabular normalization.
- `liveUpdates` must use the same `assetKey` and `valueKey` semantics as `seedData`; a live price
  update is just the newest `valueKey: "price"` observation for that asset.

## commonPitfalls

- Do not bind historical baselines to `liveUpdates`; live updates mutate latest state only.
- Do not rely on display symbols as unique identifiers unless the source universe guarantees they
  are unique; prefer provider asset ids as `assetKey`.
- Do not hardcode one fixed column pack in source data. Add metrics as semantic `valueKey`s and let
  the widget column config choose what to render.
- Missing reference points affect only dependent return columns; missing history points affect only
  sparkline columns.
- Do not send high-resolution intraday history in one cell. Inline `sparklineSeries` is for compact
  visual context; bind `historyData` for larger ordered series.
- Computed columns are row-local. If a live update does not include `previous_close`, the widget can
  still calculate return columns from `referenceData`, but `meta.tableTransforms` on that live frame
  cannot read fields that are not present in the live row.

## semanticRelationship

The stable relationship is `assetKey + valueKey + observedAt/sequence`.

- `seedData` initializes latest values by `assetKey` and `valueKey`.
- `referenceData` supplies named baselines by `assetKey`, `referenceKey`, and `valueKey`.
- `historyData` supplies ordered series by `assetKey`, `valueKey`, and `observedAt`.
- `liveUpdates` patches latest values by `assetKey` and `valueKey`.
- `meta.tableTransforms` runs before market semantic adaptation, so computed fields can be declared
  as normal `value` roles in `meta.marketAsset.fieldRoles`.
- `referenceValue` fields on `seedData` create inline named baselines such as `previousClose`.
- `sparklineSeries` fields on `seedData` create compact ordered history points from CSV strings,
  JSON number arrays, or number arrays.
- Return columns compare latest `valueField` against `referenceData` with the same `valueKey`.
- Sparkline columns render `historyData` for the same `valueKey`; if no history lane is bound, they
  use inline `sparklineSeries` history when present, then may fall back to ordered reference points
  plus latest.

## metadataCapabilities

The widget understands three optional metadata blocks on any bound `core.tabular_frame@v1` frame.
These blocks are interpreted by the Asset Screener only. They are not new connection output
contracts.

### `meta.marketAsset`

Use `meta.marketAsset` to describe market semantics for generic table columns:

```json
{
  "marketAsset": {
    "role": "snapshot",
    "fieldRoles": [
      { "field": "asset_id", "role": "assetKey" },
      { "field": "time", "role": "observedAt" },
      { "field": "last_price", "role": "value", "valueKey": "price" }
    ]
  }
}
```

Supported frame roles:

- `snapshot`: latest seed rows and live update rows.
- `reference-points`: long-form historical reference rows.
- `history-series`: bounded ordered history rows.

Supported field roles:

- Identity roles: `assetKey`, `symbol`, `displayName`, `exchange`, `currency`, `country`,
  `assetClass`, `sector`, `industry`, `group`, `tags`.
- Observation roles: `observedAt`, `sequence`, `quality`.
- Reference roles: `referenceKey`, `referenceLabel`, `referenceKind`, `offsetUnit`, `offsetValue`.
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
over naming heuristics.

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
- Computations are row-local only; they cannot read referenceData, historyData, previous rows, or
  backend state.
- Missing or non-numeric operands produce `null` for numeric operations.
- Division by zero produces `null`.

### `meta.tableVisuals`

Use `meta.tableVisuals.columns` to attach display hints to source or computed fields:

```json
{
  "tableVisuals": {
    "columns": {
      "one_day_return": {
        "format": "percent",
        "colorScale": {
          "negative": "red",
          "neutral": "muted",
          "positive": "green"
        },
        "range": {
          "min": -10,
          "max": 10,
          "midpoint": 0
        }
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

Supported visual fields:

- `format`: `number`, `price`, `percent`, `volume`, or `currency`.
- `kind`: `sparkline`, `bar`, or `heatmap`.
- `encoding`: `csv-number`, `json-number-array`, or `number-array`.
- `order`: `oldest-to-newest` or `newest-to-oldest`.
- `colorScale.negative`, `colorScale.neutral`, and `colorScale.positive`.
- `range.min`, `range.max`, `range.midpoint`, and `range.clamp`.

Current renderer behavior:

- `format` can supply the display format when the widget column does not specify one.
- `colorScale` can supply positive, negative, and neutral value tone for numeric value columns.
- `range`, `kind: "bar"`, and `kind: "heatmap"` are preserved in the runtime model for Markets
  widgets, but the first screener renderer does not yet draw bar or heatmap cells.
- For inline sparkline parsing, put `encoding` and `order` on the `sparklineSeries` field role in
  `meta.marketAsset`; duplicate them in `tableVisuals` only as display/readability guidance.

## seedDataSnapshotExample

Bind this to `seedData` from a `dataset` output:

```json
{
  "status": "ready",
  "columns": [
    "asset_id",
    "symbol",
    "display_name",
    "sector",
    "time",
    "last_price",
    "previous_close",
    "volume",
    "price_sparkline"
  ],
  "rows": [
    {
      "asset_id": "asset:AAPL",
      "symbol": "AAPL",
      "display_name": "Apple Inc.",
      "sector": "Technology",
      "time": "2026-05-16T13:00:00.000Z",
      "last_price": 110,
      "previous_close": 100,
      "volume": 42000000,
      "price_sparkline": "101,104,106,108,107,110"
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "snapshot",
      "fieldRoles": [
        { "field": "asset_id", "role": "assetKey" },
        { "field": "symbol", "role": "symbol" },
        { "field": "display_name", "role": "displayName" },
        { "field": "sector", "role": "sector" },
        { "field": "time", "role": "observedAt" },
        { "field": "last_price", "role": "value", "valueKey": "price" },
        { "field": "volume", "role": "value", "valueKey": "volume" },
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
        },
        { "field": "one_day_return", "role": "value", "valueKey": "oneDayReturn" }
      ]
    },
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
    },
    "tableVisuals": {
      "columns": {
        "one_day_return": {
          "format": "percent",
          "colorScale": {
            "negative": "red",
            "neutral": "muted",
            "positive": "green"
          },
          "range": {
            "min": -10,
            "max": 10,
            "midpoint": 0
          }
        },
        "price_sparkline": {
          "kind": "sparkline",
          "encoding": "csv-number",
          "order": "oldest-to-newest"
        }
      }
    }
  }
}
```

## referenceDataExample

Bind this to `referenceData` from a `dataset` output:

```json
{
  "status": "ready",
  "columns": ["asset_id", "reference_key", "observed_at", "close"],
  "rows": [
    {
      "asset_id": "asset:AAPL",
      "reference_key": "previousClose",
      "observed_at": "2026-05-15T20:00:00.000Z",
      "close": 100
    },
    {
      "asset_id": "asset:AAPL",
      "reference_key": "oneMonthAgo",
      "observed_at": "2026-04-16T20:00:00.000Z",
      "close": 96
    },
    {
      "asset_id": "asset:AAPL",
      "reference_key": "yearStart",
      "observed_at": "2026-01-02T20:00:00.000Z",
      "close": 88
    },
    {
      "asset_id": "asset:AAPL",
      "reference_key": "oneYearAgo",
      "observed_at": "2025-05-16T20:00:00.000Z",
      "close": 82
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "reference-points",
      "fieldRoles": [
        { "field": "asset_id", "role": "assetKey" },
        { "field": "reference_key", "role": "referenceKey" },
        { "field": "observed_at", "role": "observedAt" },
        { "field": "close", "role": "value", "valueKey": "price" }
      ]
    }
  }
}
```

## historyDataExample

Bind this to `historyData` from a `dataset` output:

```json
{
  "status": "ready",
  "columns": ["asset_id", "symbol", "observed_at", "close"],
  "rows": [
    {
      "asset_id": "asset:AAPL",
      "symbol": "AAPL",
      "observed_at": "2026-05-10T20:00:00.000Z",
      "close": 101
    },
    {
      "asset_id": "asset:AAPL",
      "symbol": "AAPL",
      "observed_at": "2026-05-11T20:00:00.000Z",
      "close": 104
    },
    {
      "asset_id": "asset:AAPL",
      "symbol": "AAPL",
      "observed_at": "2026-05-12T20:00:00.000Z",
      "close": 106
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "history-series",
      "fieldRoles": [
        { "field": "asset_id", "role": "assetKey" },
        { "field": "symbol", "role": "symbol" },
        { "field": "observed_at", "role": "observedAt" },
        { "field": "close", "role": "value", "valueKey": "price" }
      ]
    }
  }
}
```

## liveUpdatesExample

Bind this to `liveUpdates` from an `updates` output:

```json
{
  "status": "ready",
  "columns": ["asset_id", "time", "last_price", "volume"],
  "rows": [
    {
      "asset_id": "asset:AAPL",
      "time": "2026-05-16T13:01:00.000Z",
      "last_price": 112,
      "volume": 42100000
    }
  ],
  "meta": {
    "marketAsset": {
      "role": "snapshot",
      "fieldRoles": [
        { "field": "asset_id", "role": "assetKey" },
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
    "id": "last",
    "kind": "latest-value",
    "label": "Last",
    "valueField": "price",
    "format": "price",
    "width": 96
  },
  {
    "id": "volume",
    "kind": "latest-value",
    "label": "Volume",
    "valueField": "volume",
    "format": "volume",
    "width": 110
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
    "id": "trend",
    "kind": "sparkline",
    "label": "Trend",
    "valueField": "price",
    "width": 118
  }
]
```

## explicitFieldMappingsExample

If a frame cannot include `meta.marketAsset`, configure equivalent widget field mappings:

```json
{
  "seed": {
    "assetKeyField": "asset_id",
    "symbolField": "symbol",
    "sectorField": "sector",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price",
      "volume": "volume"
    }
  },
  "reference": {
    "assetKeyField": "asset_id",
    "referenceKeyField": "reference_key",
    "observedAtField": "observed_at",
    "valueFields": {
      "price": "close"
    }
  },
  "history": {
    "assetKeyField": "asset_id",
    "observedAtField": "observed_at",
    "valueFields": {
      "price": "close"
    }
  },
  "live": {
    "assetKeyField": "asset_id",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price",
      "volume": "volume"
    }
  }
}
```
