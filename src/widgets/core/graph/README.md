# Graph Widget

This folder owns the core `graph` widget. It renders a bound `core.time_series_frame@v1` or
`core.tabular_frame@v1` dataset as a line, area, or bar chart.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `GraphWidget.tsx`: mounted chart renderer and empty/error states.
- `GraphWidgetSettings.tsx`: settings-only schema inspector and per-series styling controls.
- `schema.tsx`: schema-backed chart settings for provider, chart type, field mappings, grouping, normalization, and axes.
- `controller.ts`: controller context for resolved source fields and group options.
- `graphModel.ts`: chart configuration normalization, source defaults, and row-to-series transforms.
- `TradingViewSeriesChart.tsx` and `EChartsSeriesChart.tsx`: renderer implementations.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- The widget consumes one `core.time_series_frame@v1` or `core.tabular_frame@v1` input on
  `sourceData`.
- Time-series frames provide time, value, and series defaults from frame metadata.
- Tabular frames map rows into `xField`, `yField`, and optional `groupField` series.
- Provider selection is local to the widget: TradingView Lightweight Charts or ECharts.
- Group include/exclude filters, normalization, per-series colors, and line styles are chart-local and do not mutate upstream data.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.

## Maintenance Constraints

- Keep the registered id as `graph`.
- Keep accepted input aligned with `core.time_series_frame@v1` and `core.tabular_frame@v1`.
- Avoid adding connection-specific or Main Sequence-specific backend calls here.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
