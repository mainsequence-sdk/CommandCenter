## buildPurpose

Render portfolio positions either from the Markets portfolio weights endpoint or from inline rows authored directly on the widget canvas.

## whenToUse

- Use when a workspace needs a compact positions table for one target portfolio.
- Use when authors need to hand-enter or prototype a small set of positions directly in the workspace without relying on a backend portfolio.

## whenNotToUse

- Do not use when the source data already exists as a reusable tabular dataset for several downstream widgets.
- Do not use inline mode when the positions must stay synchronized with a backend-managed target portfolio.

## authoringSteps

- Choose whether the widget should stay portfolio-backed or become editable in place.
- In portfolio mode, set the portfolio id and choose `summary` or `positions`.
- In editable-in-place mode, add assets directly on the widget and set each row's position type and value.

## blockingRequirements

- Portfolio mode requires a valid portfolio identifier.
- Inline mode requires at least one added asset row before it shows useful position content.

## inboundPorts

- None.

## outboundPorts

- None.

## runtimeOwnership

- Portfolio mode is `execution-owner`.
- Editable-in-place mode is `local-ui` and renders persisted widget props without a backend execution request.

## refreshBehavior

- Portfolio mode refreshes on dashboard refresh and manual recalculate.
- Editable-in-place mode does not execute a backend refresh; changes are persisted immediately through widget prop updates in workspace edit mode.

## importantConfiguration

- `editableInPlace`: switches the widget into inline authoring mode.
- `dataMode`: normalized internal source mode (`portfolio` or `inline`).
- `inlineRows`: persisted inline position rows with asset identity, position type, and position value.
- `variant`: `summary` or `positions` in portfolio mode. Inline mode always renders `positions`.

## backendContracts

- Portfolio mode uses the existing target-portfolio weights/positions endpoint through the shared Markets API layer.
- Inline mode reuses the existing asset search list endpoint for add-asset authoring.
- Persisted widget props now include optional additive fields:
  - `editableInPlace`
  - `dataMode`
  - `inlineRows`

## commonPitfalls

- Inline mode is a different source model, not a cosmetic toggle over the backend portfolio fetch.
- `weight_notional_exposure` values are interpreted as decimal ratios for formatting, for example `0.15` renders as `15%`.
- Inline mode forces the positions view; summary mode does not apply to locally authored rows.
- In positions mode, expanding a row shows the full read-only position record as formatted JSON instead of a card-based inspector.
