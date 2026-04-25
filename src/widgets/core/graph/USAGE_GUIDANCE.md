## buildPurpose

Line, area, or bar chart for a bound `core.time_series_frame@v1` or `core.tabular_frame@v1` dataset.

## whenToUse

- Use when a time-series frame or tabular dataset should be rendered as a line, area, or bar chart.
- Use when the upstream source already declares time-series semantics and the graph should auto-map time, value, and series fields.
- Use when rows can be mapped to an X field, a numeric Y field, and an optional grouping field.
- Use when the chart needs local provider choice, chart type, grouping filters, series normalization, axis mode, or per-series color and line-style overrides.

## whenNotToUse

- Do not use when the widget should own the source data query or transform pipeline; use Connection Query and Tabular Transform upstream.
- Do not use for row inspection or KPI cards when Table or Statistic better matches the output.
- Do not use for arbitrary renderer-specific chart specs; use a JSON/spec widget for those.

## authoringSteps

- Bind `sourceData` to an upstream `core.time_series_frame@v1` or `core.tabular_frame@v1` output.
- For time-series sources, review the metadata-derived defaults.
- For tabular sources, choose X and Y fields that match the intended chart.
- Optionally choose a grouping field, provider, chart type, normalization, series-axis mode, and visible group filters.
- Inspect the resolved source schema before finalizing field mappings.

## blockingRequirements

- A compatible upstream binding is required before field selectors become meaningful.
- Tabular sources need a selected Y field with numeric values.
- Tabular time rendering requires an X field that can be interpreted as date or datetime values.

## commonPitfalls

- Ambiguous date strings can make the inferred time axis behave unexpectedly.
- Several rows at the same chart timestamp collapse to the latest point for that timestamp.
- Group filters only affect this chart; they do not modify the upstream dataset.
