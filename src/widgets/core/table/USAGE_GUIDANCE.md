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
- Use `Live merge mapping` when incoming rows should update existing rows instead of adding a new
  row each time. Add one mapping for a single identity such as seed field `symbol` and live field
  `symbol`; add multiple mappings for composite identity such as `symbol` plus `exchange`. The
  table applies this identity to the final rendered and published frame, so repeated WebSocket rows
  with the same key collapse to the latest row even when the source is already a plain table frame.
- Put live-field renaming or calculations in a Tabular Transform before the table. For example,
  transform WebSocket fields `symbol, close` into `symbol, last`, then map seed `symbol` to live
  `symbol` in the table.
- For connection mode, open `Bindings`, click `Add connection`, then configure the dedicated `Connection` tab. Managed HTTP sources bind `dataset` to `seedData`; managed WS sources bind `updates` to `liveUpdates`.
- For manual mode, define columns and rows in the table editor. Manual rows are stored in this table widget's props and are published as the table `dataset` output.
- Inspect the incoming field schema before editing columns. Prefer upstream `fields` metadata when available; otherwise the table infers labels, types, and numeric eligibility from the current row sample.
- The table does not execute source-declared transform metadata. If shared derived columns are
  needed, create them in an upstream `tabular-transform` widget so they arrive as ordinary
  materialized frame columns. The table uses `meta.tableVisuals` as source defaults for labels,
  formats, decimal precision, widths, thresholds, and numeric visuals. Editing a setting creates
  only a local override for the touched field.
- Local column order wins once a schema is saved. Source field metadata still fills matching
  column defaults, and source columns that are new to the saved schema are appended after the local
  order.
- Put source-owned display defaults on the incoming `core.tabular_frame@v1` value under
  `meta.tableVisuals.columns`. Each key must match a field in `columns`, a row property, or a
  formula display column key. The supported source metadata fields are `label`, `format`,
  `decimals`, `visible`, `width`, `thresholds`, `colorScale`, `range`, `heatmap`, `barMode`,
  `gradientMode`, `heatmapPalette`, `gaugeMode`, `visualRangeMode`, `visualMin`, `visualMax`,
  `kind`, `encoding`, `order`, `formulaExpression`, and `formulaResultFormat`.
- Example source formatting metadata:

  ```json
  {
    "status": "ready",
    "columns": ["symbol", "last_price", "previous_close", "pnl"],
    "rows": [
      {
        "symbol": "BTC",
        "last_price": 109420.12,
        "previous_close": 107980,
        "pnl": -1250
      }
    ],
    "meta": {
      "tableVisuals": {
        "columns": {
          "symbol": {
            "label": "Symbol",
            "width": 120
          },
          "last_price": {
            "label": "Last",
            "format": "price",
            "decimals": 2,
            "width": 120
          },
          "previous_close": {
            "label": "Previous close",
            "format": "price",
            "visible": false
          },
          "one_day_return": {
            "label": "1D",
            "format": "formula",
            "formulaExpression": "PERCENT_CHANGE([last_price], [previous_close])",
            "formulaResultFormat": "percent",
            "gaugeMode": "ring"
          },
          "pnl": {
            "label": "PnL",
            "format": "currency",
            "decimals": 0,
            "barMode": "fill",
            "visualRangeMode": "fixed",
            "visualMin": -5000,
            "visualMax": 5000,
            "thresholds": [
              { "operator": "lt", "value": 0, "tone": "danger" },
              { "operator": "gt", "value": 0, "tone": "success" }
            ]
          }
        }
      }
    }
  }
  ```

- Source metadata `format` accepts `number`, `price`, `percent`, `volume`, `currency`, or
  `formula`. `price` and `volume` are accepted source aliases and render through the table's numeric
  formatting path; `volume` also requests compact numeric display.
- Source frames can propose formula display columns through `meta.tableVisuals.columns` by setting
  `format: "formula"`, `formulaExpression`, and `formulaResultFormat`. Include any raw input fields
  the expression references in the frame and set `visible: false` on those input columns when they
  should remain available for formulas but hidden from the rendered table.
- Create a formula column in `pro-table` settings by enabling `Formula columns`, clicking
  `Add formula column`, setting the column key and label, choosing `Formula` as the format, then
  authoring `Formula expression` in the column's `Advanced` panel.
- Create a formula column from source metadata by adding a new key under
  `meta.tableVisuals.columns` with `format: "formula"`, `formulaExpression`, and
  `formulaResultFormat`. The formula key can be a display-only key that does not exist in each
  source row; the table computes it from referenced row fields.
