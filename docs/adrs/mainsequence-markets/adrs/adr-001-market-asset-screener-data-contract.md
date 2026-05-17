# ADR 001: Market Asset Screener Data Contract

- Status: Accepted
- Date: 2026-05-16
- Updated: 2026-05-17
- Related:
  - [ADR: Connection-First Workspace Dataflow](../../../adr/command_center/adr-connection-first-workspace-dataflow.md)
  - [ADR: Standardized Connection Result Contracts](../../../adr/command_center/adr-standardized-connection-result-contracts.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](../../../adr/command_center/adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](../../../adr/command_center/adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](../../../adr/command_center/adr-041-connection-query-websocket-streaming.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](../../../adr/command_center/adr-managed-connection-query-widget-sources.md)

## Context

Main Sequence Markets needs an `Asset Screener` widget that behaves like a real market terminal
screen: a dense, grouped table of assets with latest values, return columns, historical comparison
columns, status, and optional compact inline visuals.

The screener must support two runtime modes:

- refresh mode, where an existing HTTP or cached source publishes the full snapshot
- live mode, where a WebSocket or incremental source publishes latest updates after the snapshot

The widget must not force a special Markets connection type. Existing source widgets should keep
publishing generic `core.tabular_frame@v1` data. The screener owns the market interpretation of
those rows.

The important correction in this ADR is that the visual widget has two public inputs only. Earlier
drafts described separate public lanes for historical baselines and history series. That was the
wrong contract for this widget because it leaks screener internals into workspace bindings and
creates needless graph complexity. Baselines and low-resolution trend points belong inside the
snapshot table metadata.

## Decision

Markets will introduce a shared market screener data model, but the `Asset Screener` widget exposes
only two public input roles:

1. `seedData`: full semantic snapshot
2. `liveUpdates`: optional latest incremental updates

The `seedData` frame carries:

- asset identity, grouping fields, and display metadata
- latest values such as `last_price`, `volume`, `marketCap`, or `peRatio`
- inline `referenceValue` fields for baselines such as `previousClose`, `oneMonthAgo`,
  `yearStart`, and `oneYearAgo`
- inline `sparklineSeries` fields for compact trend visuals
- optional row-local computed fields produced by `meta.tableTransforms`

The `liveUpdates` frame carries partial latest-value updates keyed by the same asset semantics.
Live updates patch current state only. They do not rewrite seeded references or seeded sparklines.

The screener derives its rendered rows from those two inputs:

```text
seedData    -> asset identity + latest state + inline references + inline sparklines
liveUpdates -> latestByAssetKey incremental patches

latest + seeded references + seeded sparkline points + column definitions -> rendered rows
```

The `Asset Screener` widget is a passive consumer. It does not open backend requests or WebSocket
sessions directly. Connection Query, Connection Stream Query, Tabular Transform, and future
managed connection-source helpers remain the execution owners.

## Scope

In scope:

- frontend input roles for the Asset Screener widget
- reusable market asset identity and value-point structures
- inline reference-point semantics for return calculations
- inline sparkline semantics for compact trend cells
- how HTTP snapshots and WebSocket updates compose
- backend and registry impact assessment
- implementation checklist

Out of scope:

- implementing backend adapters
- selecting exact visual styling
- adding a new WebSocket transport
- adding a new persistence model for runtime data
- making the screener fetch data directly
- creating a provider-specific Markets connection type for this widget

## Widget Input Roles

### `seedData`

Purpose:

- provide the latest known current values when the widget first renders
- support refresh-only workspaces without WebSocket bindings
- provide asset identity and display metadata
- provide seeded historical baselines used by return columns
- provide compact seeded sparkline points used by trend columns

Accepted source outputs:

- retained `dataset` from `connection-query`
- retained `dataset` from `tabular-transform`
- incremental `updates` with `publicationRole: "seed"`
- any compatible `core.tabular_frame@v1`

Required logical fields:

- asset join key
- at least one latest value field, usually price or last

Optional logical fields:

- latest observation time
- symbol, display name, exchange, currency, sector, industry, country, group, or tags
- inline `referenceValue` fields such as `previous_close`, `one_month_ago`, `year_start`, or
  `one_year_ago`
- inline `sparklineSeries` fields such as a CSV number cell for low-resolution terminal sparklines
- computed fields produced by `meta.tableTransforms.computedColumns`

### `liveUpdates`

