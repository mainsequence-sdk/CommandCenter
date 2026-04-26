## buildPurpose

Line, area, or bar chart for a bound `core.tabular_frame@v1` dataset.

## whenToUse

- Use when a tabular dataset should be rendered as a line, area, or bar chart.
- Use when rows can be mapped to an X field, a numeric Y field, and an optional grouping field.
- Use when the chart needs local provider choice, chart type, series normalization, axis mode, or per-series color and line-style overrides.

## whenNotToUse

- Do not use when the widget should own the source data query or transform pipeline; use Connection Query and Tabular Transform upstream.
- Do not use for row inspection or KPI cards when Table or Statistic better matches the output.
- Do not use for arbitrary renderer-specific chart specs; use a JSON/spec widget for those.

## authoringSteps

- Bind `sourceData` to an upstream `core.tabular_frame@v1` output.
- Choose X and Y fields that match the intended chart.
- Optionally choose a grouping field, provider, chart type, normalization, and series-axis mode. Leave `Normalize at` blank to rebase each series from its first visible usable point.
- Inspect the resolved source schema before finalizing field mappings.

## blockingRequirements

- A compatible upstream binding is required before field selectors become meaningful.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. When the update is safe for incremental rendering, the graph appends or replaces
  projected points while preserving the mounted chart instance and visible range.
- Tabular sources need a selected Y field with numeric values.
- Tabular time rendering requires an X field that can be interpreted as date or datetime values.

## commonPitfalls

- The graph does not auto-map fields from upstream time-series metadata; you must set the field mapping explicitly.
- Ambiguous date strings can make the inferred time axis behave unexpectedly.
- Several rows at the same chart timestamp collapse to the latest point for that timestamp.
