## buildPurpose

Line, area, or bar chart for a canonical `core.tabular_frame@v1` dataset, with optional graph-owned managed connection-query authoring that still resolves through `sourceData`.

## whenToUse

- Use when a tabular dataset should be rendered as a line, area, or bar chart.
- Use when rows can be mapped to an X field, a numeric Y field, and an optional grouping field.
- Use when the chart needs local provider choice, chart type, series normalization, axis mode, or per-series color and line-style overrides.
- Use the managed connection flow when one chart should own its own query without adding a visible standalone source widget to the rail.

## whenNotToUse

- Do not use when several widgets should share one query result; create one explicit standalone Connection Query widget upstream and bind several consumers to it.
- Do not use when the widget should own transforms after the query returns; use Tabular Transform upstream.
- Do not use for row inspection or KPI cards when Table or Statistic better matches the output.
- Do not use for arbitrary renderer-specific chart specs; use a JSON/spec widget for those.

## authoringSteps

- Open the `Bindings` tab.
- Bind `sourceData` to an upstream `core.tabular_frame@v1` output when this graph should consume an existing dataset.
- Or click `Add connection` in the `Bindings` tab when this graph should own one hidden managed source widget.
- Configure that managed source from the dedicated `Connection` tab with the same connection/path/query/runtime controls used by the standalone Connection Query widget.
- Apply the connection changes to create or update the hidden source widget and bind its `dataset` output to this graph's `sourceData` input automatically.
- Choose X and Y fields that match the intended chart.
- Optionally choose a grouping field, provider, chart type, normalization, and series-axis mode. Leave `Normalize at` blank to rebase each series from its first visible usable point.
- Inspect the resolved source schema before finalizing field mappings. Field pickers and chart rendering always resolve from the live `sourceData` binding, including when that binding points at the hidden managed source widget.

## blockingRequirements

- A compatible upstream binding is required before field selectors become meaningful.
- In managed connection mode, the hidden source must still publish a canonical dataset before the graph can resolve fields.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. When the update is safe for incremental rendering, the graph appends or replaces
  projected points while preserving the mounted chart instance and visible range.
- Tabular sources need a selected Y field with numeric values.
- Tabular time rendering requires an X field that can be interpreted as date or datetime values.

## commonPitfalls

- Managed connection authoring is still not a second runtime path. The graph renders only from the resolved `sourceData` binding.
- The graph does not auto-map fields from upstream time-series metadata; you must set the field mapping explicitly.
- Ambiguous date strings can make the inferred time axis behave unexpectedly.
- Several rows at the same chart timestamp collapse to the latest point for that timestamp.
- If this graph is backed by a hidden managed connection source, fix any source runtime error in the `Connection` tab before debugging chart field mappings.
