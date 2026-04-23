## buildPurpose

Theme-aware ECharts renderer for authored option payloads. Use it when a workspace needs a custom chart that is too specific for a fixed-purpose chart widget, while still respecting Command Center theme tokens and data-visualization palettes.

## whenToUse

- Use when the chart structure should be authored directly as an ECharts option payload.
- Use when an organization needs widget-type-specific ECharts capability ceilings or defaults.
- Use when an upstream AppComponent or other JSON-producing widget should publish the chart props dynamically.
- Use when a custom chart must stay readable across Command Center themes by using semantic theme colors instead of hard-coded hex values.
- Use when series colors, heat colors, visual maps, marks, labels, axes, and grid lines should follow the active theme's chart palettes.

## whenNotToUse

- Do not use when an existing typed chart widget already owns the desired dataset and interaction model.
- Do not use unsafe JavaScript mode unless the organization explicitly permits it.
- Do not hard-code chart colors unless the chart must preserve an external brand or regulatory color standard. Prefer theme tokens and palettes so the chart adapts to dark, light, and custom organization themes.

## authoringSteps

- Choose JSON or JavaScript source mode.
- Author the ECharts option payload or bind a JSON props payload from another widget.
- Verify that the payload fits the current organization capability mode.
- Prefer theme token references for semantic UI colors. Use string syntax like `"$theme.primary"`, `"$theme.foreground"`, `"$theme.muted-foreground"`, `"$theme.chart-grid"`, `"$theme.success"`, `"$theme.warning"`, `"$theme.danger"`, `"$theme.positive"`, or `"$theme.negative"` anywhere the ECharts option expects a color string.
- Use object theme-token syntax when opacity is needed: `{ "$themeToken": "warning", "alpha": 0.18 }`. This is useful for translucent area fills, mark areas, split areas, threshold bands, and subtle grid or tooltip backgrounds.
- Use categorical palette references for distinct series colors: `"$palette.categorical.0"`, `"$palette.categorical.1"`, or `{ "$palette": "categorical", "index": 2 }`. Indices wrap through the active theme palette, so multi-series charts should use palette indices instead of manually choosing unrelated colors.
- Use palette scale references for ordered numeric intensity: `{ "$paletteScale": "sequential.primary", "index": 4, "steps": 7 }`, `{ "$paletteScale": "sequential.success", "index": 3, "steps": 7 }`, `{ "$paletteScale": "sequential.warning", "index": 5, "steps": 7 }`, or `{ "$paletteScale": "sequential.neutral", "index": 2, "steps": 7 }`.
- Use diverging palette scales when values have a center point or positive/negative meaning: `{ "$paletteScale": "diverging.default", "index": 2, "steps": 5 }` or `{ "$paletteScale": "diverging.positive-negative", "index": 4, "steps": 7 }`.
- Apply theme tokens to non-series chrome too: use `"$theme.foreground"` or `"$theme.muted-foreground"` for title, legend, labels, and axis text; use `"$theme.chart-grid"` for split lines; use theme-token alpha objects for subtle axis pointers, tooltip backgrounds, mark areas, and visual-map backgrounds.
- In JavaScript builder mode, return a plain ECharts option object that contains token and palette references. The widget resolves those references after the object is returned. If the builder creates non-plain helper objects such as `echarts.graphic.*`, pass final colors into those helpers because token placeholders inside already-instantiated helper objects are not resolved.
- Bind one `core.value.json@v1` payload into `props-json` when an upstream widget should drive the chart spec. Bound props can provide `sourceMode`, `optionJson`, `optionBuilderSource`, or a structured `option` object.

## blockingRequirements

- JSON mode requires a valid JSON object that ECharts can consume as an option payload. It does not revive functions from strings.
- JavaScript builder mode requires the effective organization capability mode to be `unsafe-custom-js`; otherwise the widget falls back to JSON mode.
- Bound `props-json` input must resolve to a JSON object compatible with the widget props contract. Non-object values cannot drive the chart spec.
- Theme token and palette references must be placed in plain option objects or arrays before render. They are resolved by the widget after parsing JSON or after the JavaScript builder returns.
- Palette scale references require a valid scale name and index. Supported sequential scales are `primary`, `success`, `warning`, and `neutral`; supported diverging scales are `default` and `positive-negative`.

## commonPitfalls

- JSON mode does not parse functions from payload strings.
- Bound props JSON overrides matching local widget props when both are present.
- Unsafe JavaScript mode may be blocked by organization configuration and will then fall back to JSON mode.
- Theme and palette tokens in JavaScript mode are only resolved inside plain returned option objects; already-instantiated ECharts helper objects must still use final colors.
- Theme token references only resolve when the token name is valid. Invalid strings such as `"$theme.brandBlue"` or misspelled palette scales remain ordinary string values and can render incorrectly.
- Categorical palettes are for distinct series. Sequential palettes are for ordered magnitude. Diverging palettes are for centered or signed values. Using the wrong palette type can make the chart harder to interpret.
- Hard-coded colors may look acceptable in one theme but fail contrast or visual hierarchy in another theme. Use theme tokens first, then override only the few colors that truly must be fixed.
