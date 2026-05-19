# Position Detail Widget

This folder contains the reusable `Position Detail` widget and the shared table renderer for portfolio, holdings, and target-position payloads used by Main Sequence Markets.

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
  - `account` can hydrate from the managed-account `holdings/` endpoint keyed by account uid
  - `target_position` is currently local-authored in the frontend
- The widget now has three persisted source contracts:
  - `portfolio`: rows are interpreted only as `weight_notional_exposure`
  - `account`: rows hydrate from canonical holdings and save back as a holdings snapshot with a top-level `holdingsDate`
  - `target_position`: rows may use any supported position type
- The page-level portfolio detail flow reuses the same table component so widget and surface rendering stay aligned.
- The reusable widget accepts:
  - `sourceType`
  - `portfolioId` for portfolio hydration
  - `accountUid` for account holdings hydration
  - `targetPortfolioId` as a compatibility fallback for the same hydration path
  - `editableInPlace`
  - `positionRows`
- `positionRows` persists locally authored or post-hydration-edited rows. Each row persists:
  - `assetId`
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
- The widget now normalizes a `date` onto every position row:
  - locally added `target_position` rows default to today and remain editable through the date picker
  - persisted rows without a date are repaired to today
  - hydrated `portfolio` rows always use the portfolio snapshot `weights_date`
  - hydrated `account` rows now carry the holdings snapshot timestamp for read/display surfaces
  - persisted `account` draft rows still do not store a row-level date; the canonical snapshot datetime lives at `holdingsDate`
- When `account` enters edit mode, the widget shows a top-level `Holdings Date` `datetime-local` control seeded from the resolved account holdings timestamp, or now when the account has no holdings rows yet.
- `account` edit mode saves through `POST /orm/api/assets/account/<account_uid>/add-holdings/` with `overwrite: true`, maps blank prices to `missing_price: true`, injects `target_trade_time` from `holdingsDate`, always writes `position_type: "units"`, and always sends `extra_details: {}` because that field is not authored in the widget.
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
- In `positions` mode, the widget shows a compact summary strip above the table, but it separates totals by position type and excludes `units` rows from aggregation because raw unit counts across different assets are not meaningful as one total.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real mixed behavior here:
  - portfolio source may hydrate from backend until local rows are persisted
  - account source may hydrate from backend until the author saves a holdings snapshot back to the managed account
  - target_position is currently a local-authored contract
  - `positionRows` is still the local draft contract during edit mode, but successful account saves intentionally clear those draft rows so hydration resumes from the canonical backend snapshot
- Storage impact: `holdingsDate` is a persisted widget prop and now stores a timezone-aware ISO timestamp instead of a date-only value. This changes the frontend workspace storage shape for account-mode widgets but does not require a backend registry payload change because the field remains a string.
- Bump `widgetVersion` when the configuration surface, runtime behavior, or agent-facing authoring
  guidance changes materially.
