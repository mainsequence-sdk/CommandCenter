## buildPurpose

Canonical reusable Main Sequence DataNode source for workspace composition. It publishes one shared core.tabular_frame@v1 dataset for downstream tables, charts, statistics, curve plots, and chained Data Node widgets.

## whenToUse

- Use when a workspace needs one shared dataset that drives tables, charts, or statistics.
- Use when the source may come from a direct data node, another bound Data Node, or a manual table.
- Use when Data Node Table, Data Node Graph, Statistic, Curve Plot, or Zero Curve widgets should all consume the same canonical dataset source.
- Use when the workspace needs a reusable `core.tabular_frame@v1` output with rows, columns, optional field metadata, source metadata, status, range, and error information.
- Use when the output shape can be produced with one built-in transform mode plus optional final projection.

## whenNotToUse

- Do not use when the widget only needs to render an existing upstream dataset without owning execution.
- Do not use when the workspace needs to chain aggregate, pivot, and unpivot inside one widget; chain multiple Data Node widgets instead.
- Do not use as a final visualization when a dedicated table, graph, statistic, curve, or zero-curve widget should render the already published dataset.

## authoringSteps

- Select the source mode and source dataset.
- Set date range behavior and any unique identifier filters.
- For direct mode, choose the Main Sequence DataNode to query from the platform.
- For bound Data Node mode, bind `sourceData` to an upstream `core.tabular_frame@v1` source; the upstream source controls the effective data selection and preview rows.
- For manual mode, define the authored table columns and rows that should be published through the same canonical dataset output.
- Configure exactly one transform mode: `none`, `aggregate`, `pivot`, or `unpivot`.
- Configure output projection only after the main transform when downstream widgets need a smaller column set.
- Bind downstream widgets to the `dataset` output so they consume the canonical published payload.

## blockingRequirements

- Direct mode requires a valid data node id.
- Filter widget mode requires a valid bound upstream Data Node.
- Bound source mode requires an upstream output compatible with `core.tabular_frame@v1`.
- Aggregate mode requires selected key fields and an aggregate mode: `first`, `last`, `sum`, `mean`, `min`, or `max`.
- Pivot mode requires row key fields, one categorical pivot field, one value field, and an aggregate mode for duplicate row/pivot combinations.
- Unpivot mode requires selected value columns and the key fields that should be preserved on every long-form row.

## commonPitfalls

- Pivot and unpivot modes need their key fields configured or the output shape will not match expectations.
- Projection runs after the main transform, so projecting away key, pivot, series, or value fields can make downstream widgets unusable.
- A single Data Node applies one transform mode only. Use a chain such as `Data Node A -> Data Node B -> Data Node C` when multiple reshapes are required.
- Bound Data Node mode republishes the immediate upstream dataset after applying this widget's transform; downstream consumers should use this widget's `dataset` output, not reconstruct earlier nodes in the chain.
- Manual mode stores rows in widget props and publishes them through the same `dataset` output, but it does not query the Main Sequence backend at runtime.
