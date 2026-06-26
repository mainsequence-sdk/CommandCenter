## buildPurpose

Runs one explicit connection path and publishes the selected result frame as one canonical `core.tabular_frame@v1` dataset for downstream workspace widgets.
When a workspace runtime data store is available, the retained frame is published through runtime data refs for downstream bindings while the source widget keeps enough inline row data for cold reload and settings preview fallback.

## whenToUse

- Use when a workspace needs a reusable dataset from a backend-owned connection instance.
- Use when a connection type exposes a path/query model that returns rows, metrics, SQL results, time-series points, or another normalized frame.
- Use when table, chart, statistic, curve, transform, or agent-facing widgets should consume the same query result.
- Use when the query should follow the workspace time range or a saved fixed range.

## whenNotToUse

- Do not use for presentation-only table, chart, or statistic rendering; bind those widgets to this widget's `dataset` or `updates` output depending on whether they need retained seed data or explicit incremental publications.
- Do not use to store backend endpoints, tokens, or route fragments in workspace props.
- Do not use for analytical reshaping after the query returns; bind a Tabular Transform widget downstream.

## authoringSteps

- Select a configured connection instance.
- Select one of the connection type's paths/query models. The selected path is saved and sent as
  `query.kind`; legacy drafts may fall back to `query.kind` only when it matches a query model on
  the selected connection type.
- Configure the selected path's connection-owned fields directly below the path selector.
- For list fields such as symbols or identifiers, type values directly in the multiline editor.
  Values can be separated with newlines or commas and are stored as the parsed `string[]` while
  typing.
- Configure the query using the connection-specific editor when available. These editors render
  connection-owned kwargs such as Data Node columns and identifier filters, SQL parameters,
  PostgreSQL time-series field mapping, or Prometheus matchers. Use the generic JSON editor only
  for connection types that have no typed editor.
- Show individual connection path fields on the canvas when specific connection-owned kwargs such
  as symbols, timeframe, feed, interval, page token, or provider cursor should be edited as
  companion cards next to downstream widgets.
- For time-range-aware paths, choose whether the query uses the workspace date range or custom fixed dates. Paths that are not time-range-aware do not show date runtime controls and do not send `timeRange`.
- For time-range-aware paths that use the workspace date range, optionally enable incremental refresh. Choose the time field used for tail requests and retention pruning, then choose the merge-key column combination used to dedupe and replace retained rows.
- Use the Test query action to run the draft request and inspect the returned frame before binding downstream widgets.
- Variable-backed settings are resolved before the Test query request is built, so the preview
  payload should show the concrete upstream value rather than the raw `$(widget).source` expression.
- Query-model defaults are fallback values only. Saved or reference-resolved query fields win over
  defaults, so applying a default interval or path kind must not erase a resolved query field.
- If a reference-backed query field is not available yet, the Test query action and runtime
  execution wait for that referenced value instead of sending a literal or empty placeholder to the
  backend.
- If this source is hidden behind a table, graph, statistic, or other managed connection consumer,
  variable-backed owner settings refresh this source through an execution-only prop overlay. The
  new runtime frame is published downstream without saving the resolved variable value into the
  hidden source props.
- Optionally configure variables only when the selected connection path advertises variable support.
- Configure the row limit when needed.
- Bind downstream widgets to the `dataset` output. The output label includes the selected path label, such as `Rows between dates dataset`.
- Keep the query widget in the sidebar rail; downstream table, graph, statistic, or transform widgets own canvas presentation.

## blockingRequirements

- A valid connection instance is required.
- A connection path/query model id is required.
- The connection query response must return at least one publishable frame or payload that can be normalized into the canonical tabular dataset.

## commonPitfalls

- The connection instance owns credentials and backend access. Do not copy connection secrets into widget props.
- Path/query model ids are part of the connection type contract. If the backend connection registry changes, review saved query widgets.
- Workspace or custom dates are sent through the request `timeRange` as ISO strings; the generic widget must not inject Data Node-specific `start_date` or `end_date` fields into query JSON.
- Connection instance public config is read by connection-specific query editors to show defaults
  and configured source context; it should not be duplicated as static widget fields.
- Poppable connection path cards edit the same stored query payload as the sidebar settings. They
  do not create a second connection query or duplicate credentials.
- Variables are hidden and omitted from requests for query paths that do not advertise
  `supportsVariables: true`.
- `timeRange` is always sent for query models that advertise `timeRangeAware: true`.
- Incremental refresh is frontend-only and uses the same backend request shape. Follow-up refreshes narrow `timeRange.from`, merge rows into an in-memory retained frame, and publish the retained `core.tabular_frame@v1` dataset through a shared `widget-runtime-update@v1` envelope plus runtime data refs. Source runtime state also keeps inline rows so cold-loaded workspaces are not forced to wait for a fresh test run before downstream consumers can render.
- Initial workspace execution, manual submit, and manual upstream recalculation rebuild the retained snapshot from the full workspace range. Later dashboard refreshes use the last successful request end plus overlap as the delta cursor.
- A configured connection source is not considered ready until it has published runtime data. If it has not run yet, workspace status surfaces should show waiting; if the backend request fails, the widget publishes an error frame.
- The dedupe key is not inferred from time-series semantics. It is the saved `incrementalMergeKeyFields` column combination selected by the user.
- Overlapping refreshes for the same widget/query/request identity are deduped while the request is in flight.
- If downstream widgets do not understand delta metadata, they still consume the retained full dataset as a normal snapshot. They must not cause this source widget to issue a second full backend query.
- The widget always publishes one canonical tabular dataset.
- Consumers should bind to this widget's `dataset` output rather than repeating the same connection query.
- This widget is a sidebar-only source. Do not use it as the visible table or chart; bind a presentation widget downstream.
