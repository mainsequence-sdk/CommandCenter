# Strategy Book Widget

This folder owns the Flow Lab `strategy-book` widget.

## Entry Points

- `definition.ts`: widget registry definition for the Flow Lab extension.
- `StrategyBookWidget.tsx`: AG Grid-based strategy positions table used by the demo Flow Lab surface.

## Dependencies

- `fetchPositions` from `@/data/api` supplies the demo position rows.
- `createAgGridTerminalTheme` from `@/widgets/extensions/ag-grid/grid-theme` keeps the grid aligned
  with the current shell theme and tightness settings.

## Notes

- This widget is intentionally Flow Lab-owned even though it currently renders the same demo
  position feed as the shared positions table.
- Keep Flow Lab-specific behavior and presentation changes here instead of reusing the shared
  `positions-table` widget id.
