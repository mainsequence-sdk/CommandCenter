# Main Sequence Dependency Graph Widget

This widget folder owns the reusable update dependency graph renderer used by dashboard widgets and Forge detail tabs.

## Files

- `definition.ts`: widget metadata and registration payload.
- `MainSequenceDependencyGraphWidget.tsx`: widget entry component that maps widget props into the shared graph renderer.
- `MainSequenceDependencyGraphWidgetSettings.tsx`: typed widget settings form used by the shared dashboard widget settings screen.
- `MainSequenceUpdateDependencyGraph.tsx`: reusable query/frame wrapper shared by widget surfaces and feature detail tabs.
- `MainSequenceDependencyGraphExplorer.tsx`: interactive graph scene with pan, zoom, minimap, hover, and node detail behavior.
- `graphLayout.ts`: layout and graph-path utilities shared by the explorer.

## Props

- `sourceKind`: either `data_node` or `simple_table`.
- `dataNodeId`: Dynamic Table identifier used when `sourceKind === "data_node"`. The widget then
  resolves the latest linked `LocalTimeSerie` update before fetching the dependency graph.
- `simpleTableUpdateId`: Simple Table update identifier used when `sourceKind === "simple_table"`.
- `direction`: graph direction, either `downstream` or `upstream`.

## Notes

- The shared renderer supports mixed update-node graphs where `data_node_update` and `simple_table_update` nodes can appear in the same payload.
- Graph fetch helpers validate the payload shape before rendering, so HTML redirects or other non-graph 200 responses surface as errors instead of a false empty-state.
- The widget follows the shared widget contract with `requiredPermissions`, `exampleProps`, and a typed `settingsComponent`.
- The Data Node settings path now reuses the same Dynamic Table quick-search component as the main
  `Data Node` widget instead of searching `local_time_serie` rows directly.
- The same widget now selects between the LocalTimeSerie dependency endpoint and the SimpleTableUpdate dependency endpoint entirely from widget props, so dashboards do not need separate dependency-graph widget types for Data Nodes vs Simple Tables.
- The reusable widget definition is shared everywhere, but `sourceKind`, the selected update id, `direction`, and the optional instance title belong to each widget instance.
