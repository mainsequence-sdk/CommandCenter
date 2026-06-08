## buildPurpose

Render portfolio, account, target allocation, or account target allocation rows with a source contract that controls how position values are interpreted.

## whenToUse

- Use when a workspace needs a compact positions table whose rows should be interpreted as portfolio weights, account holdings, target allocations, or account target allocation assignments.
- Use when authors need to maintain those rows directly on the widget canvas, including after portfolio hydration.

## whenNotToUse

- Do not use when the source data already exists as a reusable tabular dataset for several downstream widgets.
- Do not use local authored rows when the positions must stay permanently synchronized with a backend-managed source.

## authoringSteps

- Choose the source type first: `portfolio`, `account`, `target_position`, or `target_positions_account`.
- If the source type is `portfolio`, optionally set a portfolio uid so the widget can hydrate from the portfolio weights endpoint.
- If the source type is `account`, optionally set an account uid so the widget can hydrate from the canonical account holdings endpoint.
- If the source type is `target_positions_account`, set an account uid so the widget can hydrate and save account-scoped target allocation assignments.
- Enable `Editable in place` when authors should add assets directly on the widget and maintain rows there.
- For `target_position` and `target_positions_account`, choose the desired position type per row. `portfolio` stays fixed to weight exposure; `account` is units-only and only exposes quantity together with the top-level holdings datetime.
- For `portfolio` and `account`, enabling `Editable in place` adds an explicit in-widget edit action. The widget still opens in display mode first.
- In `account` edit mode, the widget shows a top-level `Holdings Date` datetime picker. It seeds from the account holdings snapshot timestamp, or the current time when no holdings rows exist yet.
- In `account` read mode, the widget shows `Holdings` and `By Fund` tabs when an account UID is configured. `By Fund` is read-only and groups the resolved account holdings snapshot by virtual fund.
- In `target_positions_account` edit mode, the widget shows a top-level `Target Allocation Date` datetime picker and a `Save target allocation` action.
- For `target_position` and `target_positions_account`, the add/search picker uses `GET /api/v1/account/target-allocation/targets/` with a target-type filter (`all`, `asset`, or `portfolio`) so authored rows can target either assets or portfolios.
- Hydrated `account` read surfaces show that holdings snapshot timestamp back in the table `Date` column, and the expanded detail renders a holdings-shaped JSON record instead of the generic portfolio-weights row aliases.
- Hydrated `target_positions_account` read/edit surfaces load the latest assignment by default, or the exact assignment keyed by `targetPositionsDate` when that widget prop is set.

## blockingRequirements

- Portfolio hydration requires a valid portfolio identifier and no locally persisted rows.
- Account hydration requires a valid account uid and no locally persisted rows.
- Target allocation and target allocation account widgets require at least one added target row before they show useful position content.

## inboundPorts

- None.

## outboundPorts

- None.

## runtimeOwnership

- `portfolio`, `account`, and `target_positions_account` are `execution-owner` only while they are hydrating from backend and no local rows have been persisted.
- Local authored rows for any source type render as `local-ui`.

## refreshBehavior

- Hydrated portfolio mode refreshes on dashboard refresh and manual recalculate.
- Hydrated account mode refreshes on dashboard refresh and manual recalculate.
- During account edit mode, row changes are still staged through widget props first. Clicking `Save holdings` writes a canonical snapshot through the managed-account holdings endpoint, clears the local draft rows, and lets backend hydration take over again.
- The account `By Fund` tab lazy-loads only when selected. It is hidden during inline edit mode because the response is derived from persisted backend holdings, not local draft rows.
- During target allocation account edit mode, row changes are staged through widget props first. Clicking `Save target allocation` writes the account-scoped target allocation assignment through the managed-account target allocation endpoint, clears the local draft rows, and returns the widget to the canonical backend payload.

## importantConfiguration

- `editableInPlace`: switches the widget into inline authoring mode.
- For `portfolio` and `account`, the widget enters that inline mode only after the user clicks the in-widget edit action.
- `sourceType`: `portfolio`, `account`, `target_position`, or `target_positions_account`.
- `portfolioUid`: used for portfolio hydration. Do not use numeric portfolio ids.
- `accountUid`: used for account holdings hydration and account target allocation saves.
- `holdingsDate`: persisted account-only holdings snapshot timestamp. It is stored as a timezone-aware ISO string.
- `targetPositionsDate`: persisted account target allocation assignment timestamp. It is stored as a timezone-aware ISO string.
- `positionRows`: persisted authored position rows with asset or target identity, optional `assetUid`, optional target allocation fields (`targetType`, `targetUid`, `portfolioUid`, `targetMetadata`), position type, and position value.
- `variant`: `summary` or `positions` only for hydrated portfolio mode. Authored rows always render `positions`.

## backendContracts

