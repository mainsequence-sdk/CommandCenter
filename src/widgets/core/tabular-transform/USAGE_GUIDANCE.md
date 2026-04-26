## buildPurpose

Transforms one bound `core.tabular_frame@v1` dataset and republishes the result as a new canonical tabular dataset.

## whenToUse

- Use between a source widget and downstream render widgets when rows need reshaping.
- Use to aggregate rows by key fields.
- Use to pivot a categorical field into columns.
- Use to unpivot wide columns into long-form series/value rows.
- Use to project a smaller set of columns for downstream widgets.

## whenNotToUse

- Do not use to query a backend connection; put a Connection Query widget upstream.
- Do not use for presentation-only formatting such as table colors or chart style.
- Do not hide analytical transforms inside binding-level output transforms.

## authoringSteps

- Bind `sourceData` to a widget that publishes `core.tabular_frame@v1`.
- Select a transform mode.
- Configure key fields, pivot fields, unpivot value fields, or projection fields as needed.
- Bind downstream widgets to this widget's `dataset` output.

## blockingRequirements

- A compatible upstream tabular frame is required.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. Pass-through/projection transforms can publish transformed deltas; aggregate,
  pivot, and unpivot modes recompute from the retained frame and publish a snapshot result.
- Aggregate mode requires one or more key fields to reduce rows.
- Pivot mode requires a pivot field and a value field.
- Unpivot mode requires at least one value column.

## commonPitfalls

- Projection runs after the selected transform. Projecting away key, value, or generated fields can make downstream widgets empty.
- Aggregate, pivot, and unpivot preserve source fields only when they survive the transform unchanged; generated fields are marked as derived.
- This widget intentionally owns analytical reshaping as a visible graph node so execution and debugging stay inspectable.