Purpose:

- apply latest price, quote, trade, volume, status, or other value updates after the seed has
  rendered
- recalculate return columns against the stable seeded baselines

Accepted source outputs:

- explicit `updates` output from `connection-stream-query`
- explicit `updates` output from an HTTP incremental `connection-query`
- future source outputs that publish compatible `core.tabular_frame@v1` update rows

Rules:

- live updates are partial-row updates keyed by asset
- live updates mutate latest state only
- live updates must not mutate seeded reference state
- live updates must not mutate seeded sparkline history unless a future column explicitly opts into
  appending the latest point for display

## Shared Frontend Data Structures

The implementation should define these structures in a Markets shared module before implementing
the widget. The module should live under the Markets extension rather than in a single widget folder
when another Markets widget can reuse it.

### Asset Identity

```ts
type MarketAssetKey = string;

interface MarketAssetIdentity {
  assetKey: MarketAssetKey;
  symbol?: string;
  displayName?: string;
  exchange?: string;
  currency?: string;
  country?: string;
  assetClass?: string;
  sector?: string;
  industry?: string;
  group?: string;
  tags?: string[];
}
```

Rules:

- `assetKey` is the stable join key across seed rows and live update rows.
- `symbol` is display-only and must not be assumed unique across venues.
- If a backend source has a canonical asset id, that id should become `assetKey`.
- When only a symbol is available, the field mapping must explicitly choose it as `assetKey`.

### Market Value Point

```ts
interface MarketAssetValuePoint {
  assetKey: MarketAssetKey;
  observedAtMs?: number;
  sequence?: number | string;
  sourceRunId?: string;
  values: Record<string, number | string | boolean | null>;
  quality?: "exact" | "prior" | "next" | "interpolated" | "stale" | "unknown";
  diagnostics?: string[];
}
```

Rules:

- `values` stores normalized measure names such as `price`, `last`, `close`, `bid`, `ask`,
  `volume`, `marketCap`, `open`, `high`, and `low`.
- Numeric calculations only use numeric values.
- Partial live updates merge into the latest point for the same asset.
- `quality` is surfaced in warnings and tooltips when values are not exact.

### Reference Point

```ts
interface MarketAssetReferencePoint extends MarketAssetValuePoint {
  referenceKey: string;
  referenceLabel?: string;
  referenceKind:
    | "previous-close"
    | "relative-offset"
    | "calendar-period-start"
    | "custom";
  offset?: {
    unit: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year";
    value: number;
  };
}
```

Rules:

- Reference points are runtime objects derived from inline `referenceValue` seed fields.
- Reference keys are stable formula identifiers, not display labels.
- Examples: `previousClose`, `oneWeekAgo`, `oneMonthAgo`, `quarterStart`, `yearStart`,
  `oneYearAgo`, `custom:<id>`.
- The display label can be `1D`, `1W`, `1M`, `QTD`, `YTD`, or `1Y`, but formulas use the stable
  reference key.

### Screener Runtime Model

```ts
interface MarketAssetScreenerRuntimeModel {
  schemaVersion: "market.asset_screener_runtime@v1";
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>;
  latestByKey: Record<MarketAssetKey, MarketAssetValuePoint>;
  referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>;
  historyByKey?: Record<MarketAssetKey, MarketAssetValuePoint[]>;
  sourceState: {
    seedRunId?: string;
    liveRunId?: string;
    lastSeedAtMs?: number;
    lastLiveAtMs?: number;
  };
  warnings: string[];
}
```

This model is frontend runtime state, not persisted workspace storage. Large frames should stay in
the runtime data store when available; widget runtime state should carry refs and summary metadata
instead of large row arrays.

## Derived Row Model

The rendered screener rows are derived, not fetched.

```ts
interface MarketAssetScreenerRow {
  asset: MarketAssetIdentity;
  latest: MarketAssetValuePoint | null;
  references: Record<string, MarketAssetReferencePoint | undefined>;
  metrics: Record<string, number | string | boolean | null>;
  status: "ready" | "missing-latest" | "missing-reference" | "stale" | "error";
  diagnostics: string[];
}
```

Example formulas:

```ts
netChange(referenceKey, valueField) =
  latest.values[valueField] - references[referenceKey].values[valueField]

percentChange(referenceKey, valueField) =
  (latest.values[valueField] / references[referenceKey].values[valueField] - 1) * 100
```

