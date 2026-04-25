# ADR: Standardized Connection Result Contracts

- Status: Accepted
- Date: 2026-04-25
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Main Sequence Simple Table Connection](./adr-main-sequence-simple-table-connection.md)
  - [ADR: PostgreSQL Custom Connection](./adr-postgresql-connection.md)

## Context

Command Center now treats configured connections as the workspace data-access boundary. Connection
types advertise query models, and query models advertise `outputContracts`, so widgets can bind to
connection-backed data without knowing the adapter implementation.

The current implementation only has a strong generic table contract:

- `core.tabular_frame@v1`
- `ConnectionQueryResponse.frames[]` with `contract`, `fields[]`, and loose `meta`
- widget IO declarations that mostly accept or publish `core.tabular_frame@v1`

That is sufficient for tables and simple statistics, but not sufficient for chart and time-series
widgets. `Data Node Graph` currently consumes a tabular frame, then asks the widget configuration
to choose `xField`, `yField`, and `groupField`. It parses timestamps and numeric values locally.
That means the adapter did not actually return a time-series contract; it returned a table and the
chart guessed the semantics.

This becomes a problem for adapters such as Prometheus, PostgreSQL time-series SQL, and Main
Sequence Data Node row reads. These adapters can know the time field, value fields, series labels,
units, and ordering at query time. If that information is not standardized in the response,
downstream widgets must repeatedly infer it, and connection `outputContracts` stop being useful as
an authoring and validation contract.

## Decision

Connection adapters must return typed `ConnectionQueryResponse` frames for query models that are
intended to feed widgets.

The frame contract id is authoritative. A query model that advertises an `outputContracts` entry
must return at least one frame whose `contract` matches one of those advertised contracts. Raw JSON,
row arrays, or connector-specific objects are allowed for resource endpoints, but they are not the
target response shape for widget-bound query models.

Command Center will keep `core.tabular_frame@v1` and add two semantic result contracts:

1. `core.time_series_frame@v1`
2. `core.chart_data@v1`

Adapters should prefer the lowest semantic contract that accurately describes the data:

- use `core.tabular_frame@v1` for generic rows
- use `core.time_series_frame@v1` when the adapter can identify time and value semantics
- use `core.chart_data@v1` only when the adapter is deliberately returning chart-ready data, not
  just source data

`core.chart_data@v1` must remain render-engine-neutral. Connectors must not return ECharts,
Lightweight Charts, TradingView, Vega, or other vendor-specific option objects as the canonical
chart data contract. Vendor-specific specs can still flow through `core.value.json@v1` into
spec-driven widgets, but that is a different contract.

## Base Response Envelope

Every widget-bound connection query should return:

```ts
export interface ConnectionQueryResponse {
  frames: CommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}

export interface CommandCenterFrame {
  name?: string;
  contract: WidgetContractId;
  fields: CommandCenterFrameField[];
  meta?: Record<string, unknown>;
}

export interface CommandCenterFrameField {
  name: string;
  type: "time" | "number" | "string" | "boolean" | "json";
  values: unknown[];
  labels?: Record<string, string>;
  config?: {
    unit?: string;
    displayName?: string;
    decimals?: number;
  };
}
```

Frame rules:

- field names must be unique within one frame
- all fields in one frame must have the same `values.length`
- values should be columnar, not row-oriented
- time fields in semantic time-series frames must use UTC epoch milliseconds
- warnings should describe truncation, sampling, cache hits, adapter coercion, duplicate handling,
  missing units, or inferred metadata
- `traceId` should be present when the backend has one

## Backend Data Contract Types

Backend adapters should implement these DTOs as the canonical response model before serializing to
JSON. The TypeScript notation is normative for field names and value shapes even if the backend
implementation is Python, Go, or another runtime.

### Shared DTOs

