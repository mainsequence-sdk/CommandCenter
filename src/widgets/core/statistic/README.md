# Statistic Widget

This folder owns the core `statistic` widget. It reduces a bound `core.tabular_frame@v1` dataset
into one or more KPI-style cards.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, demo inputs, and settings/component wiring.
- `StatisticWidget.tsx`: mounted renderer for statistic cards and empty/error states.
- `StatisticWidgetSettings.tsx`: settings editor for binding status, reduction mode, field choices, grouping, formatting, and color rules.
- `StatisticCardGrid.tsx`: responsive KPI card renderer.
- `statisticModel.ts`: configuration normalization, field inference, grouping, reduction, formatting, and color-rule evaluation.
- `statisticPreview.ts`: demo resolved-input fixture for settings preview mode.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- The widget consumes one `core.tabular_frame@v1` input on `sourceData`.
- The widget reads the resolved input's generic `upstreamBase` frame when an incremental upstream
  source publishes retained base plus delta metadata. It recomputes cards from the retained
  snapshot rather than applying row deltas directly.
- Supported reductions are `last`, `first`, `max`, `min`, `sum`, `mean`, and `count`.
- Optional grouping renders one card per group value.
- Numeric cards can render a compact sparkline from the same incoming value field, including multi-card grouped layouts.
- When the current grouped layout fits in one row, the statistic grid stretches to the full widget height instead of leaving unused space under the cards.
- Multi-card layouts use an author-controlled column count and scroll instead of compressing every tile to fit the widget height.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.

## Maintenance Constraints

- Keep the registered id as `statistic`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Avoid adding connection-specific or Main Sequence-specific backend calls here.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
