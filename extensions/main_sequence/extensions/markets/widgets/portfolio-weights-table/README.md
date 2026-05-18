# Portfolio Weights Widget

This folder contains the reusable `Portfolio Weights` widget and the shared table renderer for portfolio weights and position-detail payloads from the Main Sequence Markets target-portfolio endpoints.

## Entry Points

- `PortfolioWeightsTable.tsx`: shared TanStack table renderer used by both the widget and the portfolio detail page.
- `PortfolioWeightsInlineEditor.tsx`: inline asset search and row editor used when `editableInPlace` is enabled.
- `portfolioWeightsRuntime.ts`: shared prop/runtime normalization for the workspace widget.
- `portfolioWeightsExecution.ts`: execution-owner adapter that loads the canonical weights payload during workspace refresh.
- `PortfolioWeightsWidget.tsx`: mounted runtime widget that renders the shared weights payload instead of fetching it directly.
- `PortfolioWeightsWidgetSettings.tsx`: widget settings form for switching between backend portfolio mode and inline authoring mode.
- `definition.ts`: widget registry definition for `Portfolio Weights`.

## Notes

- On workspace runtime surfaces, `Portfolio Weights` now behaves as an `execution-owner`: the shared execution layer owns the backend `weights-position-details` request, and the mounted widget only renders the saved runtime payload.
- The widget now has two persisted source modes:
  - `portfolio`: current backend-backed execution-owner behavior
  - `inline`: local rows persisted in widget props and edited directly on the canvas
- The page-level portfolio detail flow reuses the same table component so widget and surface rendering stay aligned.
- The reusable widget expects a `portfolioId` prop and can render either the summary weights grid or the detailed positions grid through the `variant` prop. `targetPortfolioId` remains accepted as a compatibility fallback.
- Inline mode is keyed by `editableInPlace` / `dataMode` and stores rows in `inlineRows`. Each row persists:
  - `assetId`
  - `assetName`
  - `assetTicker`
  - `uniqueIdentifier`
  - `figi`
  - `positionType`
  - `positionValue`
- In `summary` mode, the widget treats `weights` as serialized assets: the table shows only `FIGI`, and each row expands into a focused asset inspector showing `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`.
- In `positions` mode, the grid is intentionally narrowed to `Asset Name`, `Asset Ticker`, `UID`, `Position Type`, and `Position Value`, and each row expands into a read-only formatted JSON view of that position record.
- Inline mode always renders the positions view. It does not support summary mode because the rows are authored directly as position entries.
- When `Position Type` is `weight_notional_exposure`, the widget formats `Position Value` as a percentage.
- Inline mode supports exactly three persisted position types:
  - `weight_notional_exposure`
  - `units`
  - `constant_notional`
- In `positions` mode, the widget also shows a compact summary strip above the table for total longs, total shorts, and total net exposure.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real mixed behavior here:
  - portfolio mode owns execution
  - inline mode is local authored state
  - inline rows are a persisted widget-prop contract
- Bump `widgetVersion` when the configuration surface, runtime behavior, or agent-facing authoring
  guidance changes materially.