Rules:

- Missing latest values produce `missing-latest`.
- Missing seeded reference values produce `missing-reference` for affected columns only.
- Division by zero returns `null` plus a diagnostic.
- Stale latest data is a row status, not a reason to discard seeded references.
- Sorting and filtering use derived values after formula evaluation.

## Column Configuration Model

The screener should support a reusable column definition model that can power other Markets table
visualizations.

```ts
type MarketAssetScreenerColumn =
  | {
      id: string;
      kind: "asset-field";
      label: string;
      field: keyof MarketAssetIdentity | string;
      width?: number;
      groupable?: boolean;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "latest-value";
      label: string;
      valueField: string;
      format?: "number" | "price" | "percent" | "volume" | "currency";
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "reference-value";
      label: string;
      referenceKey: string;
      valueField: string;
      format?: "number" | "price" | "percent" | "volume" | "currency";
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "return";
      label: string;
      referenceKey: string;
      valueField: string;
      returnMode: "absolute" | "percent";
      format?: "number" | "price" | "percent" | "volume" | "currency";
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "sparkline";
      label: string;
      valueField: string;
      historyKey?: string;
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    };
```

Default columns for the first Asset Screener should be configurable but should map naturally to a
terminal-style view:

- symbol or asset name
- compact trend/sparkline when seeded sparkline data is available
- latest price
- net change vs previous close
- percent change vs previous close
- YTD return
- 1M return
- 1Y return
- currency, sector, industry, or group columns as optional grouping fields

### Source-Driven Column Configuration

The backend or upstream source may drive the default visible column configuration through the same
generic frame metadata that already defines semantics and visuals. This keeps the data source
opinionated enough to render a useful screener immediately, while preserving local instance
overrides in the widget settings UI.

Rules:

- `columnConfigMode: "source"` is the default for the Asset Screener.
- In source mode, the widget derives settings-visible columns from:
  - `meta.tableVisuals.columns`
  - `meta.marketAsset.fieldRoles`, when present
  - `meta.tableTransforms.computedColumns`
- `meta.tableVisuals.columns` is the source's explicit column proposal. Its keys must match source
  field ids or computed column ids such as `last_price`, `one_day_return`, or `sparkline_prices`.
- `meta.tableVisuals.columns` is independently sufficient to populate the settings column list.
  `meta.marketAsset` improves semantic mapping, but the presence of market field-role metadata must
  not be required just to show the source's table column configuration.
- `meta.marketAsset.fieldRoles` may derive source columns for asset identity fields, latest value
  fields, and sparkline series when `meta.tableVisuals.columns` is absent. Reference-value fields
  are calculation inputs and must not become visible columns unless the source explicitly proposes
  them through `meta.tableVisuals.columns`.
- If neither source metadata nor an instance override proposes columns, the widget renders a
  no-source-columns state. It must not invent a predefined Symbol/Name/Trend/Last/return layout.
- Source-derived columns are shown in settings as the normal column JSON model, but are read-only
  while source mode is active.
- Source visual metadata is copied onto each derived column's `visual` property, so table visual
  behavior, ranges, compact encodings, and labels are visible in settings and can be edited after
  copying to an instance override.
- Switching to instance override copies the current effective source columns into the widget's
  persisted `columns` prop and sets `columnConfigMode: "custom"`.
- Instance override wins over future source metadata until the user switches back to source mode.
- Explicit field mappings still win for semantic interpretation. Source column metadata only
  chooses what to render and how to format it.
- Asset Screener renders through the shared core table frame view. Source visual metadata must
  therefore map to table-native concepts: column overrides, conditional threshold rules, visual
  ranges, data bars, heatmaps, and optional custom cells such as sparkline cells. `colorScale`
  remains only a compatibility shorthand that can be converted into table conditional rules.
- The shared table frame must be used in screener mode: floating per-column filters disabled and a
  transparent workspace surface. The generic Table widget can keep its card-like table controls;
  the Asset Screener must not visually degrade into a nested generic table.

This is not a new backend connection contract. It is optional metadata inside an ordinary
`core.tabular_frame@v1` payload. Backend adapters may provide it when they know the desired table
shape; widget authors may override it per instance without changing the source.

Backend-driven source config example:

```json
{
  "status": "ready",
  "columns": [
    "unique_identifier",
    "ticker",
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
      "ticker": "AAPL",
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
      "ticker": "MSFT",
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
        { "field": "ticker", "role": "symbol" },
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
        "last_price": { "format": "price" },
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

## Internal Semantic Evaluation

The first implementation accepts `core.tabular_frame@v1` on both screener inputs. Asset, reference,
and history semantics are internal to the widget and are selected by the bound input role plus
explicit field mappings or internal field-role metadata.

The widget must not require sources or connections to advertise market-specific output contracts.

### Snapshot Semantics

One row per asset for one latest/current observation.

Required logical fields after widget mapping:

- `assetKey`
- at least one numeric value field

Optional logical fields after widget mapping:

- `observedAt`
- `symbol`
- `displayName`
- `exchange`
- `currency`
- `assetClass`
- `sector`
- `industry`
- `country`
- `sequence`
- inline references via `referenceValue`
- inline sparklines via `sparklineSeries`

### Inline Reference Semantics

One seed row may carry multiple named historical reference values.

Required field-role attributes:

- `role: "referenceValue"`
- `referenceKey`
- `valueKey`

Example fields:

- `previous_close` -> `referenceKey: "previousClose"`, `valueKey: "price"`
- `one_month_ago` -> `referenceKey: "oneMonthAgo"`, `valueKey: "price"`
- `year_start` -> `referenceKey: "yearStart"`, `valueKey: "price"`
- `one_year_ago` -> `referenceKey: "oneYearAgo"`, `valueKey: "price"`

### Inline Sparkline Semantics

One seed row may carry a compact ordered series for terminal-style trends.

Required field-role attributes:

- `role: "sparklineSeries"`
- `valueKey`

Supported encodings:

- `csv-number`
- `json-number-array`
- `number-array`

Rules:

- Inline sparklines are for compact visual context.
- They are not a replacement for a chart-grade historical data source.
- The order is oldest-to-newest unless `order: "newest-to-oldest"` is provided.

### Row-Local Table Metadata

The screener may read two generic table metadata blocks before it applies Markets semantics:

```ts
interface MarketTableTransformsMetadata {
  computedColumns?: Array<{
    id: string;
    label?: string;
    type?: "number" | "string" | "boolean" | "json";
    expression:
      | { field: string }
      | { value: number | string | boolean | null }
      | { op: "percentChange"; current: MarketTableExpression; reference: MarketTableExpression }
      | { op: "difference" | "subtract"; left: MarketTableExpression; right: MarketTableExpression }
      | { op: "ratio" | "divide"; numerator: MarketTableExpression; denominator: MarketTableExpression }
      | { op: "add" | "multiply"; args: MarketTableExpression[] };
  }>;
}

