## buildPurpose

Render portfolio, account, target-position, or account target-position rows with a source contract that controls how position values are interpreted.

## whenToUse

- Use when a workspace needs a compact positions table whose rows should be interpreted as portfolio weights, account holdings, target positions, or account target-position assignments.
- Use when authors need to maintain those rows directly on the widget canvas, including after portfolio hydration.

## whenNotToUse

- Do not use when the source data already exists as a reusable tabular dataset for several downstream widgets.
- Do not use local authored rows when the positions must stay permanently synchronized with a backend-managed source.

## authoringSteps

- Choose the source type first: `portfolio`, `account`, `target_position`, or `target_positions_account`.
- If the source type is `portfolio`, optionally set a portfolio id so the widget can hydrate from the target portfolio weights endpoint.
- If the source type is `account`, optionally set an account uid so the widget can hydrate from the canonical account holdings endpoint.
- If the source type is `target_positions_account`, set an account uid so the widget can save account-scoped target-position assignments.
- Enable `Editable in place` when authors should add assets directly on the widget and maintain rows there.
- For `target_position` and `target_positions_account`, choose the desired position type per row. `portfolio` stays fixed to weight exposure; `account` is units-only and only exposes quantity together with the top-level holdings datetime.
- For `portfolio` and `account`, enabling `Editable in place` adds an explicit in-widget edit action. The widget still opens in display mode first.
- In `account` edit mode, the widget shows a top-level `Holdings Date` datetime picker. It seeds from the account holdings snapshot timestamp, or the current time when no holdings rows exist yet.
- In `target_positions_account` edit mode, the widget shows a top-level `Target Positions Date` datetime picker and a `Save target positions` action.
- Hydrated `account` read surfaces show that holdings snapshot timestamp back in the table `Date` column, and the expanded detail renders a holdings-shaped JSON record instead of the generic portfolio-weights row aliases.

## blockingRequirements

- Portfolio hydration requires a valid portfolio identifier and no locally persisted rows.
- Account hydration requires a valid account uid and no locally persisted rows.
- Target-position and target-positions-account widgets require at least one added asset row before they show useful position content.

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
- During target-positions-account edit mode, row changes are staged through widget props first. Clicking `Save target positions` writes the account-scoped target-position assignment through the managed-account target-position endpoint and keeps the local rows as the editable source of truth for that widget instance.

## importantConfiguration

- `editableInPlace`: switches the widget into inline authoring mode.
- For `portfolio` and `account`, the widget enters that inline mode only after the user clicks the in-widget edit action.
- `sourceType`: `portfolio`, `account`, `target_position`, or `target_positions_account`.
- `accountUid`: used for account holdings hydration and account target-position saves.
- `holdingsDate`: persisted account-only holdings snapshot timestamp. It is stored as a timezone-aware ISO string.
- `targetPositionsDate`: persisted account target-position assignment timestamp. It is stored as a timezone-aware ISO string.
- `positionRows`: persisted authored position rows with asset identity, position type, and position value.
- `variant`: `summary` or `positions` only for hydrated portfolio mode. Authored rows always render `positions`.

## backendContracts

- Portfolio hydration uses the existing target-portfolio weights/positions endpoint through the shared Markets API layer.
- Account hydration uses `GET /orm/api/assets/account/<account_uid>/holdings/`. If `holdings_date` is omitted, the backend returns the latest holdings snapshot.
- Account save uses `POST /orm/api/assets/account/<account_uid>/add-holdings/` with `overwrite: true`. The widget injects `target_trade_time` from `holdingsDate`, maps blank prices to `missing_price: true`, always writes `position_type: "units"`, and always sends `extra_details: {}` because that field is API-only in the current frontend contract.
- Target positions account save uses `POST /orm/api/assets/account/<account_uid>/add-target-positions/`. The widget writes the top-level `target_positions_date`, sends `unique_identifier` on every row, and maps the selected position type to exactly one of:
  - `weight_notional_exposure`
  - `constant_notional_exposure`
  - `single_asset_quantity`
- Asset add/search for authored rows reuses the existing asset list endpoint.
- Persisted widget props now include optional additive fields:
  - `editableInPlace`
  - `sourceType`
  - `accountUid`
  - `holdingsDate`
  - `targetPositionsDate`
  - `positionRows`
- Legacy persisted fields `dataMode` and `inlineRows` are still read for compatibility, but they are no longer the canonical contract.

## commonPitfalls

- Source type determines valid position types:
  - `portfolio` => only `weight_notional_exposure`
  - `account` => always `units`
  - `target_position` => `weight_notional_exposure`, `units`, or `constant_notional`
  - `target_positions_account` => `weight_notional_exposure`, `units`, or `constant_notional`
- `weight_notional_exposure` values are interpreted as decimal ratios for formatting, for example `0.15` renders as `15%`.
- `constant_notional` values are rendered as USD notionals with thousands separators.
- Row dates on persisted authored rows no longer apply outside `portfolio`.
  - `portfolio` uses the portfolio snapshot `weights_date`
  - `account` keeps the canonical snapshot datetime at the top-level `holdingsDate` field instead of persisting per-row dates
  - `target_position` and `target_positions_account` keep their canonical datetime, when relevant, at the widget level instead of the row level
  - hydrated `account` rows still render that snapshot datetime in read mode so the date stays visible on holdings tables
- If any authored row uses `units`, the widget surfaces a warning because there is no connected price feed here to calculate unit notional exposure.
- Authored rows force the positions view; summary mode does not apply to locally maintained rows.
- `portfolio` and `account` do not auto-open the editor just because inline editing is enabled. They keep the resolved positions table visible until the user explicitly enters edit mode.
- `target_position` and `target_positions_account` are authoring-first modes and open directly in the inline editor when inline editing is enabled.
- In `account` edit mode, the table shows `Quantity` and a blocked `Extra Details` cell. `Position Type` is hidden because the account holdings writer is units-only. `Extra Details` is not authored in the UI and can only be populated through the API.
- In positions mode, expanding a row shows the full read-only position record as formatted JSON instead of a card-based inspector. Authored rows nest asset metadata under `asset` and keep the position fields separate. Account holdings read mode renders a canonical holdings-shaped JSON block there instead of the generic display-row aliases.
- The top positions summary separates totals by position type so notionals are not mixed with percentage-based exposure rows. Account mode hides that strip because raw holdings quantities are not meaningful as one aggregate total.
