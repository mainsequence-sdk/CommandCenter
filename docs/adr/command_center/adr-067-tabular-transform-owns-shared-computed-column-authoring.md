# ADR 067: Tabular Transform Owns Shared Computed Column Authoring

- Status: Accepted
- Date: 2026-05-20
- Related:
  - [ADR 042: Lightweight Row Filtering in Tabular Transform](./adr-042-tabular-transform-row-filtering.md)
  - [ADR 065: Shared Table Core With Community And Pro Table Widgets](./adr-065-shared-table-core-with-community-and-pro-table-widgets.md)
  - [ADR 066: Pro Table Formula Enablement And Asset Screener Pro Inheritance](./adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization.md)

## Context

The codebase previously supported shared source-level computed columns through
`meta.tableTransforms.computedColumns`.

Today that contract is:

- parsed in the shared table/frame metadata layer
- applied before generic table presentation
- also consumed in the market semantic adaptation path

But it is not exposed as a first-class client authoring surface.

What the user can author today is inconsistent:

- `table` / `pro-table` expose widget-local formula columns in settings
- `tabular-transform` exposes filter, aggregate, pivot, unpivot, and projection
- no widget exposes source-level shared computed-column authoring for
  `meta.tableTransforms`

That leaves a bad ownership boundary:

- shared transforms exist
- the runtime consumes them
- but the client cannot author them through an explicit transform widget
- examples and mock payloads can therefore depend on a hidden metadata contract

This is the wrong UX and the wrong ownership model.

Shared source-side row transforms should be explicit graph behavior, not hidden table authoring.

## Decision

### 1. Shared Computed Columns Move Under `tabular-transform`

The `tabular-transform` widget becomes the explicit authoring surface for shared row-local computed
columns.

That means:

- computed columns that should travel with a transformed dataset belong to `tabular-transform`
- they are configured in the transform widget settings
- they are published as part of the transform widget output contract
- they are no longer treated as a hidden table-only authoring path

### 2. Table Widgets Stop Owning Shared Transform Authoring

The generic `table`, `pro-table`, and table-backed widgets such as Asset Screener should not be the
place where shared source-level computed columns are authored.

Those widgets may still:

- render already-transformed columns from upstream data
- expose widget-local display formulas where that is explicitly the chosen contract

But they should not be the primary owner for shared source-level transform authoring.

### 3. `meta.tableTransforms` Becomes Transform-Widget-Only Metadata

The shared computed-column contract remains transform-owned metadata. Its explicit client
authoring owner is `tabular-transform`.

The intended direction is:

- `tabular-transform` settings author computed-column definitions
- the transform widget applies them as part of its execution/runtime output
- downstream Table, Pro Table, Asset Screener, and other tabular consumers receive materialized
  derived columns as normal frame columns
- Table, Pro Table, and Asset Screener must not apply incoming source `meta.tableTransforms`

This keeps analytical transforms visible in the graph instead of hiding them inside arbitrary
source payload metadata.

### 4. Asset Screener Should Consume Explicit Upstream Transform Output

Asset Screener should receive shared derived market columns from an explicit upstream transform
widget when those columns are intended to be part of the reusable dataset contract.

Examples:

- `1D`, `1M`, `YTD`, `1Y`
- spreads
- ratios
- normalized fields

Asset Screener can still use local Pro-table formulas for widget-only display needs, but source-like
derived market metrics should be authored upstream in the visible transform node.

### 5. Backward Compatibility Must Be Preserved During Migration

Existing incoming frames that still contain `meta.tableTransforms` should not break rendering, but
tabular consumers should ignore the metadata rather than compute hidden columns from it.

However, the authoring direction should change:

- backward compatibility means safe no-op handling, not hidden computation
- new client authoring should move to `tabular-transform`
- documentation and examples should stop treating hidden `meta.tableTransforms` payload authoring
  as the normal user path

## Implementation Tasks

### Tabular Transform Authoring

- [x] Extend `tabular-transform` settings to author shared computed columns.
- [x] Add a computed-column list editor to `TabularTransformWidgetSettings`.
- [x] Support the shared expression operators already used by the table metadata contract.
- [x] Let users define computed column id, label, type, and expression in the transform widget UI.
- [x] Show available upstream fields while authoring computed-column expressions.
- [x] Keep computed-column authoring explicit and visible in the graph.

### Transform Output Contract

- [x] Update `tabular-transform` output resolution so computed columns are applied by the transform
  widget itself.
- [x] Decide whether the transform output should publish materialized rows only, retained
  `meta.tableTransforms`, or both; document the chosen contract clearly.
  Chosen contract: `tabular-transform` may retain `meta.tableTransforms.computedColumns` as
  transform-owned provenance, but downstream table-like consumers use the materialized rows and
  fields, not the metadata, for rendering.
- [x] Keep output shape aligned with `core.tabular_frame@v1`.
- [x] Preserve field provenance for transform-created columns as derived fields.

### Table Ownership Cleanup

- [x] Remove generic table documentation that implies `meta.tableTransforms` is a normal hidden
  user authoring path.
- [x] Reframe `table` / `pro-table` formulas as widget-local presentation formulas only.
- [x] Keep table widgets able to render upstream derived columns without becoming the authoring
  owner for shared transforms.

### Asset Screener Alignment

- [x] Update Asset Screener guidance and examples so shared derived market columns are authored via
  `tabular-transform` when they should behave like reusable dataset columns.
- [x] Keep local Pro-table formula columns available for screener-only presentation needs.
- [x] Remove mock/example guidance that treats hidden raw `meta.tableTransforms` payload authoring
  as the preferred client flow.

### Migration And Compatibility

- [x] Audit existing examples, mocks, and docs that depend on hidden `meta.tableTransforms`
  payloads.
- [x] Preserve runtime backward compatibility for already-published frames by ignoring
  `meta.tableTransforms` safely in table-like consumers.
- [ ] Add regression coverage for transform-authored computed columns flowing into downstream
  `table`, `pro-table`, and Asset Screener consumers.

## Plan Notes

The intended user flow after this ADR is:

1. bind a raw tabular dataset into `tabular-transform`
2. define computed columns there
3. publish the transformed frame downstream
4. use `table`, `pro-table`, or Asset Screener as presentation/interaction consumers

That keeps shared dataset transforms explicit and inspectable in the workspace graph.

## Contract Notes

This ADR is likely to affect frontend-visible transform authoring semantics and may affect the
shape or metadata semantics of transformed published frames.

Backend review is required if:

- transformed frame metadata semantics change
- persisted `tabular-transform` widget props expand in a backend-visible way
- downstream systems rely on the exact presence or absence of `meta.tableTransforms`