```ts
export type ConnectionFrameContractId =
  | "core.tabular_frame@v1"
  | "core.time_series_frame@v1"
  | "core.chart_data@v1";

export type CommandCenterFrameFieldType =
  | "time"
  | "number"
  | "string"
  | "boolean"
  | "json";

export type FrameScalarValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];

export interface FrameFieldConfig {
  unit?: string;
  displayName?: string;
  decimals?: number;
}

export interface CommandCenterFrameField {
  name: string;
  type: CommandCenterFrameFieldType;
  values: FrameScalarValue[];
  labels?: Record<string, string>;
  config?: FrameFieldConfig;
}

export interface BaseFrameSourceMeta {
  kind: string;
  connectionUid?: string;
  connectionTypeId?: string;
  queryModelId?: string;
  queryKind?: string;
  resource?: string;
  organizationId?: number | string;
  sourceId?: number | string;
  sourceLabel?: string;
  [key: string]: unknown;
}

export interface BaseFrameMeta {
  source?: BaseFrameSourceMeta;
  rowCount?: number;
  generatedAt?: string;
  adapterVersion?: string;
  cache?: {
    policy?: string;
    hit?: boolean;
    ttlMs?: number;
    keyHash?: string;
  };
}

export interface BaseCommandCenterFrame {
  name?: string;
  contract: ConnectionFrameContractId;
  fields: CommandCenterFrameField[];
  meta?: BaseFrameMeta & Record<string, unknown>;
}

export interface ConnectionQueryResponse {
  frames: BaseCommandCenterFrame[];
  warnings?: string[];
  traceId?: string;
}
```

Shared backend rules:

- `generatedAt` must be an ISO-8601 timestamp when present.
- `rowCount` must equal the common `values.length` across frame fields.
- `cache.hit` should be true only when the returned payload came from a completed-result cache.
- `cache.keyHash` may be included for debugging, but the raw cache key must not be returned.
- `source.kind` should be the adapter id, for example `mainsequence.data-node`,
  `mainsequence.simple-table`, `postgresql`, or `prometheus.remote`.

### `core.tabular_frame@v1` DTO

```ts
export interface TabularFrameMeta extends BaseFrameMeta {
  tabular?: {
    primaryKeyFields?: string[];
    columnOrder?: string[];
    truncated?: boolean;
    limit?: number;
    offset?: number;
  };
}

export interface TabularFrame extends BaseCommandCenterFrame {
  contract: "core.tabular_frame@v1";
  fields: CommandCenterFrameField[];
  meta?: TabularFrameMeta;
}
```

Backend generation rules:

- Generate one field per returned column.
- Preserve backend column order in `fields[]`.
- Set `meta.tabular.columnOrder` when the adapter had to reorder or project fields.
- Use field type `time` only when the backend has parsed the value as a date/time.
- Use field type `json` for nested objects, arrays, and connector-native values that cannot be
  safely flattened.
- Include `meta.tabular.truncated = true` and a warning when the adapter applies a row limit.

### `core.time_series_frame@v1` DTO

```ts
export type TimeSeriesShape = "long" | "wide";

export type TimeSeriesFrequency =
  | "irregular"
  | "tick"
  | "minute"
  | "hour"
  | "daily"
  | "monthly"
  | string;

export type TimeSeriesGapPolicy =
  | "preserve_nulls"
  | "drop_nulls";

export type TimeSeriesDuplicatePolicy =
  | "error"
  | "first"
  | "latest"
  | "aggregate"
  | "preserve";

export interface TimeSeriesFrameMeta extends BaseFrameMeta {
  timeSeries: {
    shape: TimeSeriesShape;
    timeField: string;
    timeUnit: "ms";
    timezone: "UTC";
    sorted: boolean;

    // Long shape: one numeric value field plus an optional series identity field.
    valueField?: string;
    seriesField?: string;
    seriesLabelFields?: string[];

    // Wide shape: multiple numeric value fields, one logical series per field.
    valueFields?: string[];

    frequency?: TimeSeriesFrequency;
    calendar?: string;
    gapPolicy?: TimeSeriesGapPolicy;
    duplicatePolicy?: TimeSeriesDuplicatePolicy;
    unitByField?: Record<string, string>;
  };
}

export interface TimeSeriesFrame extends BaseCommandCenterFrame {
  contract: "core.time_series_frame@v1";
  fields: CommandCenterFrameField[];
  meta: TimeSeriesFrameMeta;
}
```

Backend generation rules:

- The field named by `timeSeries.timeField` must exist and must have `type: "time"`.
- Time values must be UTC epoch milliseconds as numbers.
- For long shape, `timeSeries.valueField` must name an existing `type: "number"` field.
- For long shape with multiple logical series, `timeSeries.seriesField` must name an existing
  `type: "string"` field.
- For wide shape, `timeSeries.valueFields` must be non-empty, and every listed field must have
  `type: "number"`.
- `unitByField` should agree with each listed value field's `config.unit` when both are present.
- Set `sorted = true` only after sorting by time and then by series identity. If the adapter
  preserves upstream order and cannot guarantee sorting, set `sorted = false`.
