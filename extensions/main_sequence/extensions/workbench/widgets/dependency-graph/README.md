# Main Sequence Dependency Graph Widget

This widget folder owns the reusable update dependency graph renderer used by dashboard widgets and Workbench detail tabs.

## Files

- `definition.ts`: widget metadata and registration payload.
- `MainSequenceDependencyGraphWidget.tsx`: widget entry component that maps widget props into the shared graph renderer.
- `MainSequenceDependencyGraphWidgetSettings.tsx`: typed widget settings form used by the shared dashboard widget modal.
- `MainSequenceUpdateDependencyGraph.tsx`: reusable query/frame wrapper shared by widget surfaces and feature detail tabs.
- `MainSequenceDependencyGraphExplorer.tsx`: interactive graph scene with pan, zoom, minimap, hover, and node detail behavior.
- `graphLayout.ts`: layout and graph-path utilities shared by the explorer.

## Props

- `localTimeSerieId`: LocalTimeSerie identifier used by the widget entrypoint to fetch the dependency graph.
- `direction`: graph direction, either `downstream` or `upstream`.

## Notes

- The shared renderer supports mixed update-node graphs where `data_node_update` and `simple_table_update` nodes can appear in the same payload.
- Graph fetch helpers validate the payload shape before rendering, so HTML redirects or other non-graph 200 responses surface as errors instead of a false empty-state.
- The widget follows the shared widget contract with `requiredPermissions`, `exampleProps`, and a typed `settingsComponent`.
- The reusable widget definition is shared everywhere, but `localTimeSerieId`, `direction`, and the optional instance title belong to each widget instance.
- That means an app can ship a preconfigured dependency-graph instance, while a customizable dashboard can expose the same widget through the shared widget settings modal.
