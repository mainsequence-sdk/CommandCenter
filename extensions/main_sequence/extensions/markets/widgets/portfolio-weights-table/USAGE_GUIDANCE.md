## buildPurpose

Render portfolio, account, or target-position rows with a source contract that controls how position values are interpreted.

## whenToUse

- Use when a workspace needs a compact positions table whose rows should be interpreted as portfolio weights, account holdings, or target positions.
- Use when authors need to maintain those rows directly on the widget canvas, including after portfolio hydration.

## whenNotToUse

- Do not use when the source data already exists as a reusable tabular dataset for several downstream widgets.
- Do not use local authored rows when the positions must stay permanently synchronized with a backend-managed source.

## authoringSteps

- Choose the source type first: `portfolio`, `account`, or `target_position`.
- If the source type is `portfolio`, optionally set a portfolio id so the widget can hydrate from the target portfolio weights endpoint.
- If the source type is `account`, optionally set an account uid so the widget can hydrate from the canonical account holdings endpoint.
- Enable `Editable in place` when authors should add assets directly on the widget and maintain rows there.
- For `target_position`, choose the desired position type per row. `portfolio` stays fixed to weight exposure; `account` exposes the backend position type string together with quantity when you enter edit mode.
- For `portfolio` and `account`, enabling `Editable in place` adds an explicit in-widget edit action. The widget still opens in display mode first.
- In `account` edit mode, the widget shows a top-level `Holdings Date` datetime picker. It seeds from the account holdings snapshot timestamp, or the current time when no holdings rows exist yet.

## blockingRequirements

- Portfolio hydration requires a valid portfolio identifier and no locally persisted rows.
- Account hydration requires a valid account uid and no locally persisted rows.
- Target-position widgets require at least one added asset row before they show useful position content.

## inboundPorts

- None.

## outboundPorts

- None.

## runtimeOwnership

- `portfolio` and `account` are `execution-owner` only while they are hydrating from backend and no local rows have been persisted.
- Local authored rows for any source type render as `local-ui`.

## refreshBehavior

- Hydrated portfolio mode refreshes on dashboard refresh and manual recalculate.
- Hydrated account mode refreshes on dashboard refresh and manual recalculate.
- During account edit mode, row changes are still staged through widget props first. Clicking `Save holdings` writes a canonical snapshot through the managed-account holdings endpoint, clears the local draft rows, and lets backend hydration take over again.

## importantConfiguration

- `editableInPlace`: switches the widget into inline authoring mode.
- For `portfolio` and `account`, the widget enters that inline mode only after the user clicks the in-widget edit action.
- `sourceType`: `portfolio`, `account`, or `target_position`.
- `accountUid`: used for account holdings hydration.
- `holdingsDate`: persisted account-only holdings snapshot timestamp. It is stored as a timezone-aware ISO string.
- `positionRows`: persisted authored position rows with asset identity, optional row date, position type, and position value.
- `variant`: `summary` or `positions` only for hydrated portfolio mode. Authored rows always render `positions`.

## backendContracts

- Portfolio hydration uses the existing target-portfolio weights/positions endpoint through the shared Markets API layer.
- Account hydration uses `GET /orm/api/assets/account/<account_uid>/holdings/`. If `holdings_date` is omitted, the backend returns the latest holdings snapshot.
- Account save uses `POST /orm/api/assets/account/<account_uid>/add-holdings/` with `overwrite: true`. The widget injects `target_trade_time` from `holdingsDate`, maps blank prices to `missing_price: true`, and always sends `extra_details: {}` because that field is API-only in the current frontend contract.
- Asset add/search for authored rows reuses the existing asset list endpoint.
- Persisted widget props now include optional additive fields:
  - `editableInPlace`
  - `sourceType`
  - `accountUid`
  - `positionRows`
- Legacy persisted fields `dataMode` and `inlineRows` are still read for compatibility, but they are no longer the canonical contract.

## commonPitfalls

- Source type determines valid position types:
  - `portfolio` => only `weight_notional_exposure`
  - `account` => defaults new rows to `units`, but account edit mode may save any backend `position_type` string that the author enters
  - `target_position` => `weight_notional_exposure`, `units`, or `constant_notional`
- `weight_notional_exposure` values are interpreted as decimal ratios for formatting, for example `0.15` renders as `15%`.
- `constant_notional` values are rendered as USD notionals with thousands separators.
- Row dates apply only to `portfolio` and `target_position`.
  - `portfolio` uses the portfolio snapshot `weights_date`
  - `target_position` exposes an inline date picker and defaults new rows to today
  - `account` keeps the snapshot datetime at the top-level `holdingsDate` field instead of per-row dates
- If any authored row uses `units`, the widget surfaces a warning because there is no connected price feed here to calculate unit notional exposure.
- Authored rows force the positions view; summary mode does not apply to locally maintained rows.
- `portfolio` and `account` do not auto-open the editor just because inline editing is enabled. They keep the resolved positions table visible until the user explicitly enters edit mode.
- In `account` edit mode, the table shows `Position Type`, `Quantity`, and a blocked `Extra Details` cell. `Extra Details` is not authored in the UI and can only be populated through the API.
- In positions mode, expanding a row shows the full read-only position record as formatted JSON instead of a card-based inspector. Authored rows nest asset metadata under `asset` and keep the position fields separate.
- The top positions summary separates totals by position type so notionals are not mixed with percentage-based exposure rows. Account mode hides that strip because raw holdings quantities are not meaningful as one aggregate total.
