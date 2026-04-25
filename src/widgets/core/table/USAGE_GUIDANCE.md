## buildPurpose

Formatted table for a bound `core.tabular_frame@v1` or `core.time_series_frame@v1` dataset, or manually authored rows.

## whenToUse

- Use when a workspace needs row-level inspection, sorting, filtering, search, pagination, pinned columns, or compact table density.
- Use when a tabular or time-series frame needs display configuration: header labels, descriptions, visibility, alignment, pinning, numeric precision, prefix, suffix, compact-number notation, heatmaps, data bars, gauges, threshold rules, or value-label chips.
- Use manual mode only for display-only rows that should not become a reusable dataset source.

## whenNotToUse

- Do not use when the widget must own data loading, filtering, aggregation, pivoting, or reshaping; use Connection Query and Tabular Transform upstream.
- Do not use when the workspace needs to publish a new dataset for other widgets. This table is a consumer/manual display surface and formatter.
- Do not use for charting or KPI reduction when Graph or Statistic better matches the task.

## authoringSteps

- Choose `Bound dataset` when the table should render an upstream `core.tabular_frame@v1` or `core.time_series_frame@v1` output, or `Manual table` when rows should be authored directly in this widget.
- For bound mode, bind the inbound `sourceData` port to a Connection Query or Tabular Transform `dataset` output.
- For manual mode, define columns and rows in the table editor. Manual rows are stored in this table widget's props and are not published as a reusable dataset.
- Inspect the incoming field schema before editing columns. Prefer upstream `fields` metadata when available; otherwise the table infers labels, types, and numeric eligibility from the current row sample.
- Configure table-level presentation, column formatting, value mappings, and numeric visual treatments.

## blockingRequirements

- Bound mode requires a compatible upstream `core.tabular_frame@v1` or `core.time_series_frame@v1` binding.
- Manual mode requires at least one manual column before the table can render a schema.
- The incoming frame must normalize to table rows. Tabular frames provide `columns: string[]` and `rows: Array<Record<string, unknown>>`; time-series frames are converted through the shared time-series adapter first.
- Time-series frames that provide `fields[].values` can still be inspected as rows even when graph-specific time-series metadata is incomplete.
- Connection response envelopes with `frames[]` are unwrapped to the first compatible tabular or time-series frame before rendering.
- Empty placeholder frames with no columns, rows, or fields are ignored when the bound source widget has usable runtime frame data.
- Column `key` values must match fields present in the incoming frame.
- Numeric visuals require numeric source values and usable bounds.

## commonPitfalls

- Bound mode stays empty until it is bound to a compatible source in the workspace bindings.
- Formatting is presentation-only. Hiding a column, applying a prefix, or adding a heatmap does not modify the upstream output.
- Changing the upstream transform can change the output columns. Reset columns from the current frame when the saved column schema no longer matches the incoming row shape.
- Prefix and suffix are literal display text. Do not use them to convert units or change numeric scale upstream.
