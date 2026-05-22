## buildPurpose

Transforms one bound `core.tabular_frame@v1` seed or live-update input and republishes the result on the matching downstream channel.
It is a sidebar-only source/transform node, so it participates in bindings and graph execution
without occupying a workspace canvas card.

## whenToUse

- Use between a source widget and downstream render widgets when rows need reshaping.
- Use to aggregate rows by key fields.
- Use to filter rows by lightweight field predicates before downstream rendering.
- Use to pivot a categorical field into columns.
- Use to unpivot wide columns into long-form series/value rows.
- Use to publish reusable computed columns that downstream widgets should consume as part of the
  transformed dataset.
- Use to project a smaller set of columns for downstream widgets.
- Use to collapse a noisy live stream into one latest row per configured identity, such as the
  latest `last` value per `symbol`.
- Use between a WebSocket source and a live consumer when live rows need filtering, computed
  columns, projection, or deduplication before they reach the consumer.

## whenNotToUse

- Do not use to query a backend connection; put a Connection Query widget upstream.
- Do not use for presentation-only formatting such as table colors or chart style.
- Do not hide analytical transforms inside binding-level output transforms.

## authoringSteps

- Bind `seedData` to an upstream `dataset` output for retained/base rows.
- Bind `liveUpdates` to an upstream `updates` output for incremental stream rows.
- Bind exactly one of those inputs. Tabular Transform is not a seed/live joiner; Table, Graph,
  Statistic, and Asset Screener own dual-role consumer behavior.
- When `seedData` is bound, bind downstream seed inputs to this widget's `dataset` output.
- When `liveUpdates` is bound, bind downstream live-update inputs to this widget's `updates` output.
- Select a transform mode.
- Configure only the mode-specific fields that appear: filter rules for filtering, key fields for
  aggregate/pivot/unpivot, pivot fields for pivoting, unpivot value fields for unpivoting, computed
  columns, or projection fields.
- Configure Row merge when the output should be a stable latest-row table. Set Merge mode to
  `Latest row per key`, then add mappings that identify one row. For one latest price per market,
  map retained field `symbol` to incoming field `symbol`. For compound identity, add each required
  mapping, such as `symbol -> symbol` and `exchange -> exchange`. If the incoming feed uses
  different names, map the retained field to the incoming field, for example `symbol -> ticker`.
- Leave Row merge in passthrough mode when the transform should not add row-merge semantics. This
  keeps the transformed output aligned with whatever the upstream source currently publishes.
- Use the panel preview to inspect the transformed columns and sample rows before connecting
  downstream widgets.
- The widget stays mounted in the sidebar/widget rail; use settings and graph bindings to inspect
  and connect it.

## blockingRequirements

- Exactly one compatible upstream tabular frame is required through `seedData` or `liveUpdates`.
  Binding both inputs is a configuration error because it would mix finite and stream downstream
  paths inside a transform node.
- Incremental upstream sources expose retained rows through `upstreamBase` and changed rows through
  `upstreamDelta`. The `updates` output republishes the transformed stream publication.
  A live delta publication is enough for the transform to run even when the retained base frame has
  not been published yet.
  If a live-only source briefly has no current publication after the transform already published a
  ready output, the retained transformed output remains valid instead of marking the widget waiting.
  Pass-through/projection transforms can publish transformed deltas; aggregate, pivot, and unpivot
  modes recompute from the retained frame and publish a snapshot result.
- Aggregate mode requires one or more key fields to reduce rows.
- Filter mode requires at least one valid rule.
- Pivot mode requires a pivot field and a value field.
- Unpivot mode requires at least one value column.
- Computed columns require a unique output key and a valid bracketed formula such as
  `[last_price] - [previous_close]` or `PERCENT_CHANGE([last_price], [previous_close])`.
- Latest-row merge requires at least one merge mapping. If projection is enabled, the retained or
  incoming fields used by the mapping must be included in the projected output.

## commonPitfalls

- Projection runs after the selected transform. Projecting away key, value, or generated fields can make downstream widgets empty.
- Filter mode is intentionally limited to lightweight field comparisons. Regex, substring search, and computed expressions do not belong here.
- Computed columns run after the selected transform and before projection. This is the right place
  to turn raw builder fields into reusable derived dataset columns.
- Row merge runs after projection. Passthrough is the neutral mode: the transform does not
  accumulate rows on its own and does not deduplicate rows on its own. If the stream publishes
  `symbol` and `close`, create or project the downstream columns first, for example `symbol` and
  computed `last = [close]`, then use latest-row merge by `symbol` only when downstream consumers
  should see one current row per symbol.
- Row merge is output shaping. Table still has its own live merge safety setting for direct table
  consumption, but transform-level merge is the reusable place to clean a stream before Graph,
  Statistic, Asset Screener, Table, or another transform consumes it.
- The inactive output channel intentionally publishes no frame. A seed-bound transform publishes
  `dataset`, not `updates`; a live-bound transform publishes `updates`, not `dataset`.
- Aggregate, pivot, and unpivot preserve source fields only when they survive the transform unchanged; generated fields are marked as derived.
- This widget intentionally owns analytical reshaping as a visible graph node so execution and debugging stay inspectable.
- This widget is not a canvas presentation widget. Bind its outputs to Table, Pro Table, Graph,
  Statistic, Asset Screener, or another transform for visible rendering.
