# Main Sequence Data Node Widget

This widget owns the reusable Main Sequence `main-sequence-data-node` widget id. It acts as a
dataset node in the workbench pipeline: it can fetch a direct data node, consume another `Data Node`
widget as input, apply explicit dataset transforms, and publish the transformed row set to downstream
charts and tables.

## Files

- `definition.ts`: widget metadata and registration payload.
- `dataNodeFilterExecution.ts`: headless executable-widget contract for direct Data Node fetches
  and bound-source transform publication. This is the runtime path that keeps `Data Node`
  publishing in settings/graph flows without requiring the visual widget component to mount.
- `schema.tsx`: shared data-node source/date-range schema assembled from the workbench shared
  widget-source contract.
- `controller.ts`: shared controller wiring for data-node metadata, picker state, and normalized
  widget props.
- `dataNodeFilterModel.ts`: dataset-node config, runtime-state normalization, and transform helpers
  for aggregate, pivot, unpivot, and projection pipeline steps.
- `MainSequenceDataNodeFilterWidget.tsx`: icon-only mounted runtime surface with hover details for
  the saved source/range/transform and the published dataset. On workspace runtime surfaces this
  component is now a pure consumer of shared runtime state; it no longer owns the canonical
  backend fetch path.
- `MainSequenceDataNodeFilterWidgetSettings.tsx`: settings-only table preview for the selected data
  node or upstream Data Node input, including transformed output preview and a modal-driven
  inspector for the final published field schema.
- `ManualDataNodeEditor.tsx`: modal spreadsheet-style editor for the `Manual table` source mode,
  including editable grid cells plus CSV/TSV import.

## Behavior

- The widget shares the same data-source and date-range settings pattern as the data-node graph
  widget, but it can now either fetch directly from a Main Sequence data node or consume another
  `Data Node` widget as its input.
- The same widget also supports a `Manual table` source mode. In that mode, authored columns/rows
  are stored in shared widget props, published through the same execution/runtime contract, and
  consumed downstream exactly like a fetched Data Node dataset.
- Manual-table authoring now happens in a dedicated modal editor so the settings sidebar stays
  compact. The editor supports direct grid editing plus CSV/tab-separated paste import that replaces
  the current manual table.
- The modal editor is transactional: `Apply` commits the edited table into the current workspace
  draft, while `Cancel` or closing the dialog discards the in-modal edits.
- Manual tables do not hit the backend at runtime. The shared execution layer materializes the
  authored rows into the canonical published dataset locally.
- Other widgets reference this widget as their data source instead of owning duplicate
  data-node/date-range selection flow.
- If the selected data node exposes `unique_identifier` as the second index, the widget can also
  save an identifier selection list.
- The settings surface is organized around one `Advanced transform` section with four explicit
  modes: `None`, `Aggregate`, `Pivot`, and `Unpivot`.
- `Aggregate` uses key fields plus an aggregate mode (`first`, `last`, `sum`, `mean`, `min`, or
  `max`) to publish one output row per key combination.
- `Pivot` uses key fields as row dimensions, expands one categorical field into columns, and fills
  those columns from the selected value field using the active aggregate mode.
- `Unpivot` does the inverse reshape for wide datasets: it keeps selected key fields on every row,
  melts selected value columns into long-form rows, and emits the source column name/value into
  configurable output fields (defaulting to `series` and `value`).
- The `Unpivot` settings include a `Select all value columns` shortcut so wide tables can be melted
  without clicking every candidate field one by one.
- `Project columns` is a final optional output-shaping step that keeps only the selected published
  columns.
- The current transform order is: input dataset -> transform mode (`none`, `aggregate`, `pivot`,
  or `unpivot`) -> projection -> published dataset.
- In pivot mode, the runtime preserves generated pivot columns even if a stale projection would
  otherwise collapse the output down to row-key fields only.
- The widget does not support chained transform modes inside one instance. If a pipeline needs
  multiple reshapes, chain multiple `Data Node` instances so each node publishes one canonical
  dataset to the next hop.
- The mounted widget is intentionally minimal: it renders as a small source icon and exposes its
  dataset summary on hover, so it can act as a composable configuration block without consuming
  dashboard space.
- The same Data Node hover summary can also render from the workspace widget rail. That keeps the
  rail status/hover information aligned with the mounted Data Node token instead of duplicating a
  separate summary format.
- A `Data Node` can now live as a sidebar-only widget while still exposing selected schema
  companions on the canvas. Those canvas cards remain projections of the same Data Node instance;
  they do not create a second data owner or a duplicate fetch path.
- `Data Node` now sets sidebar placement through the shared widget `defaultPresentation` contract,
  so it defaults into the workspace rail without requiring a widget-specific host rule.
- New instances default to hidden header + minimal chrome, so the Data Node behaves like a compact
  source token rather than a full content card. In workspace edit mode, controls surface as floating
  actions in the same style as the row widget.
- In fixed-date mode, missing start/end values are prefilled from the data node's latest available
  time index, keeping the current dashboard span when possible.
- For direct-query sources, the settings preview also shows the backend `dynamic_table/{id}/`
  `identifier` when the detail payload includes it.
- For direct sources, the preview fetches the selected data node through
  `dynamic_table/{id}/get_data_between_dates_from_remote/`.
- For upstream sources, the preview reads the upstream Data Node runtime dataset and shows the
  transformed output locally.
- For manual sources, the preview reads the authored rows locally and shows the transformed output
  without requiring a date range or backend fetch.
- The settings page also exposes the final published field schema in a modal inspector so the user
  can see which fields are backend-declared, manual, inferred, or derived after the current
  transform chain is applied.
- Chaining is intentionally one rule repeated at every hop: a Data Node reads the immediate upstream
  Data Node's published `DataNodePublishedDataset`, applies its own transform, and republishes a new
  dataset. That means `Node A -> Node B -> Node C -> Table/Graph/Statistic` uses the same contract
  as `Node A -> Table/Graph/Statistic`.
- Consumers should never try to reconstruct earlier nodes in the chain. They should only consume the
  final published dataset from the selected upstream Data Node.
- The published `Dataset` output is now derived headlessly from the current bound source input plus
  the Data Node's saved transform settings, and direct-query mode is now materialized through the
  widget's execution contract instead of mounted component side effects. Bound chains such as
  `AppComponent -> Data Node -> Graph/Table/Statistic` no longer need to wait for the mounted
  Data Node component to republish before downstream widgets or settings flows can resolve the
  transformed dataset.
- The workspace/runtime component no longer re-fetches `dynamic_table/{id}/` or
  `dynamic_table/{id}/get_data_between_dates_from_remote/`. The shared execution layer is the
  canonical runtime owner for those requests, and the mounted token reads the resulting
  `runtimeState` only.
- That headless published dataset now preserves `rangeStartMs` / `rangeEndMs` as well, so
  downstream widgets and settings previews can show the actual upstream Data Node range instead of
  falling back to the dashboard range when the source is another `Data Node`.
- For raw direct-query datasets, the published schema now preserves backend field metadata instead
  of immediately collapsing everything to row-only inference. When transforms create or reshape
  fields, the published schema marks those fields as `derived` and carries the lineage forward to
  downstream consumers.

## Registry Contract

- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep the registry contract aligned with the real authoring surface here: source modes, transform
  modes, execution-owner behavior, published dataset contract, and manual-table workflow.
- Bump `widgetVersion` when this widget's configuration model, published output contract, runtime
  execution behavior, or agent-facing authoring steps change materially.
