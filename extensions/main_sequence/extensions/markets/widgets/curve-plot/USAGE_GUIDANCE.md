## buildPurpose

Yield-curve style chart for a bound Data Node dataset.

## whenToUse

- Use when the dataset has one maturity axis field and one numeric value field.

## whenNotToUse

- Do not use when the desired chart is time-based instead of curve-based.

## authoringSteps

- Bind the widget to a Data Node dataset.
- Choose the maturity and value fields.

## blockingRequirements

- A compatible upstream Data Node binding is required.

## commonPitfalls

- The maturity field must contain values that can be interpreted as curve tenors.
