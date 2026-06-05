# Pricing Market Data

This feature owns the `Pricing Market Data` surface under the `Pricing` navigation section in Main Sequence Markets.

## Entry Points

- `MainSequencePricingMarketDataPage.tsx`: renders the user-facing Sets and Bindings list tabs.

## Dependencies

- Uses shared Command Center page, card, input, and registry pagination components.
- Backend calls are centralized in `extensions/main_sequence/common/api/index.ts`.

## Backend Contract

- Base route: `/api/v1/pricing/market_data/`.
- Discoverability: `GET /api/v1/pricing/market_data/` is supported in the API layer but intentionally not rendered as a user-facing card.
- Sets list: `GET /api/v1/pricing/market_data/sets/`.
- Bindings list: `GET /api/v1/pricing/market_data/bindings/`.
- Set-specific bindings list: `GET /api/v1/pricing/market_data/sets/{uid}/bindings/`.
- All list responses use the shared pagination envelope with `count`, `next`, `previous`, and `results`.
- There is no search parameter in the first backend release; UI filters are exact-match only.

## Notes

- Keep pricing-specific UI in this feature folder until it becomes shared across Markets surfaces.
- Do not add client-side fuzzy search for this surface unless the backend exposes matching search semantics.