interface MarketTableVisualsMetadata {
  columns?: Record<string, {
    label?: string;
    format?: "number" | "price" | "percent" | "volume" | "currency";
    kind?: "sparkline" | "bar" | "heatmap";
    encoding?: "csv-number" | "json-number-array" | "number-array";
    order?: "oldest-to-newest" | "newest-to-oldest";
    thresholds?: Array<{
      id?: string;
      operator: "gt" | "gte" | "lt" | "lte" | "eq";
      value: number;
      tone?: "neutral" | "primary" | "success" | "warning" | "danger";
      textColor?: string;
      backgroundColor?: string;
    }>;
    heatmap?: boolean;
    barMode?: "none" | "fill";
    gradientMode?: "none" | "fill";
    heatmapPalette?: "auto" | "viridis" | "plasma" | "inferno" | "magma" | "turbo" | "jet" | "blue-white-red" | "red-yellow-green";
    gaugeMode?: "none" | "ring";
    visualRangeMode?: "auto" | "fixed";
    visualMin?: number;
    visualMax?: number;
    // Legacy compatibility only. Prefer thresholds for new payloads.
    colorScale?: {
      negative?: "warning" | "danger" | string;
      neutral?: "muted" | string;
      positive?: "success" | string;
    };
    range?: { min?: number; max?: number; midpoint?: number; clamp?: boolean };
    width?: number;
  }>;
}
```

Rules:

- Explicit widget field mappings take precedence over Markets metadata. Markets metadata takes
  precedence over field-name heuristics.
- `meta.marketAsset.fieldRoles` supports inline `referenceValue` and `sparklineSeries` roles in
  addition to normal identity, observation, and value roles.
- Computed columns are row-local and deterministic; they do not query backend state or other
  bindings.
- Computed columns run before `meta.marketAsset.fieldRoles`, so derived fields can become normal
  semantic `valueKey`s.
- Supported transform operations are `percentChange`, `difference`/`subtract`, `ratio`/`divide`,
  `add`, and `multiply`, plus literal field/value expressions.
- Missing operands, non-numeric operands in numeric operations, and division by zero resolve to
  `null`.
- Visual metadata is guidance for the Markets widget, not a new connection output contract.
- The Asset Screener is a table-backed market adapter. It derives market rows, schema, table column
  overrides, conditional rules, and sparkline cell renderers, then delegates rendering to the core
  table frame view.
- Visual `format`, ranges, `kind: "bar"`, and `kind: "heatmap"` are mapped into the table frame's
  formatting, visual-range, data-bar, and heatmap behavior.
- In `columnConfigMode: "source"`, visual metadata decides which source/computed fields become
  visible columns even when `meta.marketAsset` is absent. Instance `columns` overrides remain
  normal widget props.

## Source Shape Requirements

The screener must adapt to the data shape produced by existing connection sources. The widget does
not require a special Markets connection type, and this ADR does not require changing a connection
query model just for the screener.

The required source shapes are semantic roles, not provider-specific operations:

- full latest snapshot rows -> bind to `seedData`
- incremental latest rows -> bind to `liveUpdates`

Any existing `Connection Query`, `Connection Stream Query`, `Tabular Transform`, SQL adapter, API
adapter, or future source can feed the screener when it publishes compatible tabular rows.

The widget accepts `core.tabular_frame@v1` and evaluates each bound frame against the widget's
internal semantics. Explicit field mappings are the primary contract. Internal field-role metadata
may reduce mapping work inside the widget, but it is widget-side interpretation metadata, not a
connection output contract.

When a source can produce a richer table, it may put calculation and visual intent in frame `meta`
instead of changing its connection contract. Example: a normal latest snapshot frame can include
`last_price`, `previous_close`, `one_month_ago`, `year_start`, `one_year_ago`, and
`sparkline_prices`; `meta.tableTransforms` derives `oneDayReturn`; `meta.marketAsset` marks the
baseline fields as inline references and `sparkline_prices` as an inline ordered series.

Representative `seedData` row shape:

```ts
interface MarketAssetSeedRow {
  unique_identifier: string;
  ticker: string;
  sector?: string;
  time?: string | number;
  last_price: number;
  previous_close?: number;
  one_month_ago?: number;
  year_start?: number;
  one_year_ago?: number;
  volume?: number;
  sparkline_prices?: string | number[];
}
```

Representative generic field mappings:

```json
{
  "seed": {
    "assetKeyField": "unique_identifier",
    "symbolField": "ticker",
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

Backend adapters own:

- whatever query semantics that adapter already supports
- selecting exact or nearest historical points when the adapter chooses to include baselines in the
  snapshot table
- permission checks
- cache and in-flight dedupe
- response normalization into `core.tabular_frame@v1`

The widget owns:

- field mapping fallback for generic tabular frames
- joining by asset key
- adapting inline references and inline sparklines from seed metadata
- applying live updates to latest state
- calculating configured columns
- rendering, sorting, filtering, grouping, and row diagnostics

Rules:

- Do not create a provider-specific connection only for this widget.
- Do not force existing connections to change their advertised output contracts before they can
  feed the screener.
- Do not couple the screener to a connection type id.
- If a source can only produce generic rows, use explicit field mappings for identity and latest
  values and metadata for references/sparklines.
- The screener may auto-map fields from its own internal role metadata, explicit mapping config,
  and stable naming heuristics.

## Managed Connection Authoring

The long-term authoring flow may allow the user to pick an existing connection and have the
screener bind the needed source roles without exposing transport details in the visual widget. That
must remain a convenience over the normal graph, not a new connection requirement.

This should still compile down to normal graph nodes and bindings:

```text
Connection Query: full snapshot       -> Asset Screener.seedData
Connection Stream Query: latest ticks -> Asset Screener.liveUpdates
```

Rules:

- The visual widget must not persist endpoint URLs, tokens, or raw backend route fragments.
- If hidden managed source widgets are used, they must remain normal execution-owner widgets.
- The screener settings may expose a single guided connection setup, but saved workspace bindings
  must still be inspectable as standard widget graph edges.
- Do not create one hidden source per reference column when one normal snapshot source can carry
  multiple baseline fields.

## Owned Connection Source Mode

The Asset Screener may support the same owned-connection authoring pattern already used by Graph.
This means the visible screener can own one or more hidden source widgets created through the
shared managed-connection consumer lifecycle.

This does not change the two-input visual contract. The screener still renders from:

- `seedData`
- `liveUpdates`

The owned connection only creates and maintains the upstream source widgets that publish those
inputs.

Allowed source modes:

- `bound`: the default mode. The user binds existing upstream widgets to `seedData` and optional
  `liveUpdates`.
- `connection`: the screener owns one hidden `connection-query` widget. Its `dataset` output binds
  to `seedData`.
- `connection-stream`: the screener owns live source execution. The resulting graph must still bind
  a full semantic snapshot into `seedData` and incremental updates into `liveUpdates`.

The `connection-stream` mode has stricter requirements than Graph because the screener needs seeded
reference values and sparklines before live ticks are useful. It may be represented in either of
these ways:

1. A single hidden `connection-stream-query` publishes both:
   - `dataset` -> `seedData`
   - `updates` -> `liveUpdates`
2. A paired managed source set publishes:
   - hidden `connection-query.dataset` -> `seedData`
   - hidden `connection-stream-query.updates` -> `liveUpdates`

The first option is valid only when the stream source's retained `dataset` has the full semantic
snapshot shape required by `seedData`, including inline `referenceValue` and `sparklineSeries`
metadata when configured columns need them. If the stream source only publishes latest ticks, the
second option is required.

Implementation rules:

- Use the shared managed-connection consumer adapter pattern rather than a screener-local
  connection executor.
- The hidden source widget owns backend requests, WebSocket sessions, runtime status, reconnect
  supervision, and response normalization.
- The visible screener remains a consumer. It must not call `queryConnection`, request WebSocket
  tickets, or open a socket from the renderer or settings preview.
- Hidden managed source widgets must be marked with `managedBy.role: "embedded-connection-source"`
  and remain visible in graph/debug surfaces that intentionally reveal managed nodes.
- Saved workspace bindings must stay canonical graph edges from hidden source outputs to screener
  inputs.
- The owned source mode may persist normalized source-authoring props such as source mode,
  connection reference, selected query model, request parameters, merge-key settings, and hidden
  source presentation. It must not persist credentials, endpoint URLs, raw backend routes, or
  transport secrets on the visible screener.
- Connection testing from the screener settings must publish preview/runtime frames through the
  hidden source widget so the preview resolves through the same `seedData` / `liveUpdates` bindings
  used on the workspace canvas.
- Disabling owned connection mode must detach or clean up the managed source bindings without
  deleting unrelated user-created source widgets.

The owned connection mode is therefore an authoring shortcut, not a data contract shortcut. It can
make the screener feel self-contained like Graph, but the execution and runtime ownership model
stays graph-first.

## UI Implications

The Bloomberg-style screenshot implies a dense operational table, not a marketing card layout.

The visual target should prioritize:

- fixed header and compact rows
- grouped sections by sector, basket, asset class, country, or custom group
- keyboard-friendly table navigation
- fast sort/filter across derived columns
- theme-token value coloring with accessible text fallback
- stale/missing-data indicators that do not shift row height
- optional inline sparkline column when seeded sparkline values exist
- virtualization for large universes

The first screen should be the screener itself. Do not add an explanatory landing page inside the
widget.

## Storage And Backend Contract Impact

Workspace storage impact:

- new widget type props are needed for column definitions, field mappings, grouping, sorting,
  filtering, and staleness policy
- `columnConfigMode` chooses source metadata or instance override. `columns` is persisted only as
  the local override copy when the user wants this widget instance to diverge from source metadata
- new widget bindings include only `seedData` and `liveUpdates`
- owned connection mode, when implemented, adds normalized managed-source authoring props and
  hidden managed source widgets, but the visible screener still stores no connection credentials,
  endpoint URLs, backend routes, or raw transport secrets
- earlier draft workspaces or tests that stored separate baseline/history bindings must be cleaned
  up or migrated because the accepted widget contract no longer exposes those inputs

Backend contract impact:

- backend widget registry validation must understand the new Asset Screener widget id, props, and
  two input roles, including optional `columnConfigMode` and local override `columns`
- if owned connection mode is implemented, backend workspace validation must allow the screener's
  managed-source props and hidden `embedded-connection-source` widgets using the same validation
  model already used by Graph/Table/Statistic managed connection consumers
- no backend connection adapter changes are required for the widget to consume generic tabular
  frames
- no backend connection registry output-contract changes are required or desired for this widget
- backend sources that want to propose a default screener layout may include
  `meta.tableVisuals.columns`, `meta.tableTransforms.computedColumns`, and
  `meta.marketAsset.fieldRoles` in normal `core.tabular_frame@v1` payloads
- backend adapters must continue to enforce their own permissions and source constraints before
  returning data

No backend storage migration is implied for production data unless draft workspaces were already
created with the rejected extra inputs. Implementation should bump the widget version when removing
those public inputs from the registry definition.

## Non-Goals

- Do not make the screener query a backend API directly.
- Do not make the screener open a WebSocket directly.
- Do not store connection secrets or endpoint details in widget props.
- Do not treat owned connection mode as permission to bypass hidden source widgets or canonical
  graph bindings.
- Do not create separate visual widget inputs for historical baselines or compact history.
- Do not create one source widget per calculated column when one snapshot frame can return all
  needed baseline fields.
- Do not make live updates rewrite seeded historical references.
- Do not make WebSocket transport mandatory; refresh-only mode must remain valid.

## Implementation Checklist

Use this checklist when implementation starts.

### Shared Contracts

- [x] Add shared Markets TypeScript types for asset identity, value points, reference points,
  runtime model, rows, and columns.
- [x] Add adapters from `core.tabular_frame@v1` to the shared screener runtime model.
- [x] Add internal field-role metadata for the snapshot role.
- [x] Add internal inline `referenceValue` semantics for snapshot frames.
- [x] Add internal inline `sparklineSeries` semantics for snapshot frames.
- [x] Add row-local `meta.tableTransforms` support for computed screener values.
- [x] Add source-driven column configuration from `meta.tableVisuals` with instance override
  support.

### Connection And Source Integration

- [x] Keep the widget compatible with generic `core.tabular_frame@v1` source outputs.
- [x] Keep Asset Screener semantics internal, not advertised as connection output contracts.
- [x] Keep source binding through normal `Connection Query`, `Connection Stream Query`, and
  `Tabular Transform` graph nodes.
- [x] Verify a refresh-only workspace can bind any existing compatible tabular source to
  `seedData`.
- [x] Verify a live workspace can bind any existing compatible stream source to `liveUpdates`.
- [x] Document example generic field mappings for common seed/live row shapes.
- [x] Document exact seed metadata shape for ticker, sector, last price, 1D, 1M, YTD, 1Y, and
  sparkline columns.
- [x] Add a managed-connection consumer adapter for `ms-markets-asset-screener` if owned
  connection authoring is implemented.
- [ ] Support owned `connection` mode by creating or repairing a hidden `connection-query` source
  bound to `seedData`.
- [ ] Support owned `connection-stream` mode either with one hidden stream source bound to both
  `seedData` and `liveUpdates`, or with paired hidden seed and stream sources.
- [ ] Verify owned connection settings previews resolve through hidden source bindings, not through
  a screener-local connection test result.

### Widget Implementation

- [x] Create the Markets `asset-screener` widget folder.
- [x] Add `README.md` and `USAGE_GUIDANCE.md`.
- [x] Add widget definition with `widgetVersion`, `registryContract`, and two public input roles.
- [x] Implement field mapping and internal field-role auto-mapping.
- [x] Implement seed/live reducer logic without direct backend access.
- [x] Implement inline reference and inline sparkline adaptation from seed metadata.
- [x] Implement dense virtualized table rendering.
- [x] Implement derived return columns.
- [x] Implement grouping, sorting, filtering, and staleness diagnostics.
- [x] Provide demo `mockProps` and `mockRuntimeState` for settings preview.

### Verification

- [x] Refresh-only workspace: seeded snapshot with inline references renders calculated columns.
- [x] Live workspace: latest updates recalculate columns against seeded references.
- [x] Seed source refresh updates historical baselines without reopening the live stream.
- [x] Missing seeded reference data marks affected columns without breaking the row.
- [x] Large universe rendering remains virtualized and does not block widget settings open.
- [x] `npm run check` passes.
- [x] Widget registry sync preview includes the new widget contract and guidance.
