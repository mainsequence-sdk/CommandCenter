## buildPurpose

Line, area, bar, or markers-only chart for canonical `core.tabular_frame@v1` seed and live-update publications, with optional graph-owned managed connection or stream authoring.

## whenToUse

- Use when a tabular dataset should be rendered as a line, area, bar, or markers-only chart.
- Use when rows can be mapped to an X field, a numeric Y field, and an optional grouping field.
- Use when the chart needs local provider choice, chart type, stacked-vs-overlay rendering, marker size, max grouped-series count, max plotted points per series, series normalization, axis mode, datetime quantization, Y-axis scaling/decimals/suffix, or per-series color and line-style overrides.
- Use the managed connection flow when one chart should own its own query or stream without adding a visible standalone source widget to the rail.

## whenNotToUse

- Do not use when several widgets should share one query result; create one explicit standalone Connection Query widget upstream and bind several consumers to it.
- Do not use when the widget should own transforms after the query returns; use Tabular Transform upstream.
- Do not use for row inspection or KPI cards when Table or Statistic better matches the output.
- Do not use for arbitrary renderer-specific chart specs; use a JSON/spec widget for those.

## authoringSteps

- Open the `Bindings` tab.
- Bind `seedData` when this graph should initialize from the retained baseline dataset.
- Bind `liveUpdates` when this graph should keep applying explicit incremental `updates` publications.
- Or click `Add connection` in the `Bindings` tab when this graph should own one hidden managed source widget.
- Configure that managed source from the dedicated `Connection` tab with the same connection/path/query/runtime controls used by the standalone Connection Query or Connection Stream Query widgets.
- Apply the connection changes to create or update the hidden source widget and bind it automatically:
  - HTTP managed source -> `dataset` to `seedData`
  - WS managed source -> `updates` to `liveUpdates`
- Choose X and Y fields that match the intended chart.
- Optionally choose a grouping field, provider, chart type, shared-axis stacked mode, `Max points per series`, `Max series`, normalization, series-axis mode, `Time quantization`, and Y-axis display formatting. Leave `Normalize at` blank to rebase each series from its first visible usable point.
- Inspect the resolved source schema before finalizing field mappings. Field pickers and chart rendering resolve from the effective seed/live state, including when those bindings point at a hidden managed source widget.
- Settings previews, field selectors, and the mounted widget all read the same graph-normalized
  dataset frame, so chartability checks should stay consistent between authoring and runtime.

## blockingRequirements

- A compatible upstream binding is required before field selectors become meaningful.
- In managed connection mode, the hidden query or stream source must still publish a canonical dataset before the graph can resolve fields.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. For explicit `seedData`/`liveUpdates` bindings, the graph keeps its own bounded
  per-series queue from those publications instead of rebuilding from the source widget's retained
  stream history on every tick.
- Graph live-update history ignores source-side merge keys such as `symbol`; source widgets can
  retain the latest entity state while the graph appends live rows into its own time window.
- `Max points per series` trims the rendered window and the graph's ref-backed consumer view. It
  does not delete older rows from the upstream source dataset.
- For live stream-backed graphs, `Max points per series` behaves like a rolling queue per series:
  once the plotted window is full, the oldest plotted point falls off and the newest point stays visible.
- Tabular sources need a selected Y field with numeric values.
- Tabular time rendering requires an X field that can be interpreted as date or datetime values.

## commonPitfalls

- Managed connection authoring is still not a graph runtime path. The graph renders only from resolved `seedData` and `liveUpdates` bindings, whether the hidden source is request/response or WebSocket-backed.
- The graph does not auto-map fields from upstream time-series metadata; you must set the field mapping explicitly.
- Ambiguous date strings can make the inferred time axis behave unexpectedly.
- `Time axis mode` and `Time quantization` are separate controls. One chooses date vs datetime interpretation; the other controls how datetime points are bucketed before plotting.
- Provider matters for high-frequency datetime data:
  - ECharts can keep raw millisecond points when `Time quantization` is `Raw`.
  - TradingView requires at least 1-second timestamps, so `Raw` falls back to 1-second buckets on that provider.
- Explicit quantization buckets such as `1s`, `5s`, `1m`, and `1h` apply before rendering and are chart-local; they do not mutate upstream source rows.
- Stacked mode only applies on a shared axis and is hidden for `Markers`.
- ECharts uses native stacked series rendering. TradingView renders the same stacked result by
  projecting cumulative shared-axis values because Lightweight Charts does not expose a stack flag.
- Y-axis decimals, divide-by-10^N scaling, and suffix only change displayed labels. They do not
  rescale the underlying source data or published row values.
- When grouping is enabled, `Max series` limits how many groups render at once. Remaining groups
  are dropped by descending point count.
- Live stream graphs now stay responsive from the graph-local bounded queue and bounded runtime
  data view, but the upstream source still needs source-side retention when its retained
  compatibility dataset should stay bounded too.
- While stacked mode is enabled, the widget redraws live updates through the full snapshot path so
  the stacked projection stays correct across all visible series.
- `Markers` suppresses connecting lines; line-style overrides do not visibly change that mode.
- `Markers` uses the chart's `Marker size` setting, so point size can differ from the default line/area single-point markers.
- If this graph is backed by a hidden managed connection source, fix any source runtime error in the `Connection` tab before debugging chart field mappings.
