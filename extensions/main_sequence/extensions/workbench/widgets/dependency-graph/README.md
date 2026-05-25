# Main Sequence Dependency Graph Widget

This widget folder owns the reusable update dependency graph renderer used by dashboard widgets and Foundry detail tabs.

## Files

- `definition.ts`: widget metadata and registration payload.
- `dependencyGraphRuntime.ts`: shared widget prop normalization and runtime-state contract for the dependency graph widget.
- `dependencyGraphExecution.ts`: shared execution-owner adapter that resolves the latest linked LocalTimeSerie update for a Data Node and fetches the canonical graph payload.
- `MainSequenceDependencyGraphWidget.tsx`: mounted runtime widget that renders shared runtime state instead of fetching the graph directly.
- `MainSequenceDependencyGraphWidgetSettings.tsx`: typed widget settings form used by the shared dashboard widget settings screen.
- `MainSequenceUpdateDependencyGraph.tsx`: reusable graph frame shared by widget surfaces and feature detail tabs. Feature detail tabs may still use its built-in query mode, while the workspace widget now passes preloaded runtime payloads from shared execution.
- `MainSequenceDependencyGraphExplorer.tsx`: interactive graph scene with pan, zoom, minimap, hover, and node detail behavior.
- `graphLayout.ts`: layout and graph-path utilities shared by the explorer.

## Props

- `dataNodeUid`: Dynamic Table identifier. The widget resolves the latest linked
  `LocalTimeSerie` update before fetching the dependency graph.
- `direction`: graph direction, either `downstream` or `upstream`.

## Notes

- The workspace widget is now an `execution-owner`. Shared execution resolves the latest linked `LocalTimeSerie` update for a selected Data Node, then fetches the dependency graph payload once per refresh cycle. The mounted widget renders that shared runtime payload and preserves only explorer UI state such as zoom, pan, and selected node.
- The shared renderer supports update-node graphs returned by the LocalTimeSerie dependency endpoint.
- Graph fetch helpers validate the payload shape before rendering, so HTML redirects or other non-graph 200 responses surface as errors instead of a false empty-state.
- The widget follows the shared widget contract with `requiredPermissions`, `exampleProps`, and a typed `settingsComponent`.
- In the workspace component browser this widget belongs under the `Main Sequence Infrastructure`
  category.
- The Data Node settings path now reuses the same Dynamic Table quick-search component as the main
  `Data Node` widget instead of searching `local_time_serie` rows directly.
- The reusable widget definition is shared everywhere, but the selected Data Node UID,
  `direction`, and the optional instance title belong to each widget instance.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real execution-owner behavior here: Data Node source
  support, direction modes, linked-update resolution, and runtime payload ownership.
- Bump `widgetVersion` when source selection, execution behavior, or agent-facing authoring
  guidance changes materially.
