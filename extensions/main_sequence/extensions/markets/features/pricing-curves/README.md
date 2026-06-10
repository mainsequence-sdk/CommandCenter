# Pricing Curves

This feature owns the `Pricing Curves` registry surface under the `Pricing` navigation section in Main Sequence Markets.

## Entry Points

- `MainSequencePricingCurvesPage.tsx`: renders the paginated pricing curves list with backend-backed global search and registry pagination.
- `MainSequencePricingCurveDetailView.tsx`: renders the summary-driven detail view for a selected pricing curve, including the valuation date and pricing market-data set context controls plus the zero-curve visualization driven by the discount-curve endpoint.

## Dependencies

- Uses shared Command Center page, card, input, search, and registry pagination components.
- Backend calls are centralized in `extensions/main_sequence/common/api/index.ts`.
- Reuses the Markets `Zero Curve` widget renderer so page-level curve inspection and widget rendering stay aligned.

## Backend Contract

- List route: `GET /api/v1/pricing/curves/`.
- Detail summary route: `GET /api/v1/pricing/curves/{uid}/summary/`.
- Discount curve route: `GET /api/v1/pricing/curves/{uid}/discount-curve/?market_data_set=<uid-or-key>&valuation_date=<iso>`.
- Market-data set picker route: `GET /api/v1/pricing/market_data/sets/`.
- Query params: `limit`, `offset`, and `search`.
- `search` is server-backed and searches `Curve.unique_identifier`.
- List responses use the shared pagination envelope with `count`, `next`, `previous`, and `results`.
- Detail rendering uses the shared `FrontEndDetailSummary` contract via `MainSequenceEntitySummaryCard`.
- Curve detail context is stored in URL state as `msPricingCurveDate` and `msPricingMarketDataSetUid`; these controls drive the discount-curve request but do not mutate backend state.
- `valuation_date` is optional. When the frontend omits it, the backend returns the latest available discount-curve observation.
- The detail view defaults the pricing market-data set to the first returned picker entry, boots the first discount-curve request without a date, and then normalizes the stored date to the response `valuation_date`.

## Notes

- Keep pricing-specific UI in this feature folder until it becomes shared across Markets surfaces.
- Do not add client-side fuzzy search because the backend exposes explicit search semantics.
