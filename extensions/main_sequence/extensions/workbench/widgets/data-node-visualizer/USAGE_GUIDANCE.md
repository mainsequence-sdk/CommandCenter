## buildPurpose

Use this widget to chart a bound Data Node dataset over time or another selected X-axis field.

## whenToUse

- Use when a Data Node dataset should be rendered as a line, area, or bar chart.

## whenNotToUse

- Do not use when the widget should own the source data query or transform pipeline.

## authoringSteps

- Bind the widget to a Data Node dataset.
- Choose X and Y fields that match the intended chart.
- Select provider, chart type, and grouping behavior as needed.

## blockingRequirements

- A compatible upstream Data Node binding is required before field selectors become meaningful.

## commonPitfalls

- Ambiguous date strings can make the inferred time axis behave unexpectedly.
