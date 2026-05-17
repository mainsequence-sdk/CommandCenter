# ADR 001: Market Asset Screener Data Contract

- Status: Accepted
- Date: 2026-05-16
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

- refresh mode, where HTTP connection queries publish the latest snapshot and historical reference
  points on workspace refresh
- live mode, where a WebSocket connection publishes latest updates while HTTP connection queries
  provide the historical baselines used for live calculations

The current two-role live consumer model is not enough on its own.

ADR 044 defines:

- `seedData`
- `liveUpdates`

That works for charts such as OHLC where the seed lane is the historical baseline and the live lane
is the current append/update lane. A screener needs two more logical data lanes because it must keep
named historical reference points and bounded trend history separate from latest current state.

Examples:

- latest price from a WebSocket tick
- previous close from an HTTP query
- one month ago price from an HTTP query
- one year ago price from an HTTP query
- year-to-date start price from an HTTP query

The widget must then calculate live columns such as net change, percent change, MTD, YTD, 1M, and
1Y without forcing every market widget to reinvent reference-point joining, field mapping, and
staleness handling.

The important decision is the frontend contract first. Implementation should not start until the
shared data shape is stable enough to reuse across Markets widgets.

## Decision

Markets will introduce a shared market screener data model with four logical input lanes:

1. `seedData`: latest snapshot seed
2. `referenceData`: named historical/reference points for calculated returns
3. `historyData`: bounded historical series for sparklines and trend columns
4. `liveUpdates`: latest incremental updates

The `Asset Screener` widget is a passive consumer. It does not open backend requests or WebSocket
sessions directly. Connection Query, Connection Stream Query, and future managed connection-source
helpers remain the execution owners.

The screener derives its rendered rows from those four lanes:

```text
seedData       -> latestByAssetKey initial state
referenceData  -> referenceByAssetKey baseline state
historyData    -> historyByAssetKey bounded series state
liveUpdates    -> latestByAssetKey incremental updates

latest + references + history + column definitions -> rendered screener rows
```

The extra lanes are not new transports. They are semantic input roles over generic
`core.tabular_frame@v1`. HTTP and cached connection queries are expected to provide reference and
history lanes. Live WebSocket streams must not provide historical reference points unless the stream
protocol explicitly publishes a reference snapshot message.

The screener also accepts row-local table metadata on the same generic frame:

- `meta.tableTransforms.computedColumns` derives fields such as `oneDayReturn` from same-row fields
  like `last_price` and `previous_close` before Markets semantic adaptation.
- `meta.tableVisuals.columns` carries presentation hints such as percent formatting, color ranges,
  and compact sparkline encodings.
- `meta.marketAsset.fieldRoles` can mark inline `referenceValue` fields and inline
  `sparklineSeries` fields on `seedData`, so a refresh-only table can carry previous close and a
  low-resolution trend without forcing a separate connection lane.

## Scope

In scope:

- frontend input roles for the Asset Screener widget
- reusable market asset identity and value-point structures
- reference-point semantics for return calculations
- how HTTP snapshots and WebSocket updates compose
- backend and registry impact assessment
- implementation checklist

Out of scope:

- implementing the widget
- implementing backend adapters
- selecting exact visual styling
- adding a new WebSocket transport
- adding a new persistence model for runtime data
- making the screener fetch data directly

## Widget Input Roles

### `seedData`

Purpose:

- provide the latest known current values when the widget first renders
- support refresh-only workspaces without WebSocket bindings
- provide asset identity and display metadata when the latest source owns it

Accepted source outputs:

- retained `dataset` from `connection-query`
- incremental `updates` with `publicationRole: "seed"`
- `core.tabular_frame@v1`; the widget lane plus field mappings provide the market semantics

Required logical fields:

- asset join key
- latest observation time when available
- at least one latest value field, usually price or last

Optional row-local fields:

- inline `referenceValue` fields such as `previous_close` with `referenceKey: "previousClose"`
- inline `sparklineSeries` fields such as a CSV number cell for low-resolution terminal sparklines
- computed fields produced by `meta.tableTransforms.computedColumns`

### `referenceData`

Purpose:

- provide historical points used for calculated columns
- provide named baselines such as previous close, one month ago, one year ago, or YTD start

Accepted source outputs:

- retained `dataset` from `connection-query`
- incremental `updates` with `publicationRole: "seed"`
- `core.tabular_frame@v1`; the widget lane plus field mappings provide the reference/history
  semantics

Required logical fields for reference points:

- asset join key
- reference key
- reference observation time
- at least one reference value field, usually price or close

Reference keys are stable identifiers, not display labels. Examples:

- `previousClose`
- `oneWeekAgo`
- `oneMonthAgo`
- `quarterStart`
- `yearStart`
- `oneYearAgo`
- `custom:<id>`

