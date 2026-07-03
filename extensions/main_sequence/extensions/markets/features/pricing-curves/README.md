# Pricing Curves

This feature owns the `Pricing Curves` registry surface under the `Pricing` navigation section in Main Sequence Markets.

## Entry Points

- `MainSequencePricingCurvesPage.tsx`: renders the paginated pricing curves list with backend-backed global search and registry pagination.
- `MainSequencePricingCurveDetailView.tsx`: renders the summary-driven detail view for a selected pricing curve, including the `Curve` tab for valuation-date and pricing market-data set context controls plus the `Curve Selections` tab for market-data bindings that select the curve.

## Dependencies

- Uses shared Command Center page, card, input, search, and registry pagination components.
- Backend calls are centralized in `extensions/main_sequence/common/api/index.ts`.
- Reuses the Markets `Zero Curve` widget renderer so page-level curve inspection and widget rendering stay aligned.

## Backend Contract

- List route: `GET /api/v1/pricing/curves/`.
- Detail summary route: `GET /api/v1/pricing/curves/{uid}/summary/`.
- Curve selections route: `GET /api/v1/pricing/curves/{uid}/curve-selections/`.
- Discount curve route: `GET /api/v1/pricing/curves/{uid}/discount-curve/?market_data_set=<uid-or-key>&valuation_date=<iso>`.
- Market-data set picker route: `GET /api/v1/pricing/market_data/sets/`.
- Query params: `limit`, `offset`, `search`, `curve_type`, and `source`. Do not send `index_uid`; curve identity does not own index selection.
- `search` is server-backed and searches `Curve.unique_identifier`.
- List responses use the shared pagination envelope with `count`, `next`, `previous`, and `results`.
- Detail rendering uses the shared `FrontEndDetailSummary` contract via `MainSequenceEntitySummaryCard`.
- Summary extensions may include `curve_selection_count` and `curve_selections_url`; the detail tabs use the count for the tab label and the concrete endpoint helper for loading selections.
- Curve detail context is stored in URL state as `msPricingCurveDate` and `msPricingMarketDataSetUid`; these controls drive the discount-curve request but do not mutate backend state.
- `valuation_date` is optional. When the frontend omits it, the backend returns the latest available discount-curve observation.
- The detail view defaults the pricing market-data set to the first returned picker entry, boots the first discount-curve request without a date, and then normalizes the stored date to the response `valuation_date`.
- Build details are intentionally not wired because the backend has not exposed `GET /api/v1/pricing/curves/{uid}/building-details/` yet.

## Notes

- Keep pricing-specific UI in this feature folder until it becomes shared across Markets surfaces.
- Do not add client-side fuzzy search because the backend exposes explicit search semantics.
- `selector.index_uid` in the curve selections response is binding selector metadata only; it must not be rendered as a curve-owned index.
