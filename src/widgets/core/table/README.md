# Table Widgets

This folder owns the core `table` and `pro-table` widgets. Both are generic consumers for
`core.tabular_frame@v1` datasets, plus a manual table editor that also republishes one canonical
tabular frame.

## Entry Points

- `definition.shared.ts`: shared widget-definition factory for `table` and `pro-table`.
- `definition.ts`: Community `table` widget entrypoint.
- `proDefinition.ts`: Enterprise-backed `pro-table` widget entrypoint.
- `proTableOptions.ts`: shared Pro-table capability bundle reused by `pro-table` and table-backed
  domain widgets that should inherit the Enterprise path.
- `TableWidget.tsx`: source/binding owner for the shared table runtime. It resolves bound, manual,
  connection, and incremental table sources, then delegates rendering to `TableFrameView`.
- `TableFrameView.tsx`: reusable AG Grid-backed table frame renderer for table-backed widgets.
  It owns table-native formatting, threshold rules, heatmaps, data bars, gauges, quick filtering,
  schema validation display, optional per-column custom cell renderers, and variant-specific AG
  Grid module injection.
- `TableWidgetSettings.tsx`: shared settings editor for Community and Pro table widgets.
- `managedConnectionConsumer.ts`: shared managed-connection adapters for `table` and `pro-table`
  so the generic widget-settings route can create one hidden `connection-query` or
  `connection-stream-query` source for either widget id.
- `ManualTableEditor.tsx`: spreadsheet-style editor for manual display rows.
- `tableModel.ts`: table configuration normalization, frame adaptation, schema resolution, selection output resolution, formatting helpers, datetime parsing/rendering, and validation.
- `tableFormulaCompiler.ts`: shared column-formula parser that compiles settings-authored formula
  strings into the table runtime's computed-column expression model.
- `tableVariant.ts`: shared Community vs Pro variant typing for the table-definition layer.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- Bound and live-capable modes now expose explicit roles:
  - `seedData` for retained dataset baselines
  - `liveUpdates` for explicit incremental `updates` publications
- Managed connection modes bind those roles automatically:
  - managed HTTP source -> `dataset` to `seedData`
  - managed WS source -> `updates` to `liveUpdates`
- When the table owns a hidden managed connection source, settings show that source's
  current runtime status and error message even though the source widget stays out of the normal
  rail.
- Bound mode reads the shared incremental consumer's patched retained frame when `seedData` and
  `liveUpdates` are bound. Keyed live rows patch only the fields they publish; omitted seed fields
  remain intact, and the seed frame owns columns, fields, and visual metadata.
- `liveMergeKeyMappings` is applied by the table model as final row identity, not only by the
  incremental stream helper. Repeated rows with the same mapped identity collapse into one rendered
  and published row, regardless of whether the frame came from HTTP, WebSocket, Tabular Transform,
  retained runtime state, or manual source adaptation. It controls row identity only; live shape
  normalization and value renaming still belong upstream in Tabular Transform.
- The widget always publishes one `core.tabular_frame@v1` output on `dataset`.
- Optional grouped sections can render by one field key through shared `groupBy` table props. The
  grouped headers are synthetic display rows only; they do not change the published dataset or the
  canonical row objects used by selection outputs.
- Optional interaction outputs publish the current user selection: `selectedRows` as a filtered
  `core.tabular_frame@v1`, plus `activeRow`, `activeCell`, `activeCellValue`, and
  `selectedCellValues` as JSON values. Cell clicks populate `activeCell`, `activeCellValue`, and
  `selectedCellValues` in row and cell selection modes. Row modes publish the active clicked cell
  as a one-item `selectedCellValues` list; in Community AG Grid, `cell` mode currently also
  publishes the clicked cell as a one-item list instead of using enterprise range selection.
  Selection state is stored in widget runtime state so downstream consumers can resolve outputs
  without mutating the underlying dataset.
- When saved `selectionMode` is still `none` but a downstream widget reference actively consumes a
  table interaction output, the runtime infers the minimal interaction mode needed for that
  consumer so clicks can still drive `activeCellValue`, `activeRow`, or `selectedRows` without a
  second manual configuration step. The saved widget props are not rewritten.
- Those outputs are also reachable from shared settings through the exact widget reference syntax,
  for example `$(table-1).activeRow.symbol` for one selected row field or
  `$(table-1).selectedRows.rows[0].symbol` when a downstream setting needs the first selected row.
  `$(table-1).selectedCellValues[0]` resolves the first value from the current cell selection.
- Both canvas rendering and downstream output publication now normalize bound-source state through
  the shared upstream consumer contract before applying table-specific schema or formatting logic.
  That keeps invalid bindings, awaiting upstream publication, loading, empty success, and errors
  separate instead of inferring readiness from `null` frames or `0 rows`.
- The runtime renderer resolves either the dual-role local incremental state or the legacy bound
  dataset path. It does not read dashboard refresh controls directly.
- Legacy backend time-series frames are coerced into canonical tabular rows before table
  formatting is applied.
- If a bound source incorrectly hands the table a connection response envelope, the table unwraps
  the first compatible `frames[]` entry before rendering.
- Manual mode stores `manualColumns` and `manualRows` locally on this widget and publishes them as
  a canonical tabular frame.