- Formula expressions must wrap field names in brackets. Supported operators are `+`, `-`, `*`,
  `/`, parentheses, numeric literals, and bracketed fields such as `[last_price]` or
  `[Last Price]`. Supported functions are `PERCENT_CHANGE(current, reference)`,
  `DIFFERENCE(left, right)`, `SUBTRACT(left, right)`, `RATIO(numerator, denominator)`,
  `DIVIDE(numerator, denominator)`, `ADD(...)`, and `MULTIPLY(...)`.
- Formula result formats are `text`, `datetime`, `number`, `currency`, `percent`, or `bps`.
  Numeric formula columns can also use the same visual metadata as other numeric columns, including
  thresholds, data bars, heatmaps, gauges, and fixed visual ranges.
- Gauge visuals use a centered diverging fill. Positive values extend from the middle of the cell
  toward the right edge; negative values extend from the middle toward the left edge.
- Configure table-level presentation first. In the per-column editor, the default row keeps only key, label, format, and visibility inline; expand `Advanced` when a column needs descriptions, pinning, Date/time input or output patterns, numeric visuals, or display overrides.
- Community `table` keeps formulas off. If a workspace needs shared column formulas, use
  `pro-table` instead of trying to turn the Community widget into a spreadsheet surface.
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
  Live updates may publish only row identity plus changed fields when a merge key is available.

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
  patched `upstreamBase` frame and renders it as a snapshot. Partial live rows do not need to
  repeat unchanged seed columns.
- Manual mode requires at least one manual column before the table can render a schema.
- The incoming frame must normalize to table rows. Canonical frames provide `columns: string[]` and `rows: Array<Record<string, unknown>>`.
- Legacy backend time-series frames are coerced to canonical tabular rows before rendering.
- Connection response envelopes with `frames[]` are unwrapped to the first compatible publishable frame before rendering.
- Column `key` values must match fields present in the incoming frame.
- Numeric visuals require numeric source values and usable bounds.
- Formula columns require the formula-capable table path. Use `pro-table` or another Enterprise
  table-backed widget with formulas enabled; Community `table` does not evaluate formula columns.
- Date/time formatting requires values that can be parsed automatically or by the configured input pattern.
- Stable selection key fields should point at fields that are present in the canonical dataset. Without them, selection outputs fall back to row indexes.
- Composed seed/live tables need either source-owned merge key metadata or a `Live merge mapping`.
  Without row identity, live rows are treated as append-only events rather than patches.

### commonPitfalls

- Bound mode stays empty until it is bound to a compatible source in the workspace bindings.
- Connection modes still depend on the hidden managed source publishing a canonical dataset. Fix
  source runtime failures in the `Connection` tab before debugging table schema or formatting.
- If this table is backed by an embedded hidden connection source, fix any source runtime error in
  the settings status card before debugging schema or formatting rules.
- Formatting is presentation-only. Hiding a column, applying a prefix, or adding a heatmap does not modify the published table `dataset` output.
- `meta.tableVisuals` is source-owned defaults, not a full replacement for widget settings. Prefix,
  suffix, alignment, pinning, and Date/time input/output patterns are local widget settings unless
  the table source metadata contract is extended.
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
- Use when the widget should author shared column formulas in settings and render the computed
  result like an ordinary table column.
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
- Source-owned display defaults use the same `meta.tableVisuals.columns` block as `table`. Put
  source labels, `format`, `decimals`, `visible`, `width`, thresholds, heatmap/data-bar/ring-gauge
  controls, and formula display-column metadata there when the upstream frame should propose the
  initial table presentation. Local widget edits still override those source defaults field by
  field.
- `Formulas` is enabled by default on `pro-table`. Mark a column as `Formula`, then author one
  expression in that column's `Advanced` section.
- Wrap field names in brackets. Use arithmetic such as `([last_price] - [open]) / [open] * 100`
  or functions such as `PERCENT_CHANGE([last_price], [yearStart])`.
- If a field name contains spaces or punctuation, use the same bracket syntax, for example
  `[Last Price]` or `[1D Return %]`.
- Source frames can create formula display columns without saving local widget schema by declaring
  them under `meta.tableVisuals.columns`. Use a stable formula key, set `format: "formula"`,
  provide `formulaExpression`, and set `formulaResultFormat` to the intended renderer format.
- Formula definitions come from Pro Table settings or source metadata. The live grid remains
  read-only and keeps its current row/cell interaction meaning; users do not edit formulas inline
  inside table cells.
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
- `meta.tableVisuals` formatting is presentation metadata. It does not mutate the published
  `dataset` rows and does not replace upstream transforms.
- Formula columns are persisted shared table settings, not transient AG Grid state. If a formula
  column should move with a dataset, keep the formula column key stable in the widget settings.
- If you need backward compatibility for an existing workspace, leave saved `table` instances on
  `table`. `pro-table` is additive.
- Enterprise module support does not change the upstream source contract, row payload shape, or the
  canonical published dataset.
