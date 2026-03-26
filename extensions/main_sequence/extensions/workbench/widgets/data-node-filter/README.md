# Main Sequence Data Node Widget

This widget owns the reusable Main Sequence `main-sequence-data-node` widget id. It acts as a
dataset node in the workbench pipeline: it can fetch a direct data node, consume another `Data Node`
widget as input, apply explicit dataset transforms, and publish the transformed row set to downstream
charts and tables.

## Files

- `definition.ts`: widget metadata and registration payload.
- `schema.tsx`: shared data-node source/date-range schema assembled from the workbench shared
  widget-source contract.
- `controller.ts`: shared controller wiring for data-node metadata, picker state, and normalized
  widget props.
- `dataNodeFilterModel.ts`: dataset-node config, runtime-state normalization, and transform helpers
  for aggregate, pivot, and projection pipeline steps.
- `MainSequenceDataNodeFilterWidget.tsx`: icon-only mounted runtime surface with hover details for
  the saved source/range/transform and the published dataset.
- `MainSequenceDataNodeFilterWidgetSettings.tsx`: settings-only table preview for the selected data
  node or upstream Data Node input, including transformed output preview.

## Behavior

- The widget shares the same data-source and date-range settings pattern as the data-node graph
  widget, but it can now either fetch directly from a Main Sequence data node or consume another
  `Data Node` widget as its input.
- Other widgets reference this widget as their data source instead of owning duplicate
  data-node/date-range selection flow.
- If the selected data node exposes `unique_identifier` as the second index, the widget can also
  save an identifier selection list.
- The settings surface is organized around one `Advanced transform` section with three explicit
  modes: `None`, `Aggregate`, and `Pivot`.
- `Aggregate` uses key fields plus an aggregate mode (`first`, `last`, `sum`, `mean`, `min`, or
  `max`) to publish one output row per key combination.
- `Pivot` uses key fields as row dimensions, expands one categorical field into columns, and fills
  those columns from the selected value field using the active aggregate mode.
- `Project columns` is a final optional output-shaping step that keeps only the selected published
  columns.
- The current transform order is: input dataset -> transform mode (`none`, `aggregate`, or
  `pivot`) -> projection -> published dataset.
- The mounted widget is intentionally minimal: it renders as a small source icon and exposes its
  dataset summary on hover, so it can act as a composable configuration block without consuming
  dashboard space.
- New instances default to hidden header + minimal chrome, so the Data Node behaves like a compact
  source token rather than a full content card. In workspace edit mode, controls surface as floating
  actions in the same style as the row widget.
- In fixed-date mode, missing start/end values are prefilled from the data node's latest available
  time index, keeping the current dashboard span when possible.
- For direct sources, the preview fetches the selected data node through
  `dynamic_table/{id}/get_data_between_dates_from_remote/`.
- For upstream sources, the preview reads the upstream Data Node runtime dataset and shows the
  transformed output locally.
