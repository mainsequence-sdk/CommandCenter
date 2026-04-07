# Main Sequence Project Infra Graph

This widget module owns the project-scoped infrastructure graph used by the Main Sequence project detail experience and the reusable workspace widget definition.

## Files

- `MainSequenceProjectInfraGraph.tsx`: stateful feature widget shell that loads the graph, manages drill-down history, and coordinates the selected-node inspector.
- `MainSequenceProjectInfraGraphWidget.tsx`: workspace widget wrapper that validates widget props and mounts the shared infra graph in compact mode.
- `MainSequenceProjectInfraGraphWidgetSettings.tsx`: structured workspace settings that select a project through backend quick search.
- `ProjectQuickSearchPicker.tsx`: autocomplete picker for `/projects/quick-search/`, used by the workspace widget settings.
- `ProjectInfraGraphCanvas.tsx`: read-only React Flow scene for grouped infra nodes and edges.
- `ProjectInfraGraphInspector.tsx`: right-side inspection panel that lazily fetches `summary_url` and falls back to node properties when no summary exists.
- `definition.ts`: workspace catalog registration for the reusable `Project Infrastructure Graph` widget under `Main Sequence Infrastructure`.
- `projectInfraGraphLayout.ts`: thin layout builder that maps backend `nodes`, `edges`, and `groups` into React Flow nodes/edges without inventing extra relationships.
- `projectInfraGraphRuntime.ts`: local widget-props type and normalization helpers shared by settings and canvas wrappers.
- `projectInfraGraphTypes.ts`: local graph scope and flow-node types.

## Notes

- This module is intentionally scoped to Main Sequence project infrastructure. It is not a generic graph framework and does not reuse the workspace graph runtime providers.
- The same graph shell now supports both the project detail page and the reusable workspace widget. The workspace widget uses the compact layout variant so it can fit inside dashboard cards without forcing the full page-height inspector treatment.
- The workspace widget no longer asks the user to type a raw project id. Its settings use the backend `projects/quick-search/` endpoint and store the selected project id from that result set.
- The widget props still allow `commitSha`, but that field is intentionally hidden from the structured settings UI for now.
- The backend contract is link-driven: `summary_url` is for inspection and `graph_url` is for exploration. The widget follows that rule directly.
- Initial load fetches `/projects/{id}/infra-graph/`; drill-down follows backend-provided `graph_url` values exactly.
- The inspector never prefetches all summaries. It only fetches the selected node's `summary_url`.
- Nodes without `summary_url` no longer render the raw backend `properties` fallback. The inspector shows only the selected-node header plus the explicit `No summary available` state.
- The graph now uses a centered radial layout with a lightweight local force/repulsion pass. The root project node stays in the middle, related nodes orbit around it by backend group and depth, and group coloring comes from a frontend theme palette instead of backend-provided node colors.
- In the workspace component browser this widget should appear under the `Main Sequence Infrastructure` category, not `Main Sequence Workbench`.