The display label can be `1D`, `1W`, `1M`, `QTD`, `YTD`, or `1Y`, but formulas use the stable
reference key.

### `historyData`

Purpose:

- provide bounded historical series for inline trend/sparkline columns
- keep chart history separate from named reference points used by return formulas

Accepted source outputs:

- retained `dataset` from `connection-query`
- retained `dataset` from `tabular-transform`
- `core.tabular_frame@v1`; the widget lane plus field mappings or `meta.marketAsset` field roles
  provide the history-series semantics

Required logical fields:

- asset join key
- observation time or sequence
- at least one value field matching the column `valueField`, usually `price` or `close`

### `liveUpdates`

Purpose:

- apply latest price, quote, trade, volume, or status updates after the seed has rendered
- recalculate return columns against the stable `referenceData` baselines

Accepted source outputs:

- explicit `updates` output from `connection-stream-query`
- explicit `updates` output from an HTTP incremental `connection-query`
- future connection source outputs that publish `widget-runtime-update@v1`

Rules:

- live updates are partial-row updates keyed by asset
- live updates mutate latest state only
- live updates must not mutate historical reference state
- a new source run id resets the live lane but not the reference lane unless the reference binding
  also changes

## Shared Frontend Data Structures

The implementation should define these structures in a Markets shared module before implementing
the widget. The exact file is left to implementation, but it should live under the Markets
extension rather than in a single widget folder if another Markets widget can use it.

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

- `assetKey` is the join key across all lanes.
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

- `values` stores normalized measure names such as `last`, `close`, `bid`, `ask`, `volume`,
  `marketCap`, `open`, `high`, and `low`.
- Numeric calculations only use numeric values.
- Partial live updates merge into the latest point for the same asset.
- `quality` is surfaced in warnings and tooltips when reference points are not exact.

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

- Reference rows are long-form: one row per asset per reference key.
- Wide backend frames may be adapted into this long-form structure at the widget edge.
- Multiple reference values for one asset/key choose the newest `observedAtMs`, then highest
  `sequence`, unless the source explicitly marks a better quality.

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
    referenceRunId?: string;
    liveRunId?: string;
    lastSeedAtMs?: number;
    lastReferenceAtMs?: number;
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
- Missing reference values produce `missing-reference` for affected columns only.
- Division by zero returns `null` plus a diagnostic.
- Stale latest data is a row status, not a reason to discard historical references.
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
    }
  | {
      id: string;
      kind: "latest-value";
      label: string;
      valueField: string;
      format?: "number" | "price" | "percent" | "volume" | "currency";
      width?: number;
    }
  | {
      id: string;
      kind: "reference-value";
      label: string;
      referenceKey: string;
      valueField: string;
      format?: "number" | "price" | "percent" | "volume" | "currency";
      width?: number;
    }
  | {
      id: string;
      kind: "return";
      label: string;
      referenceKey: string;
      valueField: string;
      returnMode: "absolute" | "percent";
      width?: number;
    }
  | {
      id: string;
      kind: "sparkline";
      label: string;
      valueField: string;
      historyKey?: string;
      width?: number;
    };
```

Default columns for the first Asset Screener should be configurable but should map naturally to a
terminal-style view:

- symbol or asset name
- compact trend/sparkline when bounded history is available
- latest price
- net change vs previous close
- percent change vs previous close
- YTD return
- 1M return
- 1Y return
- currency, sector, industry, or group columns as optional grouping fields

## Internal Semantic Evaluation

The first implementation accepts `core.tabular_frame@v1` on every screener input. Asset,
reference-point, and history semantics are internal to the widget and are selected by the bound
input lane plus explicit field mappings or internal field-role metadata.

The widget must not require sources or connections to advertise market-specific output contracts.
The same generic tabular output can feed different screener lanes when the workspace binding and
field mapping say how to interpret it.

### Snapshot Lane Semantics

One row per asset for one latest/current observation.

Required logical fields after widget mapping:

- `assetKey`
- `observedAt` when available
- at least one numeric value field

Optional logical fields after widget mapping:

- `symbol`
- `displayName`
- `exchange`
- `currency`
- `assetClass`
- `sector`
- `industry`
- `country`
- `sequence`

### Reference-Points Lane Semantics

One row per asset per named historical reference point.

Required logical fields after widget mapping:

- `assetKey`
- `referenceKey`
- `observedAt`
- at least one numeric value field

Optional logical fields after widget mapping:

- `referenceLabel`
- `referenceKind`
- `offsetUnit`
- `offsetValue`
- `quality`
- `currency`
- `sequence`

### History-Series Lane Semantics

Bounded historical series for compact inline visualizations.

Required logical fields after widget mapping:

- `assetKey`
- `observedAt`
- at least one numeric value field

Rules:

- This lane is optional for the screener.
- Low-resolution screener sparklines may instead come from an inline `sparklineSeries` cell on
  `seedData`.
- It should be bounded by the source query, not accumulated forever in the widget.
- It should not replace named reference points for return calculations.

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
    format?: "number" | "price" | "percent" | "volume" | "currency";
    kind?: "sparkline" | "bar" | "heatmap";
    encoding?: "csv-number" | "json-number-array" | "number-array";
    order?: "oldest-to-newest" | "newest-to-oldest";
    range?: { min?: number; max?: number; midpoint?: number; clamp?: boolean };
  }>;
}
```