- If duplicate points are collapsed, declare `duplicatePolicy` and add a warning.
- If duplicate points are preserved, declare `duplicatePolicy: "preserve"` so chart consumers can
  decide how to render them.

### `core.chart_data@v1` DTO

```ts
export type ChartKind =
  | "line"
  | "area"
  | "bar"
  | "scatter"
  | "histogram"
  | "pie"
  | string;

export type ChartLogicalType =
  | "time"
  | "number"
  | "string"
  | "boolean"
  | "category";

export interface ChartFieldRef {
  field: string;
  type: ChartLogicalType;
  label?: string;
  unit?: string;
}

export interface ChartFrameMeta extends BaseFrameMeta {
  chart: {
    kind: ChartKind;
    x?: ChartFieldRef;
    y?: ChartFieldRef;
    series?: Pick<ChartFieldRef, "field" | "label">;
    color?: { field?: string; value?: string };
    size?: ChartFieldRef;
    tooltipFields?: string[];
    legend?: {
      visible?: boolean;
      title?: string;
    };
    axes?: {
      x?: { label?: string; unit?: string; scale?: "linear" | "log" | "time" | "category" };
      y?: { label?: string; unit?: string; scale?: "linear" | "log" };
    };
    stack?: "none" | "normal" | "percent";
  };
}

export interface ChartDataFrame extends BaseCommandCenterFrame {
  contract: "core.chart_data@v1";
  fields: CommandCenterFrameField[];
  meta: ChartFrameMeta;
}
```

Backend generation rules:

- Every field referenced from `meta.chart` must exist in `fields[]`.
- `meta.chart.kind` must describe the semantic chart shape, not a renderer implementation.
- For `line`, `area`, `bar`, and `scatter`, at least one of `x` or `y` must be present, and most
  adapters should provide both.
- Do not put renderer option JSON under `meta.chart`.
- Use `core.value.json@v1` for renderer-specific specs instead of `core.chart_data@v1`.

### Backend Normalization Pipeline

Every adapter should normalize through the same stages before returning a response:

```text
resolve connection instance
resolve query model
validate user/org/object permissions
validate and normalize request payload
execute upstream query/resource call
project upstream records into columnar fields
coerce field values to declared field types
generate semantic metadata for the selected contract
validate the generated frame against the contract
attach warnings, traceId, source metadata, cache metadata
return ConnectionQueryResponse
```

Field coercion rules:

- `time`: parse upstream values to UTC epoch milliseconds; reject unparseable values for semantic
  time-series frames; use `null` plus warning only for generic tabular frames.
- `number`: use finite numbers only; convert numeric strings when the adapter owns the schema;
  otherwise reject or return `null` with a warning.
- `string`: convert scalar display values to strings; do not stringify nested objects into string
  fields.
- `boolean`: use booleans only; adapters may coerce known backend boolean encodings.
- `json`: preserve objects and arrays; preserve scalar values only when the column is intentionally
  schema-less.

Contract validation rules:

- a query model cannot advertise `core.time_series_frame@v1` unless the adapter can populate
  `meta.timeSeries`
- a query model cannot advertise `core.chart_data@v1` unless the adapter can populate `meta.chart`
- a response frame contract must be included in the selected query model's `outputContracts`
- resource responses are exempt from `ConnectionQueryResponse`, but they must not be treated as
  widget-bindable data until a resource/value contract exists

## Contract: `core.tabular_frame@v1`

Use this for generic rows where the adapter cannot or should not claim chart or time-series
semantics.

Required frame shape:

```json
{
  "name": "orders",
  "contract": "core.tabular_frame@v1",
  "fields": [
    { "name": "created_at", "type": "time", "values": [1777115132000] },
    { "name": "symbol", "type": "string", "values": ["AAPL"] },
    { "name": "price", "type": "number", "values": [194.25], "config": { "unit": "USD" } }
  ],
  "meta": {
    "source": {
      "kind": "postgresql",
      "queryModelId": "sql-table"
    }
  }
}
```

Rules:

- no special chart semantics are implied by field names
- field type `time` means the field can be converted to a datetime column by tabular consumers
- adapters may include source metadata under `meta.source`
- widgets may still let users map tabular fields to visual encodings, but that mapping is
  widget-local, not an adapter contract

## Contract: `core.time_series_frame@v1`

