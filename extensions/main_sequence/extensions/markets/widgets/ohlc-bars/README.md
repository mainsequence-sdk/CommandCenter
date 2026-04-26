# OHLC Bars Widget

This folder owns the Markets `OHLC Bars` widget. It renders open-high-low-close market bars with
TradingView Lightweight Charts and reads its rows from a bound upstream dataset, typically a
Connection Query or Tabular Transform output.

## Entry Points

- `definition.ts`: registry definition for the stable `main-sequence-ohlc-bars` widget id.
- `OhlcBarsWidget.tsx`: runtime renderer built on Lightweight Charts `CandlestickSeries` so each
  OHLC point has a visible filled body plus high/low wick, optional volume histogram, and optional
  SMA/EMA overlays.
- `ohlcBarsModel.ts`: widget prop normalization, field inference, timestamp parsing, and OHLC
  series construction.
- `controller.ts`: schema controller context for bound dataset field options.
- `schema.tsx`: settings schema for source binding and OHLC field mapping.

## Data Contract

- The widget expects rows from a bound `core.tabular_frame@v1` dataset.
- On workspace runtime surfaces it behaves as a `consumer`: it reads the canonical published
  dataset and asks the shared execution layer to resolve upstream executable sources when needed.
- Bound inputs are read through the shared upstream contract: retained data comes from the resolved
  `upstreamBase` frame and optional delta rows are exposed separately. When the upstream update is
  delta-safe, the chart keeps its mounted Lightweight Charts instance and appends or replaces OHLC
  bars instead of rebuilding from the retained snapshot.
- The source table must include one time field plus numeric open, high, low, and close fields.
- The source table may include a numeric volume field. When `volumeField` is mapped, the widget
  renders volume in a lower Lightweight Charts histogram pane.
- Optional studies are saved in `studies` and currently support SMA and EMA overlays calculated from
  close prices.
- Time values may be ISO date strings, ISO datetime strings, Unix seconds, Unix milliseconds, Unix
  microseconds, or Unix nanoseconds.
- Price values may be numbers or numeric strings. Invalid rows are skipped and surfaced as a warning
  in the widget body.

## Maintenance Notes

- This widget reuses existing Workbench source-binding helpers under
  `../../../workbench/widgets/data-node-shared/` to stay consistent with other Markets dataset
  consumers. If more Markets widgets need the same source contract, move that layer into
  `extensions/main_sequence/common/` instead of growing more cross-extension imports.
- Runtime fetch ownership should stay with upstream execution owners such as Connection Query or
  Tabular Transform. This widget may derive local chart bars from published rows, but it must not
  introduce its own canonical backend data fetch path on workspace surfaces.
- `definition.ts` publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`. Keep it aligned with the accepted tabular response shape and Lightweight
  Charts rendering semantics.
- Bump `widgetVersion` when the mapped-field contract, chart behavior, or agent-facing authoring
  guidance changes materially.
