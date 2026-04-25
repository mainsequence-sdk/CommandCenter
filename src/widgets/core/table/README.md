# Table Widget

This folder owns the core `table` widget. It is a generic consumer for `core.tabular_frame@v1`
and `core.time_series_frame@v1` datasets, plus a display-only manual table editor.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `TableWidget.tsx`: runtime table renderer backed by AG Grid Community.
- `TableWidgetSettings.tsx`: settings editor for source binding status, manual rows, column schema, formatting, value labels, and numeric rules.
- `ManualTableEditor.tsx`: spreadsheet-style editor for manual display rows.
- `tableModel.ts`: table configuration normalization, frame adaptation, schema resolution, formatting helpers, and validation.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- Bound mode consumes one `core.tabular_frame@v1` or `core.time_series_frame@v1` input on `sourceData`.
- Time-series frames are converted through the shared time-series-to-tabular adapter before table
  formatting is applied.
- If a time-series frame arrives as field arrays without complete time-series metadata, the table
  still converts `fields[].values` into rows for inspection instead of treating the source as empty.
- If a bound source incorrectly hands the table a connection response envelope, the table unwraps
  the first compatible `frames[]` entry before rendering.
- Empty placeholder frames with no columns, rows, or fields are not treated as a resolved source
  when the bound source widget has usable runtime frame data.
- Manual mode stores `manualColumns` and `manualRows` locally on this widget and does not publish a dataset.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.
- Incoming `fields[]` metadata is preserved where possible. When missing, the table infers display schema from columns and sampled rows.
- Formatting is presentation-only and never mutates the upstream tabular frame.

## Maintenance Constraints

- Keep the registered id as `table`.
- Keep accepted input aligned with `core.tabular_frame@v1` and `core.time_series_frame@v1`.
- Keep AG Grid usage inside the community feature set unless a future change explicitly documents an enterprise dependency.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
