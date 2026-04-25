# Graph Widget

This folder owns the core `graph` widget. It renders a bound `core.tabular_frame@v1` dataset as a
line, area, or bar chart.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `GraphWidget.tsx`: mounted chart renderer and empty/error states.
- `GraphWidgetSettings.tsx`: settings-only schema inspector and per-series styling controls.
- `schema.tsx`: schema-backed chart settings for provider, chart type, field mappings, grouping, normalization, and axes.
- `controller.ts`: controller context for resolved source fields and picker options.
- `graphModel.ts`: chart configuration normalization and row-to-series transforms.
- `TradingViewSeriesChart.tsx` and `EChartsSeriesChart.tsx`: renderer implementations.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- The widget consumes one `core.tabular_frame@v1` input on `sourceData`.
- Authors must explicitly choose X and Y fields; grouping is optional and explicit.
- Provider selection is local to the widget: TradingView Lightweight Charts or ECharts.
- Normalization, per-series colors, and line styles are chart-local and do not mutate upstream data.
- When normalization is enabled and `Normalize at` is blank, each series rebases from its first visible usable point.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.

## Maintenance Constraints

- Keep the registered id as `graph`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Avoid reintroducing graph-local time-series semantics or upstream metadata-driven auto-mapping.
- Avoid adding connection-specific or Main Sequence-specific backend calls here.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
