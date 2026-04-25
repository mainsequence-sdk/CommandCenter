# Table Widget

This folder owns the core `table` widget. It is a generic consumer for `core.tabular_frame@v1`
datasets and a display-only manual table editor.

## Entry Points

- `definition.ts`: core widget definition, IO metadata, registry contract, agent snapshot, and settings/component wiring.
- `TableWidget.tsx`: runtime table renderer backed by AG Grid Community.
- `TableWidgetSettings.tsx`: settings editor for source binding status, manual rows, column schema, formatting, value labels, and numeric rules.
- `ManualTableEditor.tsx`: spreadsheet-style editor for manual display rows.
- `tableModel.ts`: table configuration normalization, frame adaptation, schema resolution, formatting helpers, and validation.
- `USAGE_GUIDANCE.md`: registry-synced authoring guidance.

## Behavior

- Bound mode consumes one `core.tabular_frame@v1` input on `sourceData`.
- Manual mode stores `manualColumns` and `manualRows` locally on this widget and does not publish a dataset.
- The widget is a passive `consumer`; source queries and transforms belong upstream to Connection Query and Tabular Transform.
- Incoming `fields[]` metadata is preserved where possible. When missing, the table infers display schema from columns and sampled rows.
- Formatting is presentation-only and never mutates the upstream tabular frame.

## Maintenance Constraints

- Keep the registered id as `table`.
- Keep accepted input aligned with `core.tabular_frame@v1`.
- Keep AG Grid usage inside the community feature set unless a future change explicitly documents an enterprise dependency.
- Bump `widgetVersion` when props, accepted input behavior, registry metadata, or user-facing authoring semantics change.
