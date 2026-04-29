## buildPurpose

KPI-style statistic cards for a bound `core.tabular_frame@v1` dataset or a widget-owned hidden connection source.

## whenToUse

- Use when a tabular dataset should be reduced into compact KPI cards instead of rendered as a full table or chart.
- Use when a workspace needs `last`, `first`, `max`, `min`, `sum`, `mean`, or `count` over a published table-shaped dataset.
- Use when one KPI should be shown for the full dataset, or one KPI card should be rendered per value of a selected group field.
- Use when the statistic value needs presentation formatting such as decimals, prefix, suffix, source label display, color rules, per-card sparklines, or an explicit multi-card column layout.
- Use when single-stat and grouped multi-stat views should keep the same large centered card presentation.
- Use when a one-row grouped statistic should stretch its cards to fill the available widget height instead of leaving empty panel space.
- Use the managed connection flow when this statistic should own its own hidden
  `connection-query` or `connection-stream-query` source instead of sharing a visible upstream
  source widget.

## whenNotToUse

- Do not use when the user needs the full table or a chart instead of reduced KPIs.
- Do not use as the source of reusable dataset transformations; reshape the dataset with Tabular Transform first.
- Do not use for multi-dimensional pivot tables or grouped analytical tables. This widget supports one optional group field and renders cards, not a matrix.

## authoringSteps

- Bind `seedData` to a retained `dataset` output or an incremental `updates` seed publication.
- Bind `liveUpdates` to explicit `updates` outputs when this statistic should keep applying incremental publications.
- Or open `Bindings`, click `Add connection`, and configure the dedicated `Connection` tab for a hidden managed source. Managed HTTP sources bind `dataset` to `seedData`; managed WS sources bind `updates` to `liveUpdates`.
- Inspect the resolved source schema before choosing fields.
- Choose the statistic mode and value field.
- Optionally choose one group field and one order field.
- Configure presentation with decimals, value display label, prefix, suffix, source label display, color rules, and the desired multi-card column count.

## blockingRequirements

- A compatible upstream tabular binding is required.
- Managed connection mode requires a valid backend-owned connection instance selected in the hidden
  managed source widget. Managed WebSocket streaming also requires a streamable connection path.
- When the upstream source publishes incremental metadata, the statistic consumes the retained
  full `upstreamBase` frame and recomputes the cards as a snapshot.
- Field pickers are populated from the bound dataset's `columns`, `fields`, and representative rows.
- `max`, `min`, `sum`, and `mean` require a numeric value field. `count` can count rows without a value field.

## commonPitfalls

- Choosing a non-numeric value field makes `max`, `min`, `sum`, and `mean` produce no usable statistic.
- Managed connection mode still depends on the hidden query or stream source widget publishing one
  canonical tabular frame. Fix source runtime failures in the `Connection` tab before debugging
  statistic field choices or reduction rules.
- `first` and `last` use the selected order field only when one is configured. Without an order field, they follow the upstream row order.
- Grouping is intentionally limited to one field. If the workspace needs multiple group dimensions or pivoted totals, reshape the dataset with Tabular Transform first.
- Multi-card sparklines only render when the selected value field resolves to at least two numeric observations per card.
- Range rules apply to the resolved statistic value, not every row in the dataset.
