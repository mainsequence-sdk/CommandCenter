# Position Detail Widget

This folder contains the reusable `Position Detail` widget and the shared table renderer for portfolio, holdings, target-position, and account target-position payloads used by Main Sequence Markets.

## Entry Points

- `PositionDetailTable.tsx`: shared TanStack table renderer used by both the widget and the portfolio detail page.
- `PositionDetailInlineEditor.tsx`: inline asset search and row editor used when `editableInPlace` is enabled.
- `positionDetailRuntime.ts`: shared prop/runtime normalization for the workspace widget.
- `positionDetailExecution.ts`: execution-owner adapter that loads the canonical position-detail payload during workspace refresh.
- `PositionDetailWidget.tsx`: mounted runtime widget that renders the shared payload instead of fetching it directly.
- `PositionDetailWidgetSettings.tsx`: widget settings form for choosing the source contract and whether authors maintain rows directly on the canvas.
- `definition.ts`: widget registry definition for `Position Detail`.

## Notes

- On workspace runtime surfaces, `Position Detail` behaves as a mixed source widget:
  - `portfolio` can hydrate from the target-portfolio `weights-position-details` endpoint
  - `account` can hydrate from the managed-account `holdings/` collection endpoint keyed by account uid and resolve the latest snapshot with `order=desc&limit=1`
  - `target_position` is local-authored in the frontend
  - `target_positions_account` can hydrate from the managed-account `target-positions/` collection endpoint keyed by account uid and resolve the latest assignment with `order=desc&limit=1`, then save account-scoped target-position assignments back through the matching write endpoint
- The widget now has four persisted source contracts:
  - `portfolio`: rows are interpreted only as `weight_notional_exposure`
  - `account`: rows hydrate from canonical holdings and save back as a holdings snapshot with a top-level `holdingsDate`
  - `target_position`: rows may use any supported position type and remain local-authored
  - `target_positions_account`: rows may use any supported position type, hydrate from the latest or exact account target-position assignment, and save through a top-level `targetPositionsDate`
- The page-level portfolio detail flow reuses the same table component so widget and surface rendering stay aligned.
- The reusable widget accepts:
  - `sourceType`
  - `portfolioUid` for portfolio hydration
  - `accountUid` for account holdings hydration or account target-position saves
  - `holdingsDate` for account-mode snapshot saves
  - `targetPositionsDate` for account target-position assignment saves
  - `targetPortfolioUid` for target-portfolio hydration
  - `editableInPlace`
  - `positionRows`
- `positionRows` persists locally authored or post-hydration-edited rows. Each row persists:
  - `assetId`
  - `assetUid`
  - `assetName`
  - `assetTicker`
  - `uniqueIdentifier`
  - `figi`
  - `positionType`
  - `positionValue`
- Legacy `dataMode` / `inlineRows` are still read for compatibility, but the canonical contract is now `sourceType` / `positionRows`.
- In `summary` mode, the widget treats `weights` as serialized assets: the table shows only `FIGI`, and each row expands into a focused asset inspector showing `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`.
- In `positions` mode, the grid is intentionally narrowed to `Asset Name`, `Asset Ticker`, `UID`, `Date`, and the source-appropriate position fields. Account mode is units-only, hides `Position Type`, renames `Position Value` to `Quantity`, and exposes a blocked `Extra Details` cell because that field is API-only.
- Editable-in-place mode always renders the positions view because rows are maintained as position entries directly on the canvas.
- For `portfolio` and `account`, editable-in-place no longer drops the widget straight into the editor. Those sources render the normal positions table first and expose an in-widget `Edit positions` action. `target_position` still opens directly in inline edit mode because that source is authoring-first.
- Account holdings edit mode must hydrate existing backend rows with canonical asset uid identity.
  The write contract requires `asset_uid`; numeric `asset_id` is not sent to the holdings write
  endpoint.
- Asset search in edit mode uses `GET /api/v1/asset/?response_format=frontend_list...` only to select
  the asset `uid`, then loads `GET /api/v1/asset/<uid>/?response_format=frontend_detail` before
  adding the row. The editor must not build holdings rows from the lightweight list item or assume
  the asset has a numeric `id`.
- Row-level dates are now only part of the `portfolio` read contract:
  - hydrated `portfolio` rows use the portfolio snapshot `weights_date`
  - `account` keeps the canonical snapshot datetime at the top-level `holdingsDate` field instead of persisting per-row dates
  - `target_position` and `target_positions_account` do not persist row-level dates in `positionRows`
  - hydrated `account` rows still render the holdings snapshot timestamp on read surfaces so the date stays visible
