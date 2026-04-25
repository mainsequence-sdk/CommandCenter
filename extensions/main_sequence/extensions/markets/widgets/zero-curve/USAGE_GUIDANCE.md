## buildPurpose

Days-based zero-curve visualization for a bound compressed curve dataset.

## whenToUse

- Use when an upstream Connection Query or Tabular Transform publishes compressed Main Sequence
  curve rows.

## whenNotToUse

- Do not use when the source data should be visualized as a time series or generic table.

## authoringSteps

- Bind the widget to a compatible upstream dataset.
- Choose the fields that identify the curve values to render.

## blockingRequirements

- A compatible upstream `core.tabular_frame@v1` binding is required.

## commonPitfalls

- This widget assumes a curve-oriented shape, not a generic time series schema.
