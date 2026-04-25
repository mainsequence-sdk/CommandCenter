## buildPurpose

OHLC bar chart for a bound tabular market dataset. The upstream tabular response must publish one
row per bar with time, open, high, low, and close values.

## whenToUse

- Use when an upstream Connection Query or Tabular Transform publishes market bars that should be
  plotted as open-high-low-close bars with TradingView Lightweight Charts.
- Use when the dataset is already shaped as a tabular frame and the widget only needs to map columns
  into a chart.

## whenNotToUse

- Do not use when the source table contains a single price series without open/high/low fields; use
  a line, area, or spec-driven chart instead.
- Do not use when the widget must fetch market data itself. This widget is a consumer of a bound
  dataset and does not own backend execution.

## authoringSteps

- Bind the widget to a compatible upstream dataset through the Source data input.
- Ensure the upstream rows contain one temporal field plus numeric open, high, low, and close fields.
- Let the widget infer common field names such as `time`, `time_index`, `date`, `open`, `high`,
  `low`, and `close`, or map the fields manually in settings.

## blockingRequirements

- A compatible upstream `core.tabular_frame@v1` binding is required.
- The tabular response must include rows equivalent to:

```json
{
  "rows": [
    {
      "time": "2026-01-02T14:30:00Z",
      "open": 101.2,
      "high": 103.4,
      "low": 100.8,
      "close": 102.7
    }
  ]
}
```

- Field names may differ if they are mapped in settings, but each rendered row must provide a
  parseable time value and numeric open, high, low, and close values.

## commonPitfalls

- Time values must parse as ISO date strings, ISO datetime strings, Unix seconds, Unix
  milliseconds, Unix microseconds, or Unix nanoseconds.
- Price values may be numbers or numeric strings, but empty strings, null values, and non-numeric
  strings are skipped.
- Rows are sorted by parsed time before plotting, so duplicate timestamps can visually overlap.
