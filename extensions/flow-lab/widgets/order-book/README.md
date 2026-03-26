# Order Book Widgets

## Purpose

This widget module owns the Flow Lab order-book surfaces backed by the shared `fetchOrderBook`
data adapter. The modules remain in the repo, but they are not currently registered in the live widget catalog.

## Entry Points

- `OrderBookWidget.tsx`: the original text-first Level II snapshot with bid/ask columns.
- `OrderBookDepthWidget.tsx`: a depth-oriented variant that shows size as filled bars while still
  keeping numeric size and cumulative total visible.
- `definition.ts`: exports the widget definitions owned by the Flow Lab extension if they are re-enabled.

## Dependencies

- `fetchOrderBook` from `src/data/api`
- shared formatting helpers from `src/lib/format`
- Flow Lab extension ownership in `extensions/flow-lab/index.ts`

## Maintenance Notes

- Keep both widget ids stable in case these widgets are re-enabled or historical dashboards still reference either the legacy text view or the newer depth/distribution view.
- If the backend order-book payload changes, update both widget implementations together so they
  stay visually consistent.
