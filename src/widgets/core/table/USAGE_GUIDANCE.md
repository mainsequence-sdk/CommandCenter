## table

### buildPurpose

Formatted table for a bound `core.tabular_frame@v1` dataset, a widget-owned hidden connection source, or manually authored rows, with one canonical dataset output and optional row/cell selection outputs for downstream composition.

### whenToUse

- Use when a workspace needs row-level inspection, sorting, filtering, search, pagination, pinned columns, or compact table density.
- Use `Group by` when the same dataset should render dense section headers for one field such as
  `sector`, `desk`, or `exchange`.
- Use when a tabular frame needs display configuration: header labels, descriptions, visibility, alignment, pinning, datetime rendering, numeric precision, prefix, suffix, compact-number notation, heatmaps, data bars, gauges, threshold rules, or value-label chips.
- Use the managed connection flow when this table should own its own hidden `connection-query` or
  `connection-stream-query` source instead of sharing a visible upstream source widget.
- Use manual mode only for display-only rows that should not become a reusable dataset source.
- Use it as a lightweight tabular source when a downstream widget should consume the table's canonical underlying rows.
- Enable selection outputs when downstream widgets should react to selected row(s), the active row, a clicked cell value, or the ordered list of selected cell values.

### whenNotToUse

- Do not use when the widget must own data loading, filtering, aggregation, pivoting, or reshaping; use Connection Query and Tabular Transform upstream.
- Do not use for charting or KPI reduction when Graph or Statistic better matches the task.
- Do not expect hidden columns, renamed labels, or formatting rules to change the published dataset. Those are presentation-only.

### authoringSteps

- Choose `Bound dataset` when the table should render an upstream `core.tabular_frame@v1` output, `Connection query` when the table should own a hidden `connection-query` source, `Stream connection` when it should own a hidden `connection-stream-query` source, or `Manual table` when rows should be authored directly in this widget.
- For bound mode, bind `seedData` to a retained `dataset` output or an incremental `updates` seed publication.
- Bind `liveUpdates` only to explicit `updates` outputs when this table should keep applying incremental publications.
- For connection mode, open `Bindings`, click `Add connection`, then configure the dedicated `Connection` tab. Managed HTTP sources bind `dataset` to `seedData`; managed WS sources bind `updates` to `liveUpdates`.
- For manual mode, define columns and rows in the table editor. Manual rows are stored in this table widget's props and are published as the table `dataset` output.
- Inspect the incoming field schema before editing columns. Prefer upstream `fields` metadata when available; otherwise the table infers labels, types, and numeric eligibility from the current row sample.
- When a source publishes `meta.tableTransforms` or `meta.tableVisuals`, the table uses those as
  the effective source defaults for computed columns, labels, formats, decimal precision, widths,
  thresholds, and numeric visuals. Editing a setting creates only a local override for the touched
  field.
- Gauge visuals use a centered diverging fill. Positive values extend from the middle of the cell
  toward the right edge; negative values extend from the middle toward the left edge.
- Configure table-level presentation first. In the per-column editor, the default row keeps only key, label, format, and visibility inline; expand `Advanced` when a column needs descriptions, pinning, Date/time input or output patterns, numeric visuals, or display overrides.
- Use `Group by` for display-only grouped sections. The grouped headers are synthetic render rows;
  they do not change the published `dataset` output or the row payloads used by selection
  outputs.
- Add threshold rules from each numeric column's `Advanced` panel. Rules are evaluated top to
  bottom for that column, and the first matching rule wins.
- Use `Quick filter` when users need one global search box across rendered rows. Turn it off for denser table embeds.
- Use `Column filters` when users need searchable per-column filter controls in the table header.
- Use the `Date/time` column format for epoch timestamps or date strings that should be rendered as readable dates. Auto parsing handles ISO-like strings plus epoch seconds, milliseconds, microseconds, and nanoseconds. Set `Input format` only when auto parsing is ambiguous; set `Output format` to control the rendered text.
- Date/time pattern tokens include `yyyy`, `yy`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `hh`, `h`, `mm`, `m`, `ss`, `s`, `SSS`, and `a`. Example: input `dd/MM/yyyy HH:mm:ss` and output `yyyy-MM-dd HH:mm:ss`.
- Bind downstream widgets to the table `dataset` output when they should consume the same canonical tabular frame.
- To compose dashboards from table interaction, enable `Selection outputs`, choose single-row,
  multi-row, or cell mode, and bind downstream widgets to `selectedRows`, `activeRow`,
  `activeCell`, `activeCellValue`, or `selectedCellValues`.
