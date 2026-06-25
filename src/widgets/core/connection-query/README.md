# Connection Query Widget

This folder owns the core `connection-query` widget. It is the generic workspace source node for
backend-owned connection instances.

## Entry Points

- `definition.ts`: widget definition, IO contract, registry metadata, and execution ownership.
- `connectionQueryModel.ts`: props normalization, connection response normalization, and execution helpers.
- `incrementalConnectionRefresh.ts`: in-memory retained response store, incremental request
  planning, and `core.tabular_frame@v1` row merge/prune behavior for workspace refreshes.
- `ConnectionQueryWidget.tsx`: compact runtime renderer for the latest published frame status.
- `ConnectionQueryRailSummary.tsx`: workspace rail hover summary that resolves the selected
  connection type and renders its logo, selected path, backend connection id, and runtime status.
- `ConnectionQueryWidgetSettings.tsx`: thin settings wrapper around
  `src/connections/ConnectionQuerySettingsSurface.tsx`. It supplies live widget runtime status,
  workspace dashboard dates, and stores the resulting draft props on the widget. When the selected
  connection type provides a typed `queryEditor`, settings now render that editor directly so the
  widget shares the same authoring surface as Explore. Connection-specific draft defaults, query
  model filtering, and summary behavior come from the selected connection type's
  `authoringContract`, not from a widget-only initialization path.
- `ConnectionQueryWidgetSchema.tsx`: schema-backed connection path controls. It exposes individual
  selected query-model controls such as symbols, timeframe, feed, limit, page token, interval, and
  cursors as separate poppable canvas companion cards.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget stores a stable `ConnectionRef`, selected `queryModelId` connection path, query
  payload, optional editor-state metadata for typed query editors, optional variables, date runtime
  behavior, row limit, and optional incremental refresh settings.
- The selected `queryModelId` is authoritative and is always sent as `query.kind`; legacy or
  inferred drafts may fall back to `query.kind` only when it matches a query model on the selected
  connection type. Query-model defaults fill missing query fields, but resolved/saved query fields
  always win so reference-backed settings are not erased by default application.
- Runtime execution calls `queryConnection(...)` and publishes one dataset from the first matching
  response frame. The widget always publishes `core.tabular_frame@v1`. Legacy backend
  series-shaped responses are coerced into canonical tabular rows at the widget edge.
- Anonymous public execution now uses widget-scoped `publicExecution.queryUrl` metadata from the
  published public workspace payload instead of the private `/connections/:id/query/` route. In
  that mode the frontend sends only the backend public request contract: top-level `capability`
  plus the allowed `timeRange` and `variables` inputs. It does not send `connectionId`, nested
  private query envelopes, or derive execution from `props.connectionRef`. Public client
  dedupe/identity keys switch to the public execution URL rather than the private connection id.
- Runtime publication writes HTTP snapshots and incremental batches into the workspace runtime data
  store when one is available. The saved widget runtime state carries a ref-backed shell plus
  small update metadata, and source-widget runtime shells now also retain inline rows so cold
  reloads and settings previews can still render when the in-memory runtime store has not been
  rehydrated yet. Legacy consumers can still materialize the retained tabular frame through the
  shared compatibility path.
- The settings test action uses the same request builder and effective query-model resolution as
  runtime execution. Workspace dates are
  read from dashboard controls; custom fixed dates are stored in props. Returned frames render
  through `src/connections/ConnectionQueryResponsePreview.tsx`, matching Data Sources Explore
  because both surfaces use `ConnectionQueryWorkbench.tsx`. When a saved setting path is backed by
  a widget reference expression, the settings request preview and test action resolve that
  reference-backed draft value through the shared dependency layer before building the request, so
  the preview payload matches runtime execution instead of echoing the raw `$(widget).source`
  authoring string. If a required reference-backed query value is not available yet, the workbench
  reports that it is waiting for the referenced value and does not send a backend request.
- When the shared settings workbench runs for a real widget instance, the test action also
  publishes the resulting runtime frame back onto that widget's live runtime state. This keeps the
  widget's own runtime card, hidden managed-source consumers, and downstream `sourceData` bindings
  aligned with the tested result instead of leaving the frame trapped in local preview state.
- When this widget is owned as a hidden managed connection source, variable-backed owner settings
  are projected into this widget as execution-only props during variable invalidation. The runtime
  frame is refreshed and persisted on the managed source, but the projected props are not written
  back into saved workspace props. The effective execution identity is the resolved connection
  request, not only the hidden source widget id or connection id.
- The settings surface also shows the current live runtime status for this source widget. Draft
  query changes do not silently overwrite the last published runtime state until the widget is run
  again through normal execution or the settings test action.
- Connection-specific `queryEditor` components are used when the selected connection type provides
  one. They receive the selected connection instance, connection type, selected query model, and
  current query payload plus optional editor-state metadata so each connection can render its own
  kwargs and exploration flow without losing authoring-mode state on reopen. The generic JSON
  editor is the fallback only for connection types that do not provide an editor.
