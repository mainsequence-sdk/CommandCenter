## buildPurpose

Summarizes a bound Main Sequence Data Node dataset into one or more KPI-style statistic cards.

## whenToUse

- Use when a Data Node dataset should be reduced into compact KPI cards instead of rendered as a full table or chart.
- Use when a workspace needs `last`, `first`, `max`, `min`, `sum`, `mean`, or `count` over a published Data Node dataset.
- Use when one KPI should be shown for the full dataset, or one KPI card should be rendered per value of a selected group field.
- Use when the statistic value needs simple presentation formatting such as decimals, prefix, suffix, source label display, or color rules.

## whenNotToUse

- Do not use when the user needs the full table or a chart instead of reduced KPIs.
- Do not use as the source of reusable dataset transformations; reshape the dataset in a Data Node first, then bind this widget to the final published dataset.
- Do not use for multi-dimensional pivot tables or grouped analytical tables. This widget supports one optional group field and renders cards, not a matrix.

## authoringSteps

- Bind the required `sourceData` input to an upstream Data Node `dataset` output. The widget consumes the Data Node's published table-shaped dataset and does not fetch data on its own.
- Inspect the resolved source schema before choosing fields. The settings expose field provenance, inferred type, warnings, and sample values from the bound Data Node output.
- Choose the statistic mode: `last`, `first`, `max`, `min`, `sum`, `mean`, or `count`.
- Choose the value field for every statistic except row `count`. Numeric modes require values that can be parsed as numbers.
- Optionally choose one `Group by` field. Without grouping, the widget renders one KPI card for the full dataset; with grouping, it renders one card per group value.
- Optionally choose an `Order field`. `first`, `last`, the single-card sparkline, and change-from-last coloring use this field when present; otherwise they use the published row order from the Data Node.
- Configure presentation with `Decimals` from 0 to 6, `Value display label`, `Prefix`, `Suffix`, and the source label toggle. The value display label overrides the full metric label shown above the value, so the statistic mode prefix is hidden when the override is set. Prefix and suffix are rendered with the statistic value, while the source label displays the bound Data Node title on each card.
- Configure color formatting if needed. `Range rules` color a card when the resolved statistic matches an operator and threshold, such as `> 0` or `< -5`. `Change from last observation` colors by the movement between the latest two numeric observations using the selected order field when present.
- Use the live preview to confirm the binding, field choices, reduction result, grouping, formatting, and card coloring against the current Data Node rows.

## blockingRequirements

- A compatible upstream Data Node binding is required.
- The required input is `sourceData`, which must receive the Main Sequence dataset bundle published by a Data Node.
- Field pickers are populated from the bound dataset's `columns`, `fields`, and representative rows. Bind a Data Node before configuring value, group, or order fields.
- `max`, `min`, `sum`, and `mean` require a numeric value field. `count` can count rows without a value field.

## commonPitfalls

- Choosing a non-numeric value field makes `max`, `min`, `sum`, and `mean` produce no usable statistic.
- `first` and `last` use the selected order field only when one is configured. Without an order field, they follow the upstream Data Node's published row order.
- Grouping is intentionally limited to one field. If the workspace needs multiple group dimensions or pivoted totals, reshape the dataset with Data Node transforms first.
- Sparkline rendering is reserved for the single-card numeric case. Grouped cards stay stat-only so the widget remains readable.
- Range rules apply to the resolved statistic value, not every row in the dataset.
- Change-from-last coloring needs at least two numeric observations in the selected value field.
- `Value display label` changes only the card metric label and hides the automatic `Statistic · Field` label. It does not rename the source field, change bindings, or alter the statistic calculation.