- Shared widget settings can also reference those outputs directly with exact expressions such as
  `$(table-1).activeRow.symbol`, `$(table-1).activeCellValue`,
  `$(table-1).selectedCellValues[0]`, or
  `$(table-1).selectedRows.rows[0].symbol` when a downstream setting should compile to a canonical
  binding instead of using the picker UI.
- Configure `Stable row key fields` with durable source fields such as `id`, `symbol`, or another
  unique identifier when selections must survive refreshes, sorting, or incoming row updates.

### inputPorts

- `seedData`: optional `core.tabular_frame@v1` input. Initializes or replaces the table frame.
- `liveUpdates`: optional `core.tabular_frame@v1` updates input. Applies explicit incremental row publications when bound.

### outputPorts

- `dataset`: `core.tabular_frame@v1`. Publishes the current canonical table dataset before display-only formatting, hiding, or selection.
- `selectedRows`: `core.tabular_frame@v1`. Publishes the current canonical table frame filtered to the selected row(s). Returns an empty ready frame when selection is enabled but no rows are selected.
- `activeRow`: `core.value.json@v1`. Publishes the active row object, or `null` when no row is active.
- `activeCell`: `core.value.json@v1`. Publishes `{ rowKey, rowIndex, columnKey, value, row }` for the clicked cell, or `null`.
- `activeCellValue`: `core.value.json@v1`. Publishes only the active cell value, or `null`.
- `selectedCellValues`: `core.value.json@v1`. Publishes an ordered list of selected cell values. Row selection clicks return the active clicked cell as a one-item array; in Community AG Grid, `cell` mode currently also returns the clicked cell as a one-item array.

### runtimeOwnership

- The table is a consumer. Source loading belongs to upstream Connection Query, Connection Stream Query, or Tabular Transform widgets.
- Selection outputs are local UI runtime state. They do not change source rows, saved manual rows, or the primary `dataset` output.
- `selectedCellValues` and the cell-driven `selectedRows` fallback are derived from frontend-managed selection runtime state. They do not mutate source data or saved widget props.

### blockingRequirements

- Bound mode requires a compatible upstream `core.tabular_frame@v1` binding.
- Connection and stream connection modes require a valid backend-owned connection instance selected
  in the managed hidden source widget. Stream connection mode also requires a streamable connection
  path.
- When the upstream source publishes incremental metadata, the table consumes the retained
  full `upstreamBase` frame and renders it as a snapshot.
- Manual mode requires at least one manual column before the table can render a schema.
- The incoming frame must normalize to table rows. Canonical frames provide `columns: string[]` and `rows: Array<Record<string, unknown>>`.
- Legacy backend time-series frames are coerced to canonical tabular rows before rendering.
- Connection response envelopes with `frames[]` are unwrapped to the first compatible publishable frame before rendering.
- Column `key` values must match fields present in the incoming frame.
- Numeric visuals require numeric source values and usable bounds.
- Date/time formatting requires values that can be parsed automatically or by the configured input pattern.
- Stable selection key fields should point at fields that are present in the canonical dataset. Without them, selection outputs fall back to row indexes.

### commonPitfalls

- Bound mode stays empty until it is bound to a compatible source in the workspace bindings.
- Connection modes still depend on the hidden managed source publishing a canonical dataset. Fix
  source runtime failures in the `Connection` tab before debugging table schema or formatting.
- If this table is backed by an embedded hidden connection source, fix any source runtime error in
  the settings status card before debugging schema or formatting rules.
- Formatting is presentation-only. Hiding a column, applying a prefix, or adding a heatmap does not modify the published table `dataset` output.
- Changing the upstream transform can change the output columns. Reset columns from the current frame when the saved column schema no longer matches the incoming row shape.
- Prefix and suffix are literal display text. Do not use them to convert units or change numeric scale upstream.
- Date/time formatting is presentation-only. It does not convert the published `dataset` output values for downstream widgets.
- Row-index selection fallback can point at a different row after an upstream resort, filter, or refresh. Use stable row key fields for production compositions.
- Grouped sections are a shared table presentation feature. While grouping is active, AG Grid
  header sorting is disabled so the grouped blocks stay contiguous in first-seen group order.