Use this when the adapter can identify time-series semantics.

A time-series frame supports both long and wide shapes. The adapter must declare the shape in
`meta.timeSeries.shape`.

Long shape:

```json
{
  "name": "prometheus:rate(http_requests_total[5m])",
  "contract": "core.time_series_frame@v1",
  "fields": [
    { "name": "time", "type": "time", "values": [1777115100000, 1777115160000] },
    { "name": "series", "type": "string", "values": ["job=api,instance=a", "job=api,instance=a"] },
    { "name": "value", "type": "number", "values": [12.4, 13.1], "config": { "unit": "requests/s" } },
    { "name": "job", "type": "string", "values": ["api", "api"] },
    { "name": "instance", "type": "string", "values": ["a", "a"] }
  ],
  "meta": {
    "timeSeries": {
      "shape": "long",
      "timeField": "time",
      "valueField": "value",
      "seriesField": "series",
      "seriesLabelFields": ["job", "instance"],
      "timeUnit": "ms",
      "timezone": "UTC",
      "sorted": true,
      "duplicatePolicy": "error"
    }
  }
}
```

Wide shape:

```json
{
  "name": "rates",
  "contract": "core.time_series_frame@v1",
  "fields": [
    { "name": "time", "type": "time", "values": [1777115100000, 1777115160000] },
    { "name": "ust_2y", "type": "number", "values": [4.21, 4.22], "config": { "unit": "percent" } },
    { "name": "ust_10y", "type": "number", "values": [4.62, 4.64], "config": { "unit": "percent" } }
  ],
  "meta": {
    "timeSeries": {
      "shape": "wide",
      "timeField": "time",
      "valueFields": ["ust_2y", "ust_10y"],
      "timeUnit": "ms",
      "timezone": "UTC",
      "sorted": true,
      "duplicatePolicy": "latest"
    }
  }
}
```

Required `meta.timeSeries` fields:

- `shape`: `"long"` or `"wide"`
- `timeField`: field name with `type: "time"`
- `timeUnit`: `"ms"`
- `timezone`: `"UTC"`
- `sorted`: boolean

Required long-shape fields:

- `valueField`: numeric field name
- `seriesField`: string field name when more than one series is present

Required wide-shape fields:

- `valueFields`: non-empty list of numeric field names

Optional `meta.timeSeries` fields:

- `seriesLabelFields`: label fields that describe or build series identity
- `frequency`: `"irregular"`, `"tick"`, `"minute"`, `"hour"`, `"daily"`, `"monthly"`, or
  adapter-specific string
- `calendar`: trading or business calendar name
- `gapPolicy`: `"preserve_nulls"` or `"drop_nulls"`
- `duplicatePolicy`: `"error"`, `"first"`, `"latest"`, `"aggregate"`, or `"preserve"`
- `unitByField`: unit overrides by value field
- `source`: adapter-specific source metadata

Rules:

- values in the declared time field must be UTC epoch milliseconds
- values should be sorted ascending by time within each series
- adapters should reject or warn on duplicate `(time, series)` points unless they declare a
  `duplicatePolicy`
- adapters must not rely on frontend field-name guessing such as assuming `timestamp`, `date`, or
  `value`
- if the adapter cannot identify value semantics, it must return `core.tabular_frame@v1` instead

## Contract: `core.chart_data@v1`

Use this only when the adapter intentionally returns chart-ready, render-engine-neutral data.

Required frame shape:

```json
{
  "name": "portfolio-drawdown",
  "contract": "core.chart_data@v1",
  "fields": [
    { "name": "time", "type": "time", "values": [1777115100000, 1777115160000] },
    { "name": "series", "type": "string", "values": ["portfolio", "portfolio"] },
    { "name": "drawdown", "type": "number", "values": [-0.03, -0.028], "config": { "unit": "percent" } }
  ],
  "meta": {
    "chart": {
      "kind": "line",
      "x": { "field": "time", "type": "time" },
      "y": { "field": "drawdown", "type": "number", "unit": "percent" },
      "series": { "field": "series" },
      "tooltipFields": ["time", "series", "drawdown"],
      "legend": { "visible": true }
    }
  }
}
```

Required `meta.chart` fields:

- `kind`: `"line"`, `"area"`, `"bar"`, `"scatter"`, `"histogram"`, `"pie"`, or future
  versioned value
- `x`: field reference and logical type
- `y`: field reference and logical type, unless the chart kind does not use a y axis