- When `account` enters edit mode, the widget shows a top-level `Holdings Date` `datetime-local` control seeded from the resolved account holdings timestamp, or now when the account has no holdings rows yet.
- When `target_positions_account` enters edit mode, the widget shows a top-level `Target Positions Date` `datetime-local` control seeded from the exact assignment timestamp when loaded, the persisted widget prop when present, or the current time when nothing exists yet.
- `account` edit mode saves through `POST /api/v1/account/<account_uid>/add-holdings/` with `overwrite: true`, injects `target_trade_time` from `holdingsDate`, always writes `position_type: "units"`, and always sends `extra_details: {}` because that field is not authored in the widget. Signed UI quantities are sent as absolute `quantity` plus `direction`, so `-10` becomes `quantity: "10"` and `direction: -1`. The request sends mandatory `asset_uid`; it does not send `asset_id`, `price`, or `missing_price`.
- `account` read mode hydrates through `GET /api/v1/account/<account_uid>/holdings/` with `include_asset_detail=true`. Without `holdingsDate`, it requests the latest snapshot using `order=desc&limit=1`; when `holdingsDate` is set, it requests that exact timestamp.
- `target_positions_account` read mode hydrates through `GET /api/v1/account/<account_uid>/target-positions/` with `include_asset_detail=true`. Without `targetPositionsDate`, it requests the latest assignment using `order=desc&limit=1`; when `targetPositionsDate` is set, it requests that exact timestamp.
- That target-positions GET response is uid-only for nested assets. `positions[].asset` should
  expose `uid`, `unique_identifier`, and `current_snapshot.{name,ticker}`; the frontend must not
  require numeric asset ids or `figi` there.
- `target_positions_account` edit mode saves through `POST /api/v1/account/<account_uid>/add-target-positions/` with the top-level `target_positions_date` and one row-level target position selector field per asset:
  - `weight_notional_exposure`
  - `constant_notional_exposure`
  - `single_asset_quantity`
- When `Position Type` is `weight_notional_exposure`, the widget formats `Position Value` as a percentage.
- When `Position Type` is `constant_notional`, the widget formats `Position Value` as a USD notional with thousands separators.
- When any authored row uses `units`, the widget shows an in-canvas warning that no price feed is connected here, so unit notional exposure cannot be calculated.
- The widget supports exactly three persisted position types:
  - `weight_notional_exposure`
  - `units`
  - `constant_notional`
- Source type constrains which of those types are valid:
  - `portfolio` => only `weight_notional_exposure`
  - `account` => forced to `units`
  - `target_position` => all three
  - `target_positions_account` => all three
- In `positions` mode, the widget shows a compact summary strip above the table, but it separates totals by position type and excludes `units` rows from aggregation because raw unit counts across different assets are not meaningful as one total.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real mixed behavior here:
  - portfolio source may hydrate from backend until local rows are persisted
  - account source may hydrate from backend until the author saves a holdings snapshot back to the managed account
  - target_position is a local-authored contract
  - target_positions_account may hydrate from backend until local rows are persisted, and can write an account-scoped target-position assignment
  - `positionRows` is still the local draft contract during edit mode; successful account holdings saves intentionally clear those draft rows so hydration resumes from the canonical backend snapshot, and successful target positions account saves now do the same so the widget returns to the canonical target-position assignment payload
- Storage impact: `portfolioUid`, `targetPortfolioUid`, `holdingsDate`, and `targetPositionsDate` are persisted widget props. Portfolio references are UID-only; legacy `portfolioId` and `targetPortfolioId` props are not supported because backend numeric-ID lookups are deprecated. The date fields store timezone-aware ISO timestamps. This changes the frontend workspace storage shape for account-mode and portfolio-mode widgets but does not require a backend registry payload change because the added fields remain strings.
- Storage impact: `positionRows[].assetUid` is an optional frontend workspace field used for duplicate
  detection and display while editing, but it is mandatory for account holdings saves.
- Backend contract impact: account holdings writes send mandatory `asset_uid`, do not send `asset_id`,
  and no longer send row-level `price` or `missing_price`. They now send absolute `quantity` plus
  `direction` for signed positions.
- Bump `widgetVersion` when the configuration surface, runtime behavior, or agent-facing authoring
  guidance changes materially.
