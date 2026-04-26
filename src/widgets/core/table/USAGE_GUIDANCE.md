## buildPurpose

Formatted table for a bound `core.tabular_frame@v1` dataset, or manually authored rows, with one canonical `core.tabular_frame@v1` output.

## whenToUse

- Use when a workspace needs row-level inspection, sorting, filtering, search, pagination, pinned columns, or compact table density.
- Use when a tabular frame needs display configuration: header labels, descriptions, visibility, alignment, pinning, datetime rendering, numeric precision, prefix, suffix, compact-number notation, heatmaps, data bars, gauges, threshold rules, or value-label chips.
- Use manual mode only for display-only rows that should not become a reusable dataset source.
- Use it as a lightweight tabular source when a downstream widget should consume the table's canonical underlying rows.

## whenNotToUse

- Do not use when the widget must own data loading, filtering, aggregation, pivoting, or reshaping; use Connection Query and Tabular Transform upstream.
- Do not use for charting or KPI reduction when Graph or Statistic better matches the task.
- Do not expect hidden columns, renamed labels, or formatting rules to change the published dataset. Those are presentation-only.

## authoringSteps

- Choose `Bound dataset` when the table should render an upstream `core.tabular_frame@v1` output, or `Manual table` when rows should be authored directly in this widget.
- For bound mode, bind the inbound `sourceData` port to a Connection Query or Tabular Transform `dataset` output.
- For manual mode, define columns and rows in the table editor. Manual rows are stored in this table widget's props and are published as the table `dataset` output.
- Inspect the incoming field schema before editing columns. Prefer upstream `fields` metadata when available; otherwise the table infers labels, types, and numeric eligibility from the current row sample.
- Configure table-level presentation first. In the per-column editor, the default row keeps only key, label, format, and visibility inline; expand `Advanced` when a column needs descriptions, pinning, Date/time input or output patterns, numeric visuals, or display overrides.
- Use the `Date/time` column format for epoch timestamps or date strings that should be rendered as readable dates. Auto parsing handles ISO-like strings plus epoch seconds, milliseconds, microseconds, and nanoseconds. Set `Input format` only when auto parsing is ambiguous; set `Output format` to control the rendered text.
- Date/time pattern tokens include `yyyy`, `yy`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `SSS`, and `a`. Example: input `dd/MM/yyyy HH:mm:ss` and output `yyyy-MM-dd HH:mm:ss`.
- Bind downstream widgets to the table `dataset` output when they should consume the same canonical tabular frame.

## blockingRequirements

- Bound mode requires a compatible upstream `core.tabular_frame@v1` binding.
- When the upstream source publishes incremental metadata, the table consumes the retained
  full `upstreamBase` frame and renders it as a snapshot.
- Manual mode requires at least one manual column before the table can render a schema.
- The incoming frame must normalize to table rows. Canonical frames provide `columns: string[]` and `rows: Array<Record<string, unknown>>`.
- Legacy backend time-series frames are coerced to canonical tabular rows before rendering.
- Connection response envelopes with `frames[]` are unwrapped to the first compatible publishable frame before rendering.
- Column `key` values must match fields present in the incoming frame.
- Numeric visuals require numeric source values and usable bounds.
- Date/time formatting requires values that can be parsed automatically or by the configured input pattern.

## commonPitfalls

- Bound mode stays empty until it is bound to a compatible source in the workspace bindings.
- Formatting is presentation-only. Hiding a column, applying a prefix, or adding a heatmap does not modify the published table `dataset` output.
- Changing the upstream transform can change the output columns. Reset columns from the current frame when the saved column schema no longer matches the incoming row shape.
- Prefix and suffix are literal display text. Do not use them to convert units or change numeric scale upstream.
- Date/time formatting is presentation-only. It does not convert the published `dataset` output values for downstream widgets.
