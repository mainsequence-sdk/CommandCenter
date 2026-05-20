## buildPurpose

Transforms one bound `core.tabular_frame@v1` dataset and republishes the result as a new canonical tabular dataset.

## whenToUse

- Use between a source widget and downstream render widgets when rows need reshaping.
- Use to aggregate rows by key fields.
- Use to filter rows by lightweight field predicates before downstream rendering.
- Use to pivot a categorical field into columns.
- Use to unpivot wide columns into long-form series/value rows.
- Use to publish reusable computed columns that downstream widgets should consume as part of the
  transformed dataset.
- Use to project a smaller set of columns for downstream widgets.

## whenNotToUse

- Do not use to query a backend connection; put a Connection Query widget upstream.
- Do not use for presentation-only formatting such as table colors or chart style.
- Do not hide analytical transforms inside binding-level output transforms.

## authoringSteps

- Bind `sourceData` to a widget that publishes `core.tabular_frame@v1`.
- Select a transform mode.
- Configure filter rules, key fields, pivot fields, unpivot value fields, computed columns, or
  projection fields as needed.
- Bind downstream widgets to this widget's `dataset` output.

## blockingRequirements

- A compatible upstream tabular frame is required.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. Pass-through/projection transforms can publish transformed deltas; aggregate,
  pivot, and unpivot modes recompute from the retained frame and publish a snapshot result.
- Aggregate mode requires one or more key fields to reduce rows.
- Filter mode requires at least one valid rule.
- Pivot mode requires a pivot field and a value field.
- Unpivot mode requires at least one value column.
- Computed columns require a unique output key and a valid bracketed formula such as
  `[last_price] - [previous_close]` or `PERCENT_CHANGE([last_price], [previous_close])`.

## commonPitfalls

- Projection runs after the selected transform. Projecting away key, value, or generated fields can make downstream widgets empty.
- Filter mode is intentionally limited to lightweight field comparisons. Regex, substring search, and computed expressions do not belong here.
- Computed columns run after the selected transform and before projection. This is the right place
  to turn raw builder fields into reusable derived dataset columns.
- Aggregate, pivot, and unpivot preserve source fields only when they survive the transform unchanged; generated fields are marked as derived.
- This widget intentionally owns analytical reshaping as a visible graph node so execution and debugging stay inspectable.