- Portfolio hydration uses `GET /api/v1/portfolio/<portfolio_uid>/weights/?order=desc&limit=1&include_asset_detail=true` through the shared Markets API layer.
- Account hydration uses `GET /api/v1/account/<account_uid>/holdings/`. The widget requests `order=desc&limit=1` for the latest snapshot when `holdingsDate` is not set, or `holdings_date=<timestamp>&limit=1` when an exact timestamp is requested.
- Account holdings by fund uses `GET /api/v1/account/<account_uid>/holdings/by-fund/`. The widget requests `include_asset_detail=true` and `limit=1`, sends `holdings_date=<timestamp>` when `holdingsDate` is set, otherwise sends `order=desc`. The response is grouped by `funds[]`; each fund's `holdings[]` rows are adapted into the same account holdings table contract. The view also renders `residuals[]` and `allocation_warnings[]`.
- Account save uses `POST /api/v1/account/<account_uid>/add-holdings/` with `overwrite: true`. The widget injects `target_trade_time` from `holdingsDate`, always writes `position_type: "units"`, and always sends `extra_details: {}` because that field is API-only in the current frontend contract. The request sends mandatory `asset_identifier` and `asset_uid`; it does not send `asset_id`, `price`, or `missing_price`. Signed UI quantities are split into absolute `quantity` plus `direction`, so `-10` becomes `quantity: "10"` and `direction: -1`. The save response uses the same `holdings_set_uid`, `holdings_date`, and `holdings[]` shape as the account holdings GET response.
- Target allocation account hydration uses `GET /api/v1/account/<account_uid>/target-positions/`. The widget always requests `include_asset_detail=true`, uses `order=desc&limit=1` when `targetPositionsDate` is not set, and when `targetPositionsDate` is set it sends `target_positions_date=<timestamp>&limit=1` to load the exact assignment for that timestamp.
- Target allocation add/search uses `GET /api/v1/account/target-allocation/targets/?search=<query>&target_type=<all|asset|portfolio>&limit=25&offset=0`. The result rows provide `target_type`, `target_uid`, `asset_uid`, `portfolio_uid`, `identifier`, display labels, snapshots, and metadata. The editor builds rows from this response instead of using the asset-only picker.
- Target allocation account hydration preserves the backend row target identity fields:
  `target_type`, `target_uid`, `asset_uid`, and `portfolio_uid`. The nested asset detail is
  UID-first and is used only for labels and asset identity.
- Target allocation account save uses `POST /api/v1/account/<account_uid>/add-target-positions/` with `overwrite: true`. The widget writes the top-level `target_positions_date`, preserves row target identity, sends `metadata_json` for every row, and uses the target-specific UID field:
  - `target_type`
  - `target_uid`
  - `asset_uid` for asset targets
  - `portfolio_uid` for portfolio targets
- The selected target allocation position type maps to exactly one exposure field:
  - `weight_notional_exposure`
  - `constant_notional_exposure`
  - `single_asset_quantity` for asset targets only
- Account holdings and portfolio asset add/search use `GET /api/v1/asset/?response_format=frontend_list...` to
  search and select the asset `uid`, then loads `GET /api/v1/asset/<asset_uid>/?response_format=frontend_detail`
  before adding the row. The editor builds rows from the detail payload, not the lightweight list
  item.
- Persisted widget props now include optional additive fields:
  - `editableInPlace`
  - `sourceType`
  - `accountUid`
  - `holdingsDate`
  - `targetPositionsDate`
  - `positionRows`
- `positionRows[].assetUid` may be stored as an identity helper and is required for account holdings
  saves. Target allocation rows may also store `targetType`, `targetUid`, `portfolioUid`, and
  `targetMetadata` so asset and portfolio allocations keep their backend target identity.
- Legacy persisted fields `dataMode` and `inlineRows` are still read for compatibility, but they are no longer the canonical contract.

## commonPitfalls

- Source type determines valid position types:
  - `portfolio` => only `weight_notional_exposure`
  - `account` => always `units`
  - `target_position` => `weight_notional_exposure`, `units`, or `constant_notional`; portfolio targets cannot use `units`
  - `target_positions_account` => `weight_notional_exposure`, `units`, or `constant_notional`; portfolio targets cannot use `units`
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
- `target_position` and `target_positions_account` are target allocation modes and open directly in the inline editor when inline editing is enabled.
- In `account` edit mode, the table shows `Quantity` and a blocked `Extra Details` cell. `Position Type` is hidden because the account holdings writer is units-only. `Extra Details` is not authored in the UI and can only be populated through the API.
- The `By Fund` account holdings tab requires `accountUid`. It is not shown for caller-provided account payloads that intentionally render without an account UID.
- Fund holding expanded JSON preserves allocation fields copied from the backend: `extra_details`, `allocation`, `virtual_fund_holdings_set_uid`, and `source_account_holdings_set_uid`.
- Asset and target allocation search results are UID-first. Do not assume authored targets have a numeric `id`; the editor may use a synthetic local `assetId` only for React row identity and display bookkeeping.
- In positions mode, expanding a row shows the full read-only position record as formatted JSON instead of a card-based inspector. Authored rows nest asset metadata under `asset` and keep the position fields separate. Account holdings read mode renders a canonical holdings-shaped JSON block there instead of the generic display-row aliases.
- Target allocation account read mode also renders a canonical target allocation JSON block there instead of the generic display-row aliases. That read JSON keeps backend response fields such as `target_type`, `target_uid`, `asset_uid`, `portfolio_uid`, `unique_identifier`, exposure fields, `asset`, and `portfolio`. Inline authored target allocation rows show the write-row contract instead: target-specific UID field, `metadata_json`, and exactly one exposure field.
- Target allocation account rows require `target_type` and `target_uid` in the backend contract. New
  rows authored from target allocation search preserve the returned asset or portfolio target
  identity, while hydrated rows keep their existing target identity.
- The top positions summary separates totals by position type so notionals are not mixed with percentage-based exposure rows. Account mode hides that strip because raw holdings quantities are not meaningful as one aggregate total.
