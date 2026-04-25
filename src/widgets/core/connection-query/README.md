# Connection Query Widget

This folder owns the core `connection-query` widget. It is the generic workspace source node for
backend-owned connection instances.

## Entry Points

- `definition.ts`: widget definition, IO contract, registry metadata, and execution ownership.
- `connectionQueryModel.ts`: props normalization, connection response normalization, and execution helpers.
- `ConnectionQueryWidget.tsx`: compact runtime renderer for the latest published frame status.
- `ConnectionQueryWidgetSettings.tsx`: thin settings wrapper around
  `src/connections/ConnectionQueryWorkbench.tsx`. It supplies workspace dashboard dates and stores
  the resulting draft props on the widget.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget stores a stable `ConnectionRef`, selected `queryModelId` connection path, query
  payload, optional variables, date runtime behavior, and row limit.
- The selected `queryModelId` is authoritative and is always sent as `query.kind`; the generic JSON
  editor cannot redirect a saved widget to another connection path.
- Runtime execution calls `queryConnection(...)` and publishes one dataset from the first matching
  response frame. The widget always publishes `core.tabular_frame@v1`. Legacy backend
  series-shaped responses are coerced into tabular rows plus `meta.timeSeries` defaults at the
  widget edge.
- The settings test action uses the same request builder as runtime execution. Workspace dates are
  read from dashboard controls; custom fixed dates are stored in props. Returned frames render
  through `src/connections/ConnectionQueryResponsePreview.tsx`, matching Data Sources Explore
  because both surfaces use `ConnectionQueryWorkbench.tsx`.
- Connection-specific `queryEditor` components are used when the selected connection type provides
  one. They receive the selected connection instance, connection type, selected query model, and
  current query payload so each connection can render its own kwargs. The generic JSON editor is
  the fallback only for connection types that do not provide an editor.
- The standard `variables` request envelope is only shown and sent when the selected query model
  advertises `supportsVariables: true`. Connector-specific query kwargs must stay in the selected
  connection editor.
- Time-range-aware connection paths always send the top-level connection request `timeRange` as
  ISO strings. Authors choose either the workspace date range or a saved custom date range. Do not
  add connection-specific date-field injection in this generic widget.
- The widget is fixed to sidebar placement. It is a source/execution node, not a canvas
  visualization.
- The widget is an `execution-owner`; mounted runtime UI renders the latest `runtimeState` and does
  not independently query the backend.

## Maintenance Constraints

- Keep backend access routed through `src/connections/api.ts`.
- Do not store endpoint URLs, route fragments, tokens, or secrets in props.
- Keep the standard request envelope generic. Connection-specific details belong in the selected
  connection definition's typed query editor and backend adapter validation.
- Keep the widget-facing output shape aligned with `core.tabular_frame@v1`. If a backend still
  returns an older series-shaped response, coerce it before publication instead of exposing a
  second widget-facing frame model to consumers.
- Keep `fixedPlacementMode` aligned with `defaultPresentation`; removing the fixed sidebar
  placement changes how source widgets are authored in workspaces.
- Bump `widgetVersion` when props, output shape, execution behavior, or authoring semantics change.
