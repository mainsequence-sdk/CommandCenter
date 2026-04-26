# Tabular Transform Widget

This folder owns the core `tabular-transform` widget. It is the generic workspace transform node
for `core.tabular_frame@v1` datasets.

## Entry Points

- `definition.ts`: widget definition, IO contract, registry metadata, and execution ownership.
- `tabularTransformModel.ts`: props normalization, field inference, transform helpers, and output
  resolution.
- `TabularTransformWidget.tsx`: compact runtime renderer for transformed dataset status.
- `TabularTransformWidgetSettings.tsx`: settings UI for transform mode, fields, aggregate mode,
  pivot, unpivot, and projection.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget consumes one `core.tabular_frame@v1` input and republishes one
  `core.tabular_frame@v1` output.
- When an upstream source publishes incremental metadata, the transform reads the retained
  `upstreamBase` frame for correctness. Pass-through/projection transforms also publish transformed
  `upstreamDelta` metadata; aggregate, pivot, and unpivot modes fall back to snapshot output because
  partial row deltas cannot preserve correctness there.
- Supported initial transforms are `none`, `aggregate`, `pivot`, `unpivot`, and final projection.
- Runtime execution is headless and returns a runtime-state patch. The output resolver can also
  derive the current transform from resolved inputs, which keeps downstream graph resolution fresh.
- Field provenance is preserved for unchanged fields and marked as `derived` for transform-created
  fields.

## Maintenance Constraints

- Keep analytical transforms here instead of expanding binding-level transforms.
- Keep output shape aligned with `core.tabular_frame@v1`.
- Avoid source-specific terms such as Data Node in this generic widget.
- Bump `widgetVersion` when props, output shape, execution behavior, or authoring semantics change.