- `Bindings -> Add connection` and the dedicated `Connection` tab are owned by the shared managed
  connection consumer adapter layer, not by table-specific settings code.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection
  Query and Tabular Transform.
- Incoming `fields[]` metadata is preserved where possible. When missing, the table infers display
  schema from columns and sampled rows.
- Table and Pro Table do not execute source-declared transform metadata. Shared row transforms
  belong to an upstream `tabular-transform` widget, which materializes derived columns before the
  table consumes the frame. The table consumes `meta.tableVisuals` as the effective source defaults
  for labels, formats, decimal precision, widths, conditional rules, and numeric visuals.
  `buildTableWidgetSourceVisualContractFromFrame(...)` in `tableModel.ts` is the canonical
  constructor for that source-owned visual contract; table-backed domain widgets should reuse it
  instead of rebuilding threshold or visual metadata privately.
- `meta.tableVisuals.columns` can also describe source-declared formula display columns with
  `format: "formula"`, `formulaExpression`, and `formulaResultFormat`. This is used for flat mock
  or source frames that publish raw fields plus a proposed formula column model. Raw input columns
  that formulas need can be kept in the table schema but hidden from the rendered grid with
  `visible: false`.
- `pro-table` adds one shared column-formula authoring path on top of that same runtime contract.
  Formula columns are persisted in shared table props, compiled by `tableFormulaCompiler.ts`, and
  applied by the table runtime as widget-owned computed columns.
- Formula authoring is settings-only in the first implementation. The live widget surface stays
  selection-oriented and does not become a spreadsheet editor.
- Gauge columns render as centered diverging bars in the shared table frame. Positive values fill
  from the middle of the cell toward the right edge; negative values fill from the middle toward
  the left edge.
- The column editor keeps `key`, `label`, `format`, and visibility inline for every row. Less-used
  per-column settings stay under an explicit Advanced toggle to reduce settings noise. Numeric
  threshold rules are edited inside each column's Advanced area instead of in a separate global
  section.
- In settings, source-driven visual defaults remain visible even before any local override is
  saved. The first user edit materializes only the touched local override instead of copying the
  full source metadata into widget props.
- `Date/time` columns parse common ISO strings plus epoch seconds, milliseconds, microseconds, and
  nanoseconds automatically. Advanced column settings may provide a local-time input pattern when
  auto parsing is ambiguous, and an output pattern for display. Supported pattern tokens are
  `yyyy`, `yy`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `SSS`, and `a`.
- Formatting and selection are presentation/runtime concerns and never mutate the published
  `dataset` tabular frame.
- `TableFrameView` is the reusable table presentation layer. Domain-specific widgets should adapt
  their domain model into a resolved table frame and table-native display config, then use this
  view instead of implementing another grid.
- The global quick filter and AG Grid floating column filters are separately configurable. Quick
  filter searches across the rendered row values from the toolbar; column filters expose the
  per-column searchable/filterable header controls.
- While grouped sections are active, AG Grid header sorting is disabled in the shared frame so the
  synthetic section rows stay contiguous with their grouped children.
- `TableFrameView` supports domain-specific presentation flags. The generic Table widget keeps
  the card surface and floating column filters; specialized consumers such as Asset Screener can
  opt into a transparent surface and disable per-column filters while still reusing table
  formatting, conditional rules, and custom cell rendering.
- `table` and `pro-table` intentionally reuse the same table model, source handling, settings
  surface, selection outputs, and canonical dataset publication. The only intended divergence is
  widget identity plus AG Grid module and formula-capability wiring.

## Maintenance Constraints

- Keep the registered ids stable as `table` and `pro-table`.
- Keep `table` backward compatible. Existing saved `table` widgets must keep rendering without a
  forced migration when `pro-table` evolves.
- Keep `pro-table` additive. It is a second widget id on the same shared table core, not a forked
  table implementation.
- Keep column-formula semantics in the shared table layer. Do not add a screener-only or
  widget-specific formula engine when a table-backed widget needs computed display columns.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep the primary published output aligned with `core.tabular_frame@v1`; selection-specific JSON
  outputs must remain derived from runtime interaction state.
- `groupBy` is a frontend presentation prop only. It changes rendered section headers but does not
  change the output dataset contract or backend query semantics.
- Table interaction runtime state now includes one frontend-owned implicit-mode flag so consumer
  driven selection can stay runtime-only even when saved `selectionMode` remains `none`. It also
  stores the ordered `selectedCells` list used to resolve `selectedCellValues` and cell-driven
  row selection. In Community AG Grid, `selectedCells` is currently populated from ordinary clicks
  rather than enterprise range-selection APIs.
- Selection state is local workspace runtime state. Backend registry sync picks up the extra
  output metadata through the existing widget-type manifest, but the canonical tabular dataset
  contract is unchanged and persisted widget props are unchanged.
- Do not reintroduce table-owned date-range or source-resolution runtime behavior; execution and
  refresh belong upstream to Connection Query and Tabular Transform.
- Keep Community and Enterprise wiring isolated to the variant entrypoints and shared AG Grid
  utility helpers. Do not duplicate table logic just to expose Enterprise-backed widgets.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing
  authoring semantics change.
