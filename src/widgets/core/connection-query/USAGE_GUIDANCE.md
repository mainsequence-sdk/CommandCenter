## buildPurpose

Runs one configured connection query and publishes the selected result frame as a canonical `core.tabular_frame@v1` or `core.time_series_frame@v1` dataset for downstream workspace widgets.

## whenToUse

- Use when a workspace needs a reusable dataset from a backend-owned connection instance.
- Use when a connection type exposes a query model that returns rows, metrics, SQL results, time-series points, or another normalized frame.
- Use when table, chart, statistic, curve, transform, or agent-facing widgets should consume the same query result.
- Use when the query should follow the workspace time range or a saved fixed range.

## whenNotToUse

- Do not use for presentation-only table, chart, or statistic rendering; bind those widgets to this widget's dataset output.
- Do not use to store backend endpoints, tokens, or route fragments in workspace props.
- Do not use for analytical reshaping after the query returns; bind a Tabular Transform widget downstream.

## authoringSteps

- Select a configured connection instance.
- Select one of the connection type's query models.
- Configure the query using the connection-specific editor when available, or the generic JSON editor.
- Choose whether the query uses the dashboard time range, a fixed time range, or no time range.
- Optionally configure variables, row limit, and selected response frame.
- Bind downstream widgets to the `dataset` output.
- Keep the query widget in the sidebar rail; downstream table, graph, statistic, or transform widgets own canvas presentation.

## blockingRequirements

- A valid connection instance is required.
- A query model id is required.
- The connection query response must return at least one tabular or time-series frame, or a payload that can be normalized into `core.tabular_frame@v1`.

## commonPitfalls

- The connection instance owns credentials and backend access. Do not copy connection secrets into widget props.
- Query model ids are part of the connection type contract. If the backend connection registry changes, review saved query widgets.
- Consumers should bind to this widget's `dataset` output rather than repeating the same connection query.
- This widget is a sidebar-only source. Do not use it as the visible table or chart; bind a presentation widget downstream.