Rules:

- Explicit widget field mappings take precedence over Markets metadata. Markets metadata takes
  precedence over field-name heuristics.
- `meta.marketAsset.fieldRoles` supports inline `referenceValue` and `sparklineSeries` roles in
  addition to normal identity, observation, reference, and value roles.
- Computed columns are row-local and deterministic; they do not query backend state.
- Computed columns run before `meta.marketAsset.fieldRoles`, so derived fields can become normal
  semantic `valueKey`s.
- Supported transform operations are `percentChange`, `difference`/`subtract`, `ratio`/`divide`,
  `add`, and `multiply`, plus literal field/value expressions.
- Missing operands, non-numeric operands in numeric operations, and division by zero resolve to
  `null`.
- Inline sparkline cells are for compact visual context. Bind `historyData` when a widget needs a
  larger ordered series.
- Visual metadata is guidance for the Markets widget, not a new connection output contract.
- The first screener renderer consumes visual `format` and `colorScale`; `range`, `bar`, and
  `heatmap` hints are preserved for Markets runtime consumers but are not yet rendered as dedicated
  cells.

## Source Shape Requirements

The screener must adapt to the data shape produced by existing connection sources. The widget does
not require a special Markets connection type, and this ADR does not require changing a connection
query model just for the screener.

The required source shapes are semantic lanes, not provider-specific operations:

- latest snapshot rows -> bind to `seedData`
- historical reference point rows -> bind to `referenceData`
- incremental latest rows -> bind to `liveUpdates`

Any existing `Connection Query`, `Connection Stream Query`, `Tabular Transform`, SQL adapter, API
adapter, or future source can feed the screener when it publishes compatible tabular rows.

The widget accepts `core.tabular_frame@v1` and evaluates each bound frame against the widget's
internal lane semantics. Explicit field mappings are the primary contract. Internal field-role
metadata may reduce mapping work inside the widget, but it is widget-side interpretation metadata,
not a connection output contract.

When a source can produce a richer table, it may put calculation and visual intent in frame `meta`
instead of changing its connection contract. Example: a normal latest snapshot frame can include
`last_price`, `previous_close`, and `price_sparkline`; `meta.tableTransforms` derives
`oneDayReturn`; `meta.marketAsset` marks `previous_close` as an inline `previousClose` baseline and
`price_sparkline` as an inline ordered series.

Reference point data should be shaped so one frame can carry multiple requested periods. This is a
consumer expectation on the dataset shape, not a demand that every provider implement a custom
endpoint.

Representative `referenceData` row shape:

```ts
interface MarketAssetReferencePointRow {
  assetKey: string;
  referenceKey: "previousClose" | "oneMonthAgo" | "yearStart" | "oneYearAgo" | string;
  observedAt: string | number;
  price?: number;
  close?: number;
  quality?: "exact" | "prior" | "next" | "interpolated" | "stale" | "unknown";
}
```

Representative generic field mappings:

```json
{
  "seed": {
    "assetKeyField": "asset_id",
    "symbolField": "symbol",
    "sectorField": "sector",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price"
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
  "live": {
    "assetKeyField": "asset_id",
    "observedAtField": "time",
    "valueFields": {
      "price": "last_price"
    }
  }
}
```

Backend adapters own:

- whatever query semantics that adapter already supports
- resolving the market calendar when the adapter chooses to support calendar-aware references
- selecting exact or nearest historical points
- permission checks
- cache and in-flight dedupe
- response normalization into `core.tabular_frame@v1`
- rejecting unsafe or unsupported reference definitions

The widget owns:

- field mapping fallback for generic tabular frames
- joining by asset key
- applying live updates to latest state
- calculating configured columns
- rendering, sorting, filtering, grouping, and row diagnostics

Rules:

- Do not create a provider-specific connection only for this widget.
- Do not force existing connections to change their advertised output contracts before they can
  feed the screener.
- Do not couple the screener to a connection type id.
- If a source can only produce generic rows, use explicit field mappings.
- The screener may auto-map fields from its own internal role metadata, explicit mapping config,
  and stable naming heuristics.

## Managed Connection Authoring

The long-term authoring flow may allow the user to pick an existing connection and have the
screener bind the needed source lanes without exposing transport details in the visual widget.
That must remain a convenience over the normal graph, not a new connection requirement.

