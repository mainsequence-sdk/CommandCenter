# Connection Query Widget

This folder owns the core `connection-query` widget. It is the generic workspace source node for
backend-owned connection instances.

## Entry Points

- `definition.ts`: widget definition, IO contract, registry metadata, and execution ownership.
- `connectionQueryModel.ts`: props normalization, connection response normalization, and execution helpers.
- `ConnectionQueryWidget.tsx`: compact runtime renderer for the latest published frame status.
- `ConnectionQueryWidgetSettings.tsx`: instance settings UI with connection picker, query model
  selection, query editor, range controls, variables, and selected frame controls.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget stores a stable `ConnectionRef`, selected `queryModelId`, query payload, optional
  variables, time-range behavior, row limit, and selected response frame.
- Runtime execution calls `queryConnection(...)` and publishes one dataset from the selected
  response frame. Tabular frames publish `core.tabular_frame@v1`; time-series frames publish
  `core.time_series_frame@v1`.
- Connection-specific `queryEditor` components are used when the selected connection type provides
  one. The generic JSON editor is the fallback.
- The widget is fixed to sidebar placement. It is a source/execution node, not a canvas
  visualization.
- The widget is an `execution-owner`; mounted runtime UI renders the latest `runtimeState` and does
  not independently query the backend.

## Maintenance Constraints

- Keep backend access routed through `src/connections/api.ts`.
- Do not store endpoint URLs, route fragments, tokens, or secrets in props.
- Keep output shape aligned with `core.tabular_frame@v1` and `core.time_series_frame@v1` because
  downstream consumers depend on those stable contracts.
- Keep `fixedPlacementMode` aligned with `defaultPresentation`; removing the fixed sidebar
  placement changes how source widgets are authored in workspaces.
- Bump `widgetVersion` when props, output shape, execution behavior, or authoring semantics change.
