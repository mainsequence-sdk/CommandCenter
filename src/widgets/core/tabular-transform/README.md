# Tabular Transform Widget

This folder owns the core `tabular-transform` widget. It is the generic workspace transform node
for `core.tabular_frame@v1` datasets.

## Entry Points

- `definition.ts`: widget definition, IO contract, registry metadata, and execution ownership.
- `tabularTransformModel.ts`: props normalization, field inference, transform helpers, and output
  resolution.
- `TabularTransformWidget.tsx`: compact runtime renderer for the transformed dataset preview.
- `TabularTransformWidgetSettings.tsx`: settings UI for transform mode, fields, aggregate mode,
  filter rules, pivot, unpivot, computed columns, projection, and row merge. Mode-specific field
  controls are only shown when the active transform uses them.
- `USAGE_GUIDANCE.md`: user-facing registry guidance imported by the widget definition.

## Behavior

- The widget consumes one `core.tabular_frame@v1` input and republishes transformed
  `dataset` and `updates` outputs. Downstream seed inputs bind to `dataset`; downstream live
  inputs bind to `updates`.
- Instances are fixed to sidebar placement. The transform is an executable graph/source node and
  settings surface, not a visible workspace canvas card.
- Source-input validity and mounted waiting/loading/error semantics now go through the shared
  upstream consumer contract before transform execution or UI rendering. A valid binding with no
  published upstream value is treated as `awaiting-upstream`, not as a malformed dataset.
- When an upstream source publishes incremental metadata, the transform reads the retained
  `upstreamBase` frame for correctness and republishes the transformed publication through the
  explicit `updates` output. Pass-through/projection transforms also publish transformed
  `upstreamDelta` metadata; aggregate, pivot, and unpivot modes fall back to snapshot output because
  partial row deltas cannot preserve correctness there.
- Supported initial transforms are `none`, `filter`, `aggregate`, `pivot`, `unpivot`, final
  projection, and optional latest-row merge by configured output keys.
- The settings UI keeps available source fields visible as reference text, but hides key-field
  editing for modes such as `none` and `filter` where key fields have no effect.
- The runtime panel and settings preview render the actual transformed columns and sample rows,
  rather than only row/column counts, so authors can verify projection and formulas before binding
  downstream widgets.
- Shared computed-column authoring now lives here. The widget stores user-authored formula columns
  in persisted props, compiles them into the shared `meta.tableTransforms.computedColumns`
  contract, materializes them into the published rows, and keeps them visible as an explicit graph
  step instead of a hidden table-only convention.
- Computed columns run after the selected transform mode and before projection, which lets authors
  keep raw builder columns upstream while publishing only derived fields downstream.
- Row merge runs after projection. In passthrough mode, the transform does not add row-merge
  semantics; it publishes whatever the upstream tabular source currently provides after the
  selected transform, computed columns, and projection have run. In latest-row mode, rows sharing
  the configured merge mappings collapse to one retained row and later rows patch previous values.
  The mapping editor is shared with Table live merge because both features operate on tabular row
  identity. This lets a transform turn noisy WebSocket event rows into a stable "latest row per
  symbol" frame before Table, Statistic, Graph, Asset Screener, or another transform consumes it.
- When latest-row merge is enabled and the upstream publishes incremental metadata, the transform
  adds merge-key diagnostics to the republished update envelope so downstream live consumers can
  patch by the same identity.
- Filter mode applies lightweight row predicates such as equality, membership, and numeric/date
  comparisons. It intentionally excludes regex, substring search, computed expressions, and other
  heavier client-side operators.
- Runtime execution is headless and returns a runtime-state patch. The output resolver can also
  derive the current transform from resolved inputs, which keeps downstream graph resolution fresh.
- Field provenance is preserved for unchanged fields and marked as `derived` for transform-created
  fields.

## Maintenance Constraints

- Keep analytical transforms here instead of expanding binding-level transforms.
- Keep the widget sidebar-only. If a future workflow needs a visible transform preview on the
  workspace canvas, add a dedicated visual widget instead of moving this source node onto canvas.
- Keep output shape aligned with `core.tabular_frame@v1`.
- Avoid source-specific terms such as Data Node in this generic widget.
- Keep computed-column authoring aligned with the shared table expression contract. Do not create a
  second formula language in this widget.
- Keep filter semantics generic and cheap. Do not add source-specific predicates, regex, or other
  heavy client-side matching operators without a new decision.
- Keep row merge generic. It is data shaping by explicit output keys, not source-specific market
  semantics. Table-level live merge remains a consumer safety behavior and must not be removed.
- Bump `widgetVersion` when props, output shape, execution behavior, or authoring semantics change.
