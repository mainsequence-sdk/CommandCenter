# Main Sequence Data Node Statistic Widget

This folder owns the Main Sequence workbench `main-sequence-data-node-statistic` widget id. The
widget is a pure consumer of a linked `Data Node`: it reads the final published dataset, applies a
local statistic reduction, and renders one or more KPI-style cards.

## Entry Points

- `definition.ts`: widget registry metadata, default sizing, and settings/component wiring.
- `statisticModel.ts`: shared config normalization, field-option inference, grouping helpers, and
  statistic reducers.
- `StatisticWidget.tsx`: mounted widget renderer that consumes the selected Data Node's published
  dataset and renders statistic cards or state placeholders.
- `StatisticWidgetSettings.tsx`: settings editor for source binding, statistic selection, grouping,
  formatting, card coloring, and preview.
- `StatisticCardGrid.tsx`: card renderer for grouped statistics plus the single-card sparkline
  treatment used when one numeric result is displayed.

## Data Contract

Like `Data Node Graph` and `Data Node Table`, this widget consumes the shared published dataset
contract from `../data-node-shared/dataNodePublishedDataset.ts`:

- `status`
- `dataNodeId`
- `columns: string[]`
- `rows: Record<string, unknown>[]`
- range metadata and publication timestamps

The upstream shape is intentionally standard and table-like. Consumer widgets should not invent
their own transport format on top of the Data Node pipeline.

## Behavior

- Source selection belongs to a sibling `Data Node`, not to this widget.
- The widget only performs local display reduction on the incoming published rows.
- Supported reductions are `last`, `first`, `max`, `min`, `sum`, `mean`, and `count`.
- Grouping is optional and limited to one group field in v1, so the widget can render either a
  single KPI or one KPI card per group.
- `first` and `last` can optionally use an explicit order field. Without one, they use the
  published row order from the Data Node.
- When the reduction resolves to exactly one numeric card, the widget also renders a compact inline
  sparkline from the same incoming value field.
- Grouped cards intentionally stay stat-only. The sparkline is reserved for the single-card case so
  the widget remains readable at small sizes.
- Single-card statistics resize with the widget card. The sparkline remains visible and the KPI
  value scales with the available space instead of keeping a fixed large-card layout.
- Prefix and suffix formatting are instance-owned, so units like `GB`, `%`, or `bps` can be shown
  directly in the statistic value.
- The card header now shows `Statistic · Field`, so the user can tell both the reduction being
  applied and which column it is using.
- The suffix/unit is rendered smaller than the main value so units stay readable without competing
  with the KPI.
- Card coloring supports:
  - threshold/range rules like `> 0` or `< -5`
  - change-from-last-observation coloring based on the latest two numeric points

## Maintenance Notes

- Keep this widget consumer-only. Reusable dataset transforms still belong in `Data Node`.
- If future consumers need the same upstream shape, extend the shared published dataset contract in
  `../data-node-shared/` instead of adding widget-local runtime formats.