- Cell clicks publish `activeCell`, `activeCellValue`, and a one-item `selectedCellValues` list in row and cell selection modes. Row modes also publish `selectedRows` and `activeRow`. `none` disables manual selection outputs by default, but the runtime may infer the minimal interaction mode when a downstream widget reference actively consumes one of the table interaction outputs. Community AG Grid does not currently provide enterprise cell-range selection here.

## pro-table

### buildPurpose

Enterprise-backed version of the shared Table widget. It preserves the same canonical tabular
dataset contract, source modes, field formatting model, and selection outputs as `table`, but runs
through AG Grid Enterprise modules so Pro-only grid capabilities can be introduced without
breaking the existing Community widget.

### whenToUse

- Use when a workspace should opt into the Enterprise-backed table path while keeping the same
  canonical `core.tabular_frame@v1` input and output behavior as `table`.
- Use when you want the same bound dataset, hidden connection source, stream source, or manual row
  workflow as `table`, but want the widget identity reserved for Enterprise-only capabilities.
- Use when downstream widgets should keep consuming `dataset`, `selectedRows`, `activeRow`,
  `activeCell`, `activeCellValue`, or `selectedCellValues` with the same semantics as `table`.

### whenNotToUse

- Do not migrate existing `table` widgets to `pro-table` unless you specifically want the
  Enterprise-backed widget identity.
- Do not use `pro-table` as a different data contract. It publishes the same canonical dataset and
  interaction outputs as `table`.
- Do not expect Enterprise module support to change upstream query ownership, transform behavior,
  or persisted source bindings. Those stay shared with `table`.

### authoringSteps

- Author `pro-table` exactly like `table`: choose `Bound dataset`, `Connection query`, `Stream connection`,
  or `Manual table`.
- Bind `seedData` and `liveUpdates` using the same upstream contracts and output ids used by
  `table`.
- Configure labels, formats, grouping, search, filters, pagination, and selection outputs through
  the same shared settings surface.
- Treat `pro-table` as additive. Existing `table` widgets stay valid and do not require migration.

### inputPorts

- `seedData`: optional `core.tabular_frame@v1` input. Initializes or replaces the table frame.
- `liveUpdates`: optional `core.tabular_frame@v1` updates input. Applies explicit incremental row publications when bound.

### outputPorts

- `dataset`: `core.tabular_frame@v1`. Publishes the current canonical table dataset before display-only formatting, hiding, or selection.
- `selectedRows`: `core.tabular_frame@v1`. Publishes the current canonical table frame filtered to the selected row(s). Returns an empty ready frame when selection is enabled but no rows are selected.
- `activeRow`: `core.value.json@v1`. Publishes the active row object, or `null` when no row is active.
- `activeCell`: `core.value.json@v1`. Publishes `{ rowKey, rowIndex, columnKey, value, row }` for the clicked cell, or `null`.
- `activeCellValue`: `core.value.json@v1`. Publishes only the active cell value, or `null`.
- `selectedCellValues`: `core.value.json@v1`. Publishes an ordered list of selected cell values using the same runtime semantics as `table`.

### runtimeOwnership

- `pro-table` is still a consumer. Source loading belongs to upstream Connection Query, Connection Stream Query, or Tabular Transform widgets.
- Selection outputs remain local UI runtime state and do not mutate source rows, saved manual rows, or the primary `dataset` output.
- Enterprise module support changes grid capabilities, not the canonical dataset contract.

### blockingRequirements

- `pro-table` has the same binding and source-shape requirements as `table`.
- The runtime still expects canonical tabular frames and the same stable key guidance used by
  `table`.
- Enterprise module support requires the AG Grid Enterprise package in the frontend build. A
  license key is optional for development but required to remove the standard enterprise watermark
  and warnings in licensed environments.

### commonPitfalls

- `pro-table` is not a forked table implementation. It shares the same core settings and output
  semantics as `table`.
- If you need backward compatibility for an existing workspace, leave saved `table` instances on
  `table`. `pro-table` is additive.
- Enterprise module support does not change the upstream source contract, row payload shape, or the
  canonical published dataset.
