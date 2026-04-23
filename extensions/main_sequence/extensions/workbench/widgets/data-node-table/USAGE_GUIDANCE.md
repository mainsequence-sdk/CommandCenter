## buildPurpose

Formatted table consumer for a bound Main Sequence DataNode dataset. Use it to inspect rows and apply saved column display rules without changing the upstream canonical tabular frame.

## whenToUse

- Use when a workspace already has a Data Node that publishes `core.tabular_frame@v1` rows and users need a table view of that final output.
- Use when row-level inspection, sorting, filtering, search, pagination, pinned columns, or compact table density are the right presentation for the dataset.
- Use when each column needs user-facing display configuration: header label, description, visibility, alignment, pinning, numeric precision, prefix, suffix, compact-number notation, or format-specific rendering.
- Use when numeric columns should be visually scanned with heatmap fills, inline data bars, ring gauges, or threshold-based color rules.
- Use when text columns should render selected raw values as labeled chips with semantic tones or explicit text/fill colors.

## whenNotToUse

- Do not use when the widget must own data loading, filtering, aggregation, pivoting, or reshaping; put those operations in a Data Node widget upstream.
- Do not use when the workspace needs to publish a new dataset for other widgets. This table is a consumer and formatter, not a canonical data source.
- Do not use for charting, statistics, curves, or other summarized visualization surfaces when a dedicated graph, statistic, curve plot, or zero-curve widget better matches the task.

## authoringSteps

- Bind the required inbound `sourceData` port to an upstream Data Node widget that publishes `core.tabular_frame@v1`. The incoming payload should include `columns` and `rows`, and may include `fields`, `source`, `status`, `range`, and `error` metadata.
- Use the incoming field schema inspector before editing columns. Prefer upstream `fields` metadata when available; otherwise the table infers labels, types, and numeric eligibility from the current row sample.
- Configure table-level presentation: `density` chooses compact or comfortable spacing, `pageSize` controls paginated row count, and the surface toggles enable or disable toolbar, search, zebra rows, and pagination.
- Configure the column list from the current frame. Each column keeps a `key` that maps to the incoming row field, a user-facing `label`, an optional `description` for the header tooltip, and a base `format`.
- Choose the column `format` deliberately. `Text` supports value-label chips. `Number`, `Currency`, `Percent`, and `Bps` support decimals, compact numbers, heatmaps, data bars, gauges, and numeric thresholds.
- Configure per-column layout: `visible` hides or shows the column, `align` controls cell alignment, and `pin` fixes the column to the left or right side while horizontally scrolling.
- Configure per-column value text: `decimals` overrides numeric precision, `prefix` adds static text before the formatted value, and `suffix` adds static text after it. Examples include `$` before a price, `USD` after an amount, `%` after a ratio, or `bps` after a spread.
- Configure numeric visual treatments only on numeric formats. `Data bar` draws an inline filled bar, `Heatmap` tints the full cell background, `Heatmap palette` chooses Auto, Viridis, Plasma, Inferno, Magma, Turbo, Jet, Blue-White-Red, or Red-Yellow-Green, and `Gauge` adds an inline ring gauge.
- Configure numeric bounds when a heatmap, data bar, or gauge needs stable normalization. `Auto bounds` derive min and max from the current visible column values; `Fixed bounds` use saved `min` and `max` values so the visual scale stays stable across refreshes.
- Add value mappings for text columns when raw categorical values need a clearer display label or badge color. A mapping selects the text column, raw value, display label, semantic tone, and optional custom text/fill colors.
- Add threshold rules for numeric columns when individual cells need conditional coloring. Each rule selects the numeric column, operator (`>`, `>=`, `<`, `<=`, `=`), threshold value, semantic tone, and optional custom text/fill colors. Rules are evaluated top to bottom and first match wins.
- Bind downstream widgets to the original Data Node source, not to this table, because the table does not publish a transformed dataset.

## blockingRequirements

- A compatible upstream Data Node binding is required; without `sourceData`, the table has no runtime rows to render.
- The incoming frame must provide a usable tabular shape: `columns: string[]` and `rows: Array<Record<string, unknown>>`.
- Column `key` values must match fields present in the incoming frame. Missing configured columns create a schema mismatch and block reliable rendering.
- Columns formatted as `Number`, `Currency`, `Percent`, or `Bps` must be backed by numeric cell values if numeric visuals or threshold rules are expected.
- Heatmaps, data bars, and gauges require a numeric display format and usable bounds. Fixed bounds require finite `min` and `max` values with `min < max`.

## commonPitfalls

- This widget stays empty until it is bound to a compatible Data Node source in the workspace bindings.
- Formatting is presentation-only. Hiding a column, applying a prefix, or adding a heatmap does not modify the upstream Data Node output.
- Changing the upstream Data Node transform can change the output columns. Reset columns from the current frame when the saved column schema no longer matches the incoming row shape.
- `Text` columns cannot render heatmaps, data bars, gauges, decimals, or threshold rules. Switch the format to `Number`, `Currency`, `Percent`, or `Bps` when the source values are numeric.
- Value mappings only render on columns currently formatted as `Text`; numeric threshold rules only render on columns currently using a numeric display format.
- Auto bounds are convenient for exploration but can make heatmap, data-bar, or gauge intensity shift after each refresh. Use fixed bounds when users need stable visual comparison over time.
- Prefix and suffix are literal display text. Do not use them to convert units or change numeric scale upstream.
