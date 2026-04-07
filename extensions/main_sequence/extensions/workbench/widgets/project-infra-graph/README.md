# Main Sequence Project Infra Graph

This widget module owns the project-scoped infrastructure graph used by the Main Sequence project detail experience.

## Files

- `MainSequenceProjectInfraGraph.tsx`: stateful feature widget shell that loads the graph, manages drill-down history, and coordinates the selected-node inspector.
- `ProjectInfraGraphCanvas.tsx`: read-only React Flow scene for grouped infra nodes and edges.
- `ProjectInfraGraphInspector.tsx`: right-side inspection panel that lazily fetches `summary_url` and falls back to node properties when no summary exists.
- `projectInfraGraphLayout.ts`: thin layout builder that maps backend `nodes`, `edges`, and `groups` into React Flow nodes/edges without inventing extra relationships.
- `projectInfraGraphTypes.ts`: local graph scope and flow-node types.

## Notes

- This module is intentionally scoped to Main Sequence project infrastructure. It is not a generic graph framework and does not reuse the workspace graph runtime providers.
- The backend contract is link-driven: `summary_url` is for inspection and `graph_url` is for exploration. The widget follows that rule directly.
- Initial load fetches `/projects/{id}/infra-graph/`; drill-down follows backend-provided `graph_url` values exactly.
- The inspector never prefetches all summaries. It only fetches the selected node's `summary_url`.
- Nodes without `summary_url` no longer render the raw backend `properties` fallback. The inspector shows only the selected-node header plus the explicit `No summary available` state.
- The graph now uses a centered radial layout with a lightweight local force/repulsion pass. The root project node stays in the middle, related nodes orbit around it by backend group and depth, and group coloring comes from a frontend theme palette instead of backend-provided node colors.