- When a connection type publishes `authoringContract`, the shared workbench uses that contract
  when a user selects a connection or connection path so the widget seeds the same query model,
  payload defaults, filtered query-model list, and fixed-date fallbacks as Data Sources Explore.
- Connection-specific path configuration is still schema-backed and poppable per field, but the
  sidebar settings use that schema as a fallback path rather than overriding typed query editors.
  Canvas exposure still uses the shared schema form so eligible fields can be shown as individual
  dashboard companion cards.
- String-list path controls such as symbols use the shared connection query list editor. Editing a
  committed token keeps the saved query value intact until the replacement is committed; explicit
  removal is only done through the token remove button.
- The standard `variables` request envelope is only shown and sent when the selected query model
  advertises `supportsVariables: true`. Connector-specific query kwargs must stay in the selected
  connection editor.
- Time-range-aware connection paths always send the top-level connection request `timeRange` as
  ISO strings. Authors choose either the workspace date range or a saved custom date range. Do not
  add connection-specific date-field injection in this generic widget.
- Time-range-aware workspace queries can opt into incremental refresh. The widget keeps the last
  canonical `core.tabular_frame@v1` response in memory per widget/query identity, sends a smaller
  follow-up `timeRange` from the retained watermark minus overlap, merges returned rows using the
  user-selected `incrementalMergeKeyFields`, and prunes rows by `incrementalTimeField`.
- Initial workspace execution, settings test/manual submit, and manual upstream recalculation run a
  full snapshot request and replace the retained base before later dashboard refreshes request
  deltas. Persisted widget runtime output is not treated as a successful live refresh cursor.
- Incremental refresh remains frontend-only. The backend receives the same query envelope; only
  follow-up request ranges are narrower. The widget now publishes:
  - `dataset`: retained full tabular frame for legacy consumers
  - `updates`: explicit incremental publication output for `seedData` / `liveUpdates` consumers
  Both outputs share the same `widget-runtime-update@v1` envelope so HTTP incremental behavior
  stays backward compatible while live-capable widgets can bind the role they actually need.
- Identical in-flight incremental requests for the same widget/query identity are deduped so rapid
  overlapping refresh triggers share one backend call instead of racing duplicate writes into the
  retained frame.
- The widget is fixed to sidebar placement. It is a source/execution node, not a canvas
  visualization.
- Workspace graph cards and the edit-mode widget rail should prefer the selected connection type's
  icon when `connectionRef.typeId` is configured, falling back to the generic source icon only
  when the widget has not selected a connection yet.
- The widget is an `execution-owner`; mounted runtime UI renders the latest `runtimeState` and does
  not independently query the backend.
- Passive downstream consumers may ask the dashboard execution provider to resolve this source
  once when no publication exists. After this widget publishes `ready`, `null`, empty, or `error`
  runtime state, that publication is the settled upstream answer for the current invalidation; do
  not add connection-local retry effects to satisfy passive consumers.
- The mounted runtime card now treats `idle` and first-load `loading` without retained rows as an
  initial waiting state. It should not render `0 rows / 0 columns` until the widget has produced a
  real response frame.
- Workspace graph and rail status must not mark this source green only because it is configured
  enough to execute. Until a request publishes runtime data, the source remains waiting; backend
  request failures should publish an error frame and show the error state.

## Maintenance Constraints

- Keep backend access routed through `src/connections/api.ts`.
- Keep public runtime execution routed through widget-scoped `publicExecution.queryUrl` metadata;
  do not fall back to private `/connections/:id/query/` calls once the execution surface is
  `public-workspace`.
- Do not store endpoint URLs, route fragments, tokens, or secrets in props.
- Keep the standard request envelope generic. Connection-specific details belong in the selected
  connection definition's typed query editor and backend adapter validation.
- Keep `ConnectionQueryWidgetSchema.tsx` aligned with connection query-model `controls` metadata
  when changing query editor behavior. The widget intentionally hides the workbench query section
  in settings and manually places the shared schema form below the path selector, avoiding
  duplicated provider-specific fields while keeping companion-card exposure intact.
- Keep the widget-facing output shape aligned with `core.tabular_frame@v1`. If a backend still
  returns an older series-shaped response, coerce it before publication instead of exposing a
  second widget-facing frame model to consumers.
- Keep incremental dedupe generic. `incrementalTimeField` controls tail requests and retention
  pruning; `incrementalMergeKeyFields` is the user-selected column combination used for row
  replacement and must not be hard-coded to symbol/time semantics.
- Keep `fixedPlacementMode` aligned with `defaultPresentation`; removing the fixed sidebar
  placement changes how source widgets are authored in workspaces.
- Bump `widgetVersion` when props, output shape, execution behavior, or authoring semantics change.
