## buildPurpose

Yield-curve style chart for a bound tabular curve dataset.

## whenToUse

- Use when an upstream Connection Query or Tabular Transform publishes rows with one maturity axis
  field and one numeric value field.

## whenNotToUse

- Do not use when the desired chart is time-based instead of curve-based.

## authoringSteps

- Bind the widget to a compatible upstream dataset.
- Choose the maturity and value fields.

## blockingRequirements

- A compatible upstream `core.tabular_frame@v1` binding is required.

## commonPitfalls

- The maturity field must contain values that can be interpreted as curve tenors.
