# ADR 065: Shared Table Core With Community And Pro Table Widgets

- Status: Accepted
- Date: 2026-05-20
- Related:
  - [ADR 066: Shared Table Formula Contract And Asset Screener Metric De-specialization](./adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization.md)
  - [ADR 062: Typed Widget Module Pattern](./adr-062-typed-widget-module-pattern.md)

## Context

The current `table` widget is built on one shared AG Grid-backed stack:

- widget definition
- source and runtime resolution
- selection outputs
- computed-column handling
- table settings
- presentation via `TableFrameView`

That shared stack is correct and should be preserved.

What needs to change is product packaging, not logic ownership.

We want two table widgets:

1. `table`
   Community edition, based on AG Grid Community.
2. `pro-table`
   Enterprise edition, based on AG Grid Enterprise.

The important constraint is that these must not become two separate implementations. The runtime
logic, data contracts, selection behavior, computed-column semantics, and most of the settings
surface should remain identical.

The difference between the two widgets should be edition capabilities, not duplicated logic.

## Decision

### 1. Keep One Shared Table Core

The canonical table implementation remains one shared table core.

That shared core should own:

- canonical `core.tabular_frame@v1` input and output semantics
- dataset normalization
- selection runtime state and published interaction outputs
- shared computed-column and formula contract
- shared source metadata interpretation
- shared formatting, visual rules, and table settings model
- reusable table presentation components

Both `table` and `pro-table` must consume that same shared core.

### 2. Split Widget Identity, Not Table Semantics

The existing `table` widget remains the Community widget and keeps its current widget id.

A new `pro-table` widget is introduced for Enterprise-only capabilities.

The two widgets must differ only in:

- widget id and catalog identity
- AG Grid module registration
- Enterprise-only feature exposure
- edition-specific settings and toolbar affordances

They must not fork:

- row semantics
- output contracts
- formula semantics
- source binding behavior
- runtime refresh behavior
- selection semantics
- per-column visual semantics

### 3. Enterprise Features Stay Capability-Gated

Enterprise-only functionality belongs behind explicit capability gates in the shared table layer.

That means the shared components should accept edition or capability flags rather than branch into
two separate render stacks.

Typical examples include:

- enterprise grouping controls
- advanced range selection features
- Excel-oriented authoring features
- formula editor integration
- any future AG Grid Enterprise-only panels or menus

The Community widget must continue to function without importing or requiring Enterprise modules.

### 4. ADR 066 Remains The Owner Of Formula Semantics

AG Grid Enterprise may improve editing and authoring for table formulas, but it must not become
the canonical owner of formula semantics.

The canonical formula and computed-column contract remains shared, serializable, and grid-agnostic
per ADR 066.

If Enterprise features are used for authoring or runtime acceleration, they must adapt to the
shared table contract rather than replace it.

## Backward Compatibility Requirements

- The existing `table` widget id must remain unchanged.
- Existing saved `table` widgets must continue to render without a migration step just because
  `pro-table` is introduced.
- Persisted `table` props, canonical `dataset` output semantics, selection outputs, and selection
  runtime-state shape must remain backward compatible unless a separate migration ADR explicitly
  changes them.
- `pro-table` must be additive. It must not become the new owner of shared table semantics.
- Table-derived widgets such as Asset Screener must continue to reuse the shared table core
  without being forced to migrate to `pro-table`.

## Implementation Tasks

- [x] Create a shared table-core structure under the existing table feature area so both widgets
  use the same model, frame resolution, settings logic, and presentation components.
- [x] Keep `src/widgets/core/table` as the owner of the shared implementation instead of cloning it
  into a second widget folder.
- [x] Introduce a new `pro-table` widget definition that reuses the shared table core and only
  changes edition capabilities and widget identity.
- [x] Keep the existing `table` widget id unchanged and explicitly scoped to AG Grid Community.
- [x] Preserve backward compatibility for existing saved `table` widgets so current workspaces,
  bindings, widget settings, and runtime behavior keep working without a forced migration.
- [x] Move AG Grid-specific edition wiring behind reusable capability flags so both widgets call
  the same shared table render path.
- [x] Add AG Grid Enterprise package and module registration only for the `pro-table` path.
- [x] Keep canonical tabular dataset publication, selection outputs, and selection runtime-state
  semantics identical between `table` and `pro-table` unless a later ADR explicitly changes the
  shared contract.
- [x] Ensure Asset Screener and other table-derived widgets continue to depend on the shared table
  core instead of binding directly to one edition-specific widget.
- [x] Add regression coverage proving the existing Community `table` widget remains behaviorally
  compatible after the shared-core split.
- [x] Document which features are Community-only, shared, and Pro-only in the local table README
  and usage guidance once implementation starts.
- [x] Validate that the widget registry, widget catalog, and backend-synced widget-type manifest
  can expose both `table` and `pro-table` as distinct widget ids.

## Contract Notes

This decision should not change the canonical tabular dataset contract or the persisted selection
runtime-state contract for the existing `table` widget.

It does introduce a new widget identity, so widget registry sync and any backend-consumed widget
type manifest will need to include `pro-table` as a distinct widget type when implementation
starts.
