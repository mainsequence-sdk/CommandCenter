# Main Sequence Dependency Graph Widget

This widget exposes the LocalTimeSerie dependency graph as a reusable dashboard widget.

## Files

- `definition.ts`: widget metadata and registration payload.
- `MainSequenceDependencyGraphWidget.tsx`: widget entry component that maps widget props into the shared graph renderer.
- `MainSequenceDependencyGraphWidgetSettings.tsx`: typed widget settings form used by the shared dashboard widget modal.
- `MainSequenceDependencyGraphExplorer.tsx`: interactive graph scene with pan, zoom, minimap, hover, and node detail behavior.
- `graphLayout.ts`: layout and graph-path utilities shared by the explorer.

## Props

- `localTimeSerieId`: LocalTimeSerie identifier used to fetch the dependency graph.
- `direction`: graph direction, either `downstream` or `upstream`.

## Notes

- The widget reuses the graph renderer from the data-nodes feature so the page and dashboard views stay aligned.
- The widget follows the shared widget contract with `requiredPermissions`, `exampleProps`, and a typed `settingsComponent`.
- The reusable widget definition is shared everywhere, but `localTimeSerieId`, `direction`, and the optional instance title belong to each widget instance.
- That means an app can ship a preconfigured dependency-graph instance, while a customizable dashboard can expose the same widget through the shared widget settings modal.
