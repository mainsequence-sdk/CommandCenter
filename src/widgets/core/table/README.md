# Table Widget

This folder owns the core `table` widget. It is a generic consumer for `core.tabular_frame@v1`
datasets, plus a manual table editor that also republishes one canonical tabular frame.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `TableWidget.tsx`: runtime table renderer backed by AG Grid Community.
- `TableWidgetSettings.tsx`: settings editor for source binding status, manual rows, compact per-column schema controls, collapsible advanced formatting, value labels, and numeric rules.
- `ManualTableEditor.tsx`: spreadsheet-style editor for manual display rows.
- `tableModel.ts`: table configuration normalization, frame adaptation, schema resolution, formatting helpers, and validation.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- Bound mode consumes one `core.tabular_frame@v1` input on `sourceData`.
- The widget always publishes one `core.tabular_frame@v1` output on `dataset`.
- The runtime renderer reads the resolved `sourceData` input only. It does not read dashboard
  refresh controls or source widget runtime state directly.
- Legacy backend time-series frames are coerced into canonical tabular rows before table
  formatting is applied.
- If a bound source incorrectly hands the table a connection response envelope, the table unwraps
  the first compatible `frames[]` entry before rendering.
- Manual mode stores `manualColumns` and `manualRows` locally on this widget and publishes them as
  a canonical tabular frame.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection
  Query and Tabular Transform.
- Incoming `fields[]` metadata is preserved where possible. When missing, the table infers display
  schema from columns and sampled rows.
- The column editor keeps `key`, `label`, `format`, and visibility inline for every row. Less-used
  per-column settings stay under an explicit Advanced toggle to reduce settings noise.
- Formatting is presentation-only and never mutates the published tabular frame.

## Maintenance Constraints

- Keep the registered id as `table`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep the published output aligned with `core.tabular_frame@v1`.
- Do not reintroduce table-owned date-range or source-resolution runtime behavior; execution and
  refresh belong upstream to Connection Query and Tabular Transform.
- Keep AG Grid usage inside the community feature set unless a future change explicitly documents
  an enterprise dependency.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing
  authoring semantics change.
