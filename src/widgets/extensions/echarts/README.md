# ECharts Widgets

This directory contains the ECharts-backed widget modules used by the live widget catalog.

## Files

- `definition.ts`: widget registration metadata for the spec-driven ECharts widget.
- `EChartsSpecWidget.tsx`: runtime ECharts renderer plus JSON/unsafe-JS compilation and
  organization-capability enforcement.
- `EChartsSpecWidgetSettings.tsx`: custom settings surface for authoring the option payload and
  previewing the effective organization capability mode.

## Notable behavior

- `echarts-spec` is intentionally spec-driven. It renders a raw ECharts option payload instead of a
  fixed business-specific dataset contract.
- The widget exposes one typed input, `props-json`, which accepts `core.value.json@v1`. Bound JSON
  is merged over the saved widget props before the ECharts option is compiled, so AppComponent and
  other JSON-producing widgets can publish a full chart config into this widget. Upstream payloads
  can provide the chart spec either as `optionJson` or directly as a structured `option` object.
- When a bound upstream source publishes incremental metadata, the widget reads the retained
  `upstreamBase` JSON value. It does not apply partial deltas to an existing ECharts option.
- The widget is the first frontend widget to opt into `organizationConfiguration`. It publishes a
  widget-type schema, a default organization configuration, and runtime enforcement of the resolved
  organization override row.
- JSON mode never revives functions from strings. Trusted snippets are injected locally through a
  small allowlisted registry, and unsafe JavaScript mode is only available when the effective
  organization capability mode is `unsafe-custom-js`.
- Capability and risk messaging for unsafe JavaScript mode belongs in settings and configuration
  surfaces. The runtime chart surface should stay focused on rendering results and hard failures,
  not persistent capability warnings.
- JSON mode and JavaScript-builder mode both support semantic theme color references when the
  option stays a plain returned object/array tree. Two supported forms are string tokens such as
  `"$theme.primary"` and object tokens such as `{ "$themeToken": "warning", "alpha": 0.18 }`.
- JSON mode and JavaScript-builder mode also support theme data-viz palette references inside plain
  returned option objects. Supported forms include
  `"$palette.categorical.0"`, `{ "$palette": "categorical", "index": 2 }`, and scale references
  such as `{ "$paletteScale": "sequential.primary", "index": 4, "steps": 7 }` or
  `{ "$paletteScale": "diverging.default", "index": 2, "steps": 5 }`.
- Non-plain runtime helper objects such as already-instantiated `echarts.graphic.*` values are left
  untouched. If JavaScript mode constructs those objects directly, pass final colors into them
  instead of theme-token placeholders.
- The default starter chart is a JSON-safe animated bar chart inspired by the Apache ECharts
  `bar-animation-delay` example, but adapted to avoid function callbacks and to showcase the
  theme-driven categorical, sequential, and diverging palette helpers.

## Maintenance notes

- Keep organization capability enforcement aligned with
  [ADR: Organization-Scoped Widget Type Configurations](../../../../docs/adr/adr-organization-widget-type-configurations.md).
- If new trusted snippets are added, document them here and keep the local allowlist behavior
  aligned with the effective organization configuration.
- If the typed input contract changes, update both the widget README and the registry metadata in
  `definition.ts` so the binding UI stays discoverable.
- If the widget's organization configuration contract changes materially, bump both `widgetVersion`
  and `organizationConfiguration.version`.
