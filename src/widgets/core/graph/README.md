# Graph Widget

This folder owns the core `graph` widget. It renders a canonical
`core.tabular_frame@v1` dataset as a line, area, bar, or markers-only chart.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `GraphWidget.tsx`: mounted chart renderer and empty/error states.
- `GraphWidgetSettings.tsx`: custom chart-focused settings surface for graph field mapping and
  per-series styling.
- `managedConnectionConsumer.ts`: Graph implementation of the shared managed-connection consumer
  adapter. It maps Graph props onto the generic hidden `connection-query` authoring lifecycle.
- `schema.tsx`: schema-backed chart settings for provider, chart type, field mappings, grouping, normalization, and axes.
- `controller.ts`: controller context for resolved source fields and picker options.
- `graphModel.ts`: chart configuration normalization, graph source-mode normalization, embedded
  connection draft props, and row-to-series transforms.
- `TradingViewSeriesChart.tsx` and `EChartsSeriesChart.tsx`: renderer implementations.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- The widget consumes one `core.tabular_frame@v1` input on `sourceData`.
- Authoring supports two source ownership patterns:
  - normal bound dataset: the graph reads whichever upstream widget is connected to `sourceData`
  - managed connection source: the `Bindings` tab can stage or enable one graph-owned hidden
    `connection-query` widget, and the dedicated `Connection` tab edits that source by reusing the
    same full connection-query settings surface as the standalone widget
- Save/update lifecycle code creates or repairs the hidden managed `connection-query` widget and
  keeps the canonical binding from that source widget's `dataset` output to this graph's
  `sourceData` input.
- Even in connection source mode, runtime rendering stays binding-driven. The graph never calls a
  connection API directly and never reads the managed source props at render time.
- Embedded connection source settings reuse the same request builder, query-model resolution,
  typed query editors, test execution, incremental refresh controls, and normalized response
  preview as the standalone `connection-query` widget.
- Graph no longer owns a private managed-source settings implementation. The widget-settings route,
  hidden-source lifecycle, and `Connection` tab now all go through the shared managed-connection
  consumer adapter/panel layer so future consumer widgets can reuse the same integration path.
- The `Connection` tab test action also republishes the tested runtime frame onto the hidden
  managed source widget, so the graph preview resolves through the normal `sourceData` binding
  instead of waiting on an Explore-local result that the graph cannot see.
- The dedicated `Connection` tab shows the hidden source widget's current runtime status and error
  message even though the source widget stays out of the normal rail.
- The shared source binding exposes retained `upstreamBase` frames and optional
  `upstreamDelta` frames. When the incoming update is delta-safe, the chart renderer keeps its
  mounted chart instance and appends or updates projected points instead of rebuilding from the
  retained snapshot.
- When the bound source reports `loading`, the graph only blocks rendering if there is no retained
  dataset yet. If retained rows already exist, the chart stays mounted and shows an inline refresh
  overlay instead of blinking back to a blank skeleton.
- Authors must explicitly choose X and Y fields; grouping is optional and explicit.
- Provider selection is local to the widget: TradingView Lightweight Charts or ECharts.
- `markers` uses point-only rendering. ECharts maps that mode to scatter series, while
  TradingView uses a line series with the stroke hidden and point markers forced on.
- Marker-only charts expose a widget-level `markerSizePx` setting so authors can tune point size
  without switching providers.
- Grouped charts expose a widget-level `maxSeries` setting so authors can decide how many grouped
  series render before the widget drops the remainder by point count.
- Normalization, per-series colors, and line styles are chart-local and do not mutate upstream data.
- When normalization is enabled and `Normalize at` is blank, each series rebases from its first visible usable point.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.

## Maintenance Constraints

- Keep the registered id as `graph`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep `sourceData` as the only runtime data edge, even when authoring uses embedded connection
  source mode.
- Keep managed connection authoring routed through the shared connection-query settings surface,
  the widget-settings route `Bindings -> Connection` flow, and the managed widget lifecycle
  helpers. Do not add graph-local connection query execution.
- Avoid reintroducing graph-local time-series semantics or upstream metadata-driven auto-mapping.
- Avoid adding connection-specific or Main Sequence-specific backend calls here.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
