# Zero Curve Widget

This folder owns the Markets `Zero Curve` widget. It renders compressed Main Sequence curve Data
Node payloads on a numeric days axis using ECharts.

## Entry Points

- `definition.ts`: registry definition for the stable `main-sequence-zero-curve` widget id.
- `ZeroCurveWidget.tsx`: runtime renderer built on ECharts numeric x/y axes.
- `zeroCurveModel.ts`: compressed curve decompression, selection filtering, and series construction.
- `controller.ts`: schema controller context built on the shared DataNode-source layer.
- `schema.tsx`: settings schema for DataNode source selection and unique-identifier filtering.

## Data Contract

- The widget expects rows coming from a linked `Data Node` widget runtime.
- On workspace runtime surfaces it now behaves as a `consumer`: it reads the canonical published dataset and asks the shared execution layer to resolve upstream executable sources when needed.
- The linked dataset must expose the standard compressed curve contract:
  - `time_index`
  - `unique_identifier`
  - `curve`
- `curve` is decoded from Base64 + gzip + JSON before plotting.
- Decompressed curve keys are treated as day counts on the x-axis.
- Decompressed curve values are interpreted as decimal rates and converted into percent values for
  plotting and display.

## Visual Semantics

- One `unique_identifier` owns one stable base color.
- Different `time_index` snapshots for the same `unique_identifier` reuse that same hue. All
  historical snapshots render with one low-alpha treatment, while only the latest snapshot stays
  fully opaque and thicker.
- Point markers are disabled by default because zero-curve datasets can contain dense histories and
  should read as smooth cross-sectional time families rather than highlighted point clouds.
- Tooltips are item-scoped, not axis-scoped, so hovering a dense history does not open one massive
  popup containing every curve at the same x position. Hovered points carry their own
  `time_index` label so the tooltip can always show the specific curve date reliably.
- The chart shows one compact overall observation window summary (`From` / `To`) in the top-left,
  derived from the rendered `time_index` range.

## Maintenance Notes

- This widget intentionally depends on the existing Workbench DataNode-source helpers under
  `../../../workbench/widgets/data-node-shared/` so it can bind to a `Data Node` widget runtime.
  If more Markets widgets need the same binding model, move that shared layer into
  `extensions/main_sequence/common/`.
- `Zero Curve` owns the compressed curve payload contract. The sibling `curve-plot/` widget should
  stay focused on generic mapped maturity/value datasets.
- Runtime fetch ownership should stay with upstream execution owners such as `main-sequence-data-node`.
  This widget may decompress and transform published rows locally, but it must not create its own
  canonical backend data fetch path on workspace surfaces.