This should still compile down to normal graph nodes and bindings:

```text
Connection Query: latest snapshot      -> Asset Screener.seedData
Connection Query: reference points     -> Asset Screener.referenceData
Connection Stream Query: latest ticks  -> Asset Screener.liveUpdates
```

Rules:

- The visual widget must not persist endpoint URLs, tokens, or raw backend route fragments.
- If hidden managed source widgets are used, they must remain normal execution-owner widgets.
- The screener settings may expose a single guided connection setup, but saved workspace bindings
  must still be inspectable as standard widget graph edges.
- Historical reference data should be shared where possible; do not create one hidden source per
  reference column when one source frame can carry multiple reference keys.

## UI Implications

The Bloomberg-style screenshot implies a dense operational table, not a marketing card layout.

The visual target should prioritize:

- fixed header and compact rows
- grouped sections by sector, basket, asset class, country, or custom group
- keyboard-friendly table navigation
- fast sort/filter across derived columns
- red/green value coloring with accessible text fallback
- stale/missing-data indicators that do not shift row height
- optional inline sparkline column when bounded history exists
- virtualization for large universes

The first screen should be the screener itself. Do not add an explanatory landing page inside the
widget.

## Storage And Backend Contract Impact

Workspace storage impact:

- new widget type props will be needed for column definitions, field mappings, grouping, sorting,
  filtering, and staleness policy
- new widget bindings will include `seedData`, `referenceData`, `historyData`, and `liveUpdates`
- no connection credentials, endpoint URLs, backend routes, or raw transport details should be
  stored on the screener widget

Backend contract impact:

- backend widget registry validation must understand the new Asset Screener widget id, props, and
  four input roles
- no backend connection adapter changes are required for the widget to consume generic tabular
  frames
- no backend connection registry output-contract changes are required or desired for this widget
- backend adapters must continue to enforce their own permissions and source constraints before
  returning data

No backend storage migration is implied by this ADR alone. Implementation may still require backend
registry validation for the new widget type, but it must not require a special Markets connection.

## Non-Goals

- Do not make the screener query a backend API directly.
- Do not make the screener open a WebSocket directly.
- Do not store connection secrets or endpoint details in widget props.
- Do not treat all three screener lanes as one untyped table inside the widget; each generic
  tabular frame must be evaluated by lane and field mapping.
- Do not create one source widget per calculated column when one reference-points query can return
  all needed baselines.
- Do not make live updates rewrite historical reference points.
- Do not make WebSocket transport mandatory; refresh-only mode must remain valid.

## Implementation Checklist

Use this checklist when implementation starts.

### Shared Contracts

- [x] Add shared Markets TypeScript types for asset identity, value points, reference points,
  runtime model, rows, and columns.
- [x] Add adapters from `core.tabular_frame@v1` to the shared screener runtime model.
- [x] Add internal field-role metadata for the snapshot lane.
- [x] Add internal field-role metadata for the reference-points lane.
- [x] Add internal field-role metadata for the history-series lane.
- [x] Add row-local `meta.tableTransforms` support for computed screener values.
- [x] Add inline `referenceValue` and `sparklineSeries` semantics for generic snapshot frames.

### Connection And Source Integration

- [x] Keep the widget compatible with generic `core.tabular_frame@v1` source outputs.
- [x] Keep Asset Screener semantics internal, not advertised as connection output contracts.
- [x] Keep source binding through normal `Connection Query`, `Connection Stream Query`, and
  `Tabular Transform` graph nodes.
- [x] Verify a refresh-only workspace can bind any existing compatible tabular source to
  `seedData` and `referenceData`.
- [x] Verify a live workspace can bind any existing compatible stream source to `liveUpdates`.
- [x] Document example generic field mappings for common latest/reference/live row shapes.

### Widget Implementation

- [x] Create the Markets `asset-screener` widget folder.
- [x] Add `README.md` and `USAGE_GUIDANCE.md`.
- [x] Add widget definition with `widgetVersion`, `registryContract`, and four input roles.
- [x] Implement field mapping and internal field-role auto-mapping.
- [x] Implement seed/reference/live reducer logic without direct backend access.
- [x] Implement dense virtualized table rendering.
- [x] Implement derived return columns.
- [x] Implement grouping, sorting, filtering, and staleness diagnostics.
- [x] Provide demo `mockProps` and `mockRuntimeState` for settings preview.

### Verification

- [x] Refresh-only workspace: latest snapshot plus reference points renders calculated columns.
- [x] Live workspace: WebSocket latest updates recalculate columns against stable references.
- [x] Reference source refresh updates historical baselines without reopening the live stream.
- [x] Missing reference data marks affected columns without breaking the row.
- [x] Large universe rendering remains virtualized and does not block widget settings open.
- [x] `npm run check` passes.
- [x] Widget registry sync preview includes the new widget contract and guidance.
