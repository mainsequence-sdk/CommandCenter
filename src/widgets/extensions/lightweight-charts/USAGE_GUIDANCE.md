## lightweight-charts-spec

### buildPurpose

Theme-aware Lightweight Charts renderer for declarative safe-JSON specs.

### whenToUse

- Use when the chart should be authored as a full Lightweight Charts spec instead of a tiny typed DSL.
- Use when the visualization is time-series-native and fits Lightweight Charts better than ECharts.
- Use when an upstream AppComponent or other JSON-producing widget should publish the chart props dynamically.
- Use when line, area, baseline, histogram, candlestick, or bar series need custom chart options, data, markers, price lines, panes, or price-scale behavior.
- Use when a chart must stay readable across Command Center themes by using semantic theme colors instead of hard-coded hex values.
- Use when financial chart colors should follow the active theme's positive/negative, categorical, sequential, or diverging chart palettes.

### whenNotToUse

- Do not use for arbitrary graph, sankey, or layout-heavy visualizations that belong in ECharts.
- Do not expect arbitrary JavaScript execution in this first version; the widget is safe JSON only.
- Do not use when a dedicated Data Node chart, curve plot, zero curve, or statistic widget already owns the dataset mapping and interaction model.
- Do not hard-code chart colors unless the chart must preserve an external brand or regulatory color standard. Prefer theme tokens and palettes so the chart adapts to dark, light, and custom organization themes.

### authoringSteps

- Author the chartOptions and series definitions in JSON.
- Attach the series data, markers, and price lines in the same spec.
- Define a safe JSON spec with optional `chartOptions`, `fitContent`, and a required `series` array. Each series needs an `id`, supported `type`, `data`, and optional `options`, `paneIndex`, `markers`, `markersOptions`, and `priceLines`.
- Use supported series types deliberately: `line`, `area`, `baseline`, and `histogram` data points use `time` plus `value`; `candlestick` and `bar` data points use `time`, `open`, `high`, `low`, and `close`.
- Prefer theme token references for semantic UI colors. Use string syntax like `"$theme.background"`, `"$theme.foreground"`, `"$theme.muted-foreground"`, `"$theme.border"`, `"$theme.chart-grid"`, `"$theme.primary"`, `"$theme.success"`, `"$theme.warning"`, `"$theme.danger"`, `"$theme.positive"`, or `"$theme.negative"` anywhere the Lightweight Charts spec expects a color string.
- Use object theme-token syntax when opacity is needed: `{ "$themeToken": "chart-grid", "alpha": 0.08 }` or `{ "$themeToken": "background", "alpha": 1 }`. This is useful for layout background colors, grid lines, crosshair lines, subtle scale borders, markers, and price-line treatments.
- Use categorical palette references for distinct series or per-bar colors: `"$palette.categorical.0"`, `"$palette.categorical.1"`, or `{ "$palette": "categorical", "index": 2 }`. Indices wrap through the active theme palette, so multi-series charts should use palette indices instead of unrelated manual colors.
- Use palette scale references for ordered numeric intensity: `{ "$paletteScale": "sequential.primary", "index": 4, "steps": 7 }`, `{ "$paletteScale": "sequential.success", "index": 3, "steps": 7 }`, `{ "$paletteScale": "sequential.warning", "index": 5, "steps": 7 }`, or `{ "$paletteScale": "sequential.neutral", "index": 2, "steps": 7 }`.
- Use diverging palette scales when values have a center point or positive/negative meaning: `{ "$paletteScale": "diverging.default", "index": 2, "steps": 5 }` or `{ "$paletteScale": "diverging.positive-negative", "index": 4, "steps": 7 }`.
- Apply theme tokens to chart chrome and financial semantics: use `"$theme.background"` for `chartOptions.layout.background.color`, `"$theme.muted-foreground"` for `layout.textColor`, `"$theme.chart-grid"` for grid lines, `"$theme.border"` for scale borders, and `"$theme.positive"` / `"$theme.negative"` for candlestick `upColor`, `downColor`, wick colors, and related price action styling.
- Apply palette references to data and annotations where they carry information: histogram data row `color`, series `options` colors, marker `color`, price-line `color`, crosshair colors, and pane-specific visual treatments can all use the same token or palette syntax.
- Bind one `core.value.json@v1` payload into `props-json` when an upstream widget should drive the chart spec. A valid binding replaces saved local props and can provide `specJson`, a structured `spec` object, or the raw spec object directly.

### blockingRequirements

- The widget is safe JSON only. The spec must be valid JSON or a structured JSON object; arbitrary JavaScript and lifecycle callbacks are not executed.
- The spec must include a `series` array and each series must use one supported type: `line`, `area`, `baseline`, `histogram`, `candlestick`, or `bar`.
- Series data must match the series type. OHLC series require numeric `open`, `high`, `low`, and `close`; other value series require numeric `value` when a value is present.
- The spec must fit the effective organization resource budget, including maximum option depth, string length, array length, series count, points per series, markers per series, and price lines per series.
- Bound `props-json` input must resolve to a JSON object compatible with the widget props contract. Non-object values cannot drive the chart spec.
- Incremental upstream sources expose retained props through `upstreamBase`; this widget rebuilds
  from that retained JSON value instead of applying partial deltas.
- Palette scale references require a valid scale name and index. Supported sequential scales are `primary`, `success`, `warning`, and `neutral`; supported diverging scales are `default` and `positive-negative`.

### commonPitfalls

- The spec is declarative. It does not run arbitrary chart lifecycle code.
- Bound props JSON overrides matching local widget props when both are present.
- Series data still needs to match the chosen series type, for example OHLC objects for candlestick/bar series.
- Theme token references only resolve when the token name is valid. Invalid strings such as `"$theme.brandBlue"` or misspelled palette scales remain ordinary string values and can render incorrectly.
- Categorical palettes are for distinct series or per-point categories. Sequential palettes are for ordered magnitude. Diverging palettes are for centered or signed values. Using the wrong palette type can make financial movement or risk intensity harder to interpret.
- Hard-coded colors may look acceptable in one theme but fail contrast or visual hierarchy in another theme. Use theme tokens first, then override only colors that truly must be fixed.
- Clearing the local spec is useful when a binding drives the widget, because a valid bound spec replaces saved props while the binding is active.
