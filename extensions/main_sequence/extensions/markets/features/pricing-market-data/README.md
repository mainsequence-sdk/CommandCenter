# Pricing Market Data

This feature owns the `Pricing Market Data` surface under the `Pricing` navigation section in Main Sequence Markets.

## Entry Points

- `MainSequencePricingMarketDataPage.tsx`: lightweight page shell for future pricing-oriented market data workflows.

## Dependencies

- Uses shared Command Center page and card components.
- No backend API contract is wired yet.

## Notes

- Keep pricing-specific UI in this feature folder until it becomes shared across Markets surfaces.
- Add API helpers under `extensions/main_sequence/common/api/` only when the backend contract is defined.
