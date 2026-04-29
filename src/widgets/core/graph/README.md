# Graph Widget

This folder owns the core `graph` widget. It renders canonical
`core.tabular_frame@v1` publications as a line, area, bar, or markers-only chart.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `GraphWidget.tsx`: mounted chart renderer and empty/error states.
- `GraphWidgetSettings.tsx`: custom chart-focused settings surface for graph field mapping and
  per-series styling.
- `managedConnectionConsumer.ts`: Graph implementation of the shared managed-connection consumer
  adapter. It maps Graph props onto the generic hidden `connection-query` or
  `connection-stream-query` authoring lifecycle.
- `schema.tsx`: schema-backed chart settings for provider, chart type, field mappings, grouping, normalization, and axes.
- `controller.ts`: controller context for resolved source fields and picker options.
- `graphModel.ts`: chart configuration normalization, graph source-mode normalization, embedded
  connection draft props, and row-to-series transforms.
- `TradingViewSeriesChart.tsx` and `EChartsSeriesChart.tsx`: renderer implementations.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- The widget now exposes two explicit live-capable roles:
  - `seedData`: retained dataset baseline
  - `liveUpdates`: explicit incremental `updates` publication
- Authoring supports two source ownership patterns:
  - normal bound dataset: the graph reads whichever upstream widget is connected to `sourceData`
  - managed connection source: the `Bindings` tab can stage or enable one graph-owned hidden
    `connection-query` or `connection-stream-query` widget, and the dedicated `Connection` tab
    edits that source by reusing the same shared connection authoring surface as the standalone
    source widget
- Save/update lifecycle code creates or repairs the hidden managed connection source widget and
  keeps the canonical binding aligned with the chosen role:
  - managed HTTP source -> `dataset` bound to `seedData`
  - managed WS source -> `updates` bound to `liveUpdates`
- Even in connection source mode, runtime rendering stays binding-driven. The graph never calls a
  connection API directly and never reads the managed source props at render time.
- Embedded connection source settings reuse the same request builder, query-model resolution,
  typed query editors, test execution, stream test controls, and normalized response preview as the
  standalone connection source widgets.
- Graph no longer owns a private managed-source settings implementation. The widget-settings route,
  hidden-source lifecycle, and `Connection` tab now all go through the shared managed-connection
  consumer adapter/panel layer so future consumer widgets can reuse the same integration path.
- The `Connection` tab test action also republishes the tested runtime frame onto the hidden
  managed source widget, so the graph preview resolves through the same seed/live bindings the
  runtime graph uses instead of waiting on an Explore-local result that the graph cannot see.
- The dedicated `Connection` tab shows the hidden source widget's current runtime status and error
  message even though the source widget stays out of the normal rail.
- The shared source binding exposes retained `upstreamBase` frames and optional
  `upstreamDelta` frames. For explicit `seedData`/`liveUpdates` bindings, the graph now owns a
  bounded local queue per series and applies incremental publications into that queue instead of
  rebuilding from the source widget's retained stream history on every live tick.
- When a live update only appends the newest point or replaces the latest visible point, the graph
  keeps the update on the incremental path. When an update rewrites older history, changes series
  membership, or trims the queue, the graph falls back to a bounded snapshot refresh.
- When the bound source reports `loading`, the graph only blocks rendering if there is no retained
  dataset yet. If retained rows already exist, the chart stays mounted and shows an inline refresh
  overlay instead of blinking back to a blank skeleton.
- Authors must explicitly choose X and Y fields; grouping is optional and explicit.
- Provider selection is local to the widget: TradingView Lightweight Charts or ECharts.
- Provider behavior differs for high-frequency datetime streams:
  - ECharts keeps full millisecond-resolution points.
  - TradingView collapses same-second datetime points to the latest point in that second.
- `markers` uses point-only rendering. ECharts maps that mode to scatter series, while
  TradingView uses a line series with the stroke hidden and point markers forced on.
- Marker-only charts expose a widget-level `markerSizePx` setting so authors can tune point size
  without switching providers.
- Graphs expose a widget-level `limit` setting as `Max points per series`. This trims the plotted
  history window per series to the latest N points without mutating the upstream dataset.
- On live delta updates, that point window behaves as a rolling queue per series: once the plotted
  window is full, the oldest plotted point is dropped and the newest point is kept.
- Grouped charts expose a widget-level `maxSeries` setting so authors can decide how many grouped
  series render before the widget drops the remainder by point count.
- Normalization, per-series colors, and line styles are chart-local and do not mutate upstream data.
- When normalization is enabled and `Normalize at` is blank, each series rebases from its first visible usable point.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.

## Maintenance Constraints

- Keep the registered id as `graph`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep the explicit seed/live roles stable for live-capable graphs. Do not collapse them back into
  one implicit `sourceData` edge.
- Keep managed connection authoring routed through the shared connection settings surfaces,
  the widget-settings route `Bindings -> Connection` flow, and the managed widget lifecycle
  helpers. Do not add graph-local connection query execution.
- Keep the graph-local point window separate from upstream source retention. The graph should stay
  live from its own bounded queue even if the upstream source is still carrying compatibility
  retained state.
- Avoid reintroducing graph-local time-series semantics or upstream metadata-driven auto-mapping.
- Avoid adding connection-specific or Main Sequence-specific backend calls here.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