Optional `meta.chart` fields:

- `series`: field reference used for series grouping
- `color`: field reference or fixed semantic color token
- `size`: field reference for bubble or scatter charts
- `tooltipFields`: ordered field names
- `legend`: legend display preferences
- `axes`: axis labels, units, scale hints, and formatting hints
- `stack`: stack mode for bars or areas

Rules:

- chart data must remain independent from a rendering library
- chart data should still use `fields[]` for data, not bury points inside `meta`
- source adapters should not return chart data if a time-series frame would preserve more useful
  semantic data

## What Each Connector Should Return

### `mainsequence.data-node`

Resource endpoints:

- `resource = "data-node-detail"` returns the Data Node detail JSON object. This is a resource
  response for editors and Explore surfaces, not a widget-bound frame contract.

Query models:

- `query.kind = "data-node-rows-between-dates"` returns `ConnectionQueryResponse`.
- If the request and Data Node metadata identify a time field and numeric value fields, the first
  frame should use `core.time_series_frame@v1`.
- If no unambiguous time-series semantics are available, the first frame should use
  `core.tabular_frame@v1`.
- The adapter may include both frames, with the semantic time-series frame first and a tabular frame
  second, when both are useful to downstream widgets.
- `query.kind = "data-node-last-observation"` returns a one-row `core.tabular_frame@v1` frame.
- `query.kind = "data-node-detail"` should be removed from widget-bound query models or changed to
  advertise a future resource/json contract. It must not advertise `core.tabular_frame@v1` unless it
  actually returns a tabular frame.

Required Data Node row metadata:

```json
{
  "meta": {
    "source": {
      "kind": "mainsequence.data-node",
      "dataNodeId": 714,
      "connectionUid": "main-sequence-data-node",
      "queryKind": "data-node-rows-between-dates"
    }
  }
}
```

### `mainsequence.simple-table`

Query models:

- `query.kind = "simple-table-sql"` returns `core.tabular_frame@v1`.
- It should not claim `core.time_series_frame@v1` for arbitrary SQL.
- A future `simple-table-time-series` query model may return `core.time_series_frame@v1`, but only
  if the query payload requires explicit `timeField`, `valueField` or `valueFields`, and optional
  `seriesFields`.

### `postgresql`

Query models:

- `query.kind = "sql-table"` returns `core.tabular_frame@v1`.
- `query.kind = "sql-time-series"` returns `core.time_series_frame@v1`; existing frontend
  registries may use the accepted compatibility kind `sql-timeseries` until they migrate.
- Schema browsing query models such as schema tables and schema columns may return
  `core.tabular_frame@v1`, but they are metadata tables, not chart data.

The PostgreSQL time-series query payload must include enough structure for the adapter to validate
the result:

```json
{
  "kind": "sql-time-series",
  "sql": "select ts, symbol, close from prices where ts between {{from}} and {{to}}",
  "timeField": "ts",
  "valueField": "close",
  "seriesFields": ["symbol"],
  "unit": "USD",
  "maxRows": 10000
}
```

Backend rules:

- validate SQL as read-only before execution
- apply time range variables before execution
- verify the returned columns include the declared fields
- coerce the declared time field to UTC epoch milliseconds
- reject the query if the declared value fields are not numeric
- return warnings when rows are truncated or duplicate points are collapsed

### `prometheus.remote`

Query models:

- range queries return `core.time_series_frame@v1`
- instant vector queries may return `core.time_series_frame@v1` with one point per series or
  `core.tabular_frame@v1` when the query is being used as a metadata/value table
- label and metric discovery resources return resource JSON or metadata tabular frames, not chart
  data

Prometheus range query response rules:

- use long shape
- `time` is UTC epoch milliseconds
- `value` is numeric
- `series` is a stable label-set identity
- each Prometheus label should be included as its own string field when practical
- `seriesLabelFields` should list the labels used to display series names
- `unit` should be set when known from query config; otherwise omit it and add a warning if the
  missing unit matters to the UI

Example:

```json
{
  "frames": [
    {
      "name": "prometheus:up",
      "contract": "core.time_series_frame@v1",
      "fields": [
        { "name": "time", "type": "time", "values": [1777115100000] },
        { "name": "series", "type": "string", "values": ["job=api,instance=a"] },
        { "name": "value", "type": "number", "values": [1] },
        { "name": "job", "type": "string", "values": ["api"] },
        { "name": "instance", "type": "string", "values": ["a"] }
      ],
      "meta": {
        "timeSeries": {
          "shape": "long",
          "timeField": "time",
          "valueField": "value",
          "seriesField": "series",
          "seriesLabelFields": ["job", "instance"],
          "timeUnit": "ms",
          "timezone": "UTC",
          "sorted": true
        },
        "source": {
          "kind": "prometheus.remote",
          "query": "up"
        }
      }
    }
  ]
}
```

### Generic Or Future Connectors

New connectors must follow these rules:

- every query model intended for widgets must return `ConnectionQueryResponse`
- every returned frame must use a known versioned contract id
- `queryModels[].outputContracts` must list the possible frame contracts for that query model
- if the adapter cannot guarantee time-series semantics, it must return `core.tabular_frame@v1`
- if the adapter advertises `core.time_series_frame@v1`, it must populate `meta.timeSeries`
- if the adapter advertises `core.chart_data@v1`, it must populate `meta.chart`
- resource endpoints may return connector-specific JSON, but widgets should not bind directly to
  resource responses unless a separate resource/value contract is introduced

## Frontend Implementation Requirements

The frontend should add shared descriptors and normalizers for:

- `core.time_series_frame@v1`
- `core.chart_data@v1`

The generic `Connection Query` widget must stop assuming every selected frame can be normalized into
`core.tabular_frame@v1`. It should either:

1. expose dynamic outputs based on the selected frame contract, or
2. expose explicit output modes for tabular, time-series, and chart data.

`Data Node Graph` should accept `core.time_series_frame@v1` directly. It may keep
`core.tabular_frame@v1` support as a fallback that requires field mapping, but the preferred path
should be a time-series frame with declared semantics.

Table and statistics widgets can continue consuming `core.tabular_frame@v1`. They should not be
forced to understand `core.time_series_frame@v1` unless there is a clear product need.

Spec-driven chart widgets can continue consuming `core.value.json@v1` for renderer-specific specs.
That is separate from the standardized source-data contracts in this ADR.

## Backend And Storage Impact

This is a backend-visible contract change.

Backend impact:

- connection type sync must preserve the new contract ids in `queryModels[].outputContracts`
- backend adapters must return `ConnectionQueryResponse` for widget-bound query models
- backend validators must reject advertised semantic contracts when required metadata is missing
- adapter tests must assert exact frame contract ids and required `meta` fields

Frontend storage impact:

- this ADR alone does not change saved workspace storage
- implementation may change widget props or runtime state when `Connection Query` gains typed output
  modes or dynamic ports
- any implementation that changes saved props, bindings, or runtime-state shape must update widget
  READMEs, usage guidance, registry contracts, and backend sync expectations in the same change

## Consequences

Positive:

- widgets can bind to adapter outputs by real semantic contract instead of guessing fields
- Prometheus and SQL time-series adapters can feed chart widgets directly
- Data Node Graph can become a true time-series consumer instead of a table-mapping chart
- query model `outputContracts` becomes meaningful for authoring, validation, and agent planning
- backend adapters have clear response expectations

Negative:

- connection query handling becomes more complex than a single tabular normalization path
- adapters must validate and normalize time-series metadata instead of forwarding raw upstream rows
- some existing query models, especially `data-node-detail`, need cleanup because they currently
  advertise tabular output without being true widget-bound tabular data

## Rollout Checklist

- [x] Add frontend contract constants, value descriptors, and normalizers for
      `core.time_series_frame@v1`.
- [x] Add frontend contract constants, value descriptors, and normalizers for `core.chart_data@v1`
      if a chart-ready adapter is being implemented.
- [x] Update `Connection Query` widget output handling so it can publish time-series frames.
- [x] Update the active Graph widget to accept and prefer `core.time_series_frame@v1`.
- [x] Verify backend adapters expose normalized frame helpers and return `core.time_series_frame@v1`
      / `core.tabular_frame@v1` frames for Data Node, PostgreSQL, and Prometheus query paths.
- [x] Update `mainsequence.data-node` query model declarations so detail is not advertised as a
      widget frame and row queries advertise time-series plus tabular fallback.
- [x] Update `postgresql` query model declarations so table and time-series SQL have distinct
      contracts.
- [x] Update `prometheus.remote` query model declarations for canonical time-series range output.
- [ ] Add backend adapter contract tests for each connector response shape.
- [x] Update widget and connection READMEs when the implementation lands.
