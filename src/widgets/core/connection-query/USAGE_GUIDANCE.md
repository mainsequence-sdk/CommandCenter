## buildPurpose

Runs one explicit connection path and publishes the selected result frame as one canonical `core.tabular_frame@v1` dataset for downstream workspace widgets.

## whenToUse

- Use when a workspace needs a reusable dataset from a backend-owned connection instance.
- Use when a connection type exposes a path/query model that returns rows, metrics, SQL results, time-series points, or another normalized frame.
- Use when table, chart, statistic, curve, transform, or agent-facing widgets should consume the same query result.
- Use when the query should follow the workspace time range or a saved fixed range.

## whenNotToUse

- Do not use for presentation-only table, chart, or statistic rendering; bind those widgets to this widget's dataset output.
- Do not use to store backend endpoints, tokens, or route fragments in workspace props.
- Do not use for analytical reshaping after the query returns; bind a Tabular Transform widget downstream.

## authoringSteps

- Select a configured connection instance.
- Select one of the connection type's paths/query models. The selected path is saved and sent as `query.kind`; it is not inferred from the connection.
- Configure the query using the connection-specific editor when available. These editors render
  connection-owned kwargs such as Data Node columns and identifier filters, SQL parameters,
  PostgreSQL time-series field mapping, or Prometheus matchers. Use the generic JSON editor only
  for connection types that have no typed editor.
- For time-range-aware paths, choose whether the query uses the workspace date range or custom fixed dates. Paths that are not time-range-aware do not show date runtime controls and do not send `timeRange`.
- Use the Test query action to run the draft request and inspect the returned frame before binding downstream widgets.
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
- Variables are hidden and omitted from requests for query paths that do not advertise
  `supportsVariables: true`.
- `timeRange` is always sent for query models that advertise `timeRangeAware: true`.
- The widget always publishes one canonical tabular dataset. When the backend knows chart semantics, they are carried in `meta.timeSeries`.
- Consumers should bind to this widget's `dataset` output rather than repeating the same connection query.
- This widget is a sidebar-only source. Do not use it as the visible table or chart; bind a presentation widget downstream.
