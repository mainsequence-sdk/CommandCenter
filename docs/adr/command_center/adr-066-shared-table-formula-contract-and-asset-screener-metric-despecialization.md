# ADR 066: Pro Table Formula Enablement And Asset Screener Pro Inheritance

- Status: Accepted
- Date: 2026-05-20
- Related:
  - [ADR 065: Shared Table Core With Community And Pro Table Widgets](./adr-065-shared-table-core-with-community-and-pro-table-widgets.md)
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)

## Context

ADR 065 already split the table stack into:

- `table`: Community widget
- `pro-table`: Enterprise widget
- one shared table core underneath both

That shared-core split is now implemented.

Asset Screener already reuses substantial parts of the shared table implementation:

- [`AssetScreenerWidget.tsx`](../../../extensions/main_sequence/extensions/markets/widgets/asset-screener/AssetScreenerWidget.tsx)
  renders through `TableFrameView`
- [`AssetScreenerWidgetSettings.tsx`](../../../extensions/main_sequence/extensions/markets/widgets/asset-screener/AssetScreenerWidgetSettings.tsx)
  already embeds `TableWidgetSettings`
- the screener already persists shared table display settings inside `props.table`

So this migration should stay small.

The remaining gap is that the screener is still effectively consuming the Community table path by
default rather than explicitly inheriting the `pro-table` capability path.

The intended scope of this ADR is only:

1. `pro-table` includes a formulas setting, enabled by default.
2. Asset Screener inherits from the `pro-table` path rather than the Community `table` path.

This ADR is intentionally not the place to redesign screener metric semantics, live-update
contracts, or build a spreadsheet-style editing surface. The goal is to align capability ownership
with the shared `pro-table` implementation that now exists and keep formula authoring narrow.

## Decision

### 1. Pro Table Owns The Formula-Capable Table Path

The shared table core will expose one formula-capability setting in the `pro-table` path.

That means:

- `pro-table` gets a user-facing formulas setting
- that setting defaults to `true`
- the Community `table` widget does not become formula-capable just because `pro-table` is
  introduced

The setting must be implemented in the shared table settings surface, but capability-gated so it
is only exposed where Enterprise-backed formula behavior is allowed.

### 2. Formulas Are Column-Level, Not Spreadsheet Editing

The first implementation scope is only column formulas.

That means:

- a column can be declared as a formula column
- the user provides one formula expression for that column
- the formula renders as a normal table column in the live widget
- formulas are not authored by editing live cells
- formulas are not a second embedded grid inside settings
- formulas are not arbitrary spreadsheet state spread across rows and cells

The authoring model should stay simple:

- choose or mark a column as `formula`
- enter the formula expression in the existing settings surface
- render the computed values in the table output

This keeps the scope to “formula column rendering” rather than “Excel inside the widget”.

### 3. Asset Screener Moves To The Pro Table Capability Path

Asset Screener should inherit the same Enterprise table capability path used by `pro-table`.

In practice that means the screener should stop implicitly consuming the Community table defaults
and instead consume the shared table core using the same Pro-oriented options:

- Enterprise AG Grid modules
- Pro table settings surface
- formula capability enabled by default

The screener should keep its own market-specific runtime semantics, but its shared table surface
should be aligned with `pro-table`, not `table`.

### 4. The Migration Must Stay Minimal

This is not a request to fork table logic or move the screener onto a separate table
implementation.

The migration should be minimal because the screener already reuses:

- shared table rendering
- shared table settings
- shared persisted `props.table` settings structure

The preferred implementation is to route the screener through reusable Pro table configuration
options rather than duplicating any render or settings logic.

### 5. Formula Authoring Stays In Settings First

The first formula-authoring implementation should stay out of the live widget surface.

That means:

- formulas are authored inside widget settings
- view mode remains read-only
- workspace edit mode remains move/resize/configure mode
- live grid cell interaction keeps its current meaning for selection and variable publication
- persisted formulas must live in shared table props/settings, not transient AG Grid instance
  state

This keeps the current interaction contract stable while allowing formula capability to ship on the
`pro-table` path.

## Implementation Tasks

### Formula Authoring

- [x] Add one shared table formulas setting to the shared table props/settings model.
- [x] Add one shared table column-level formula field to the shared table props/settings model.
- [x] Allow a column to be marked or declared as a `formula` column in the shared table settings
  model.
- [x] Add a formula expression input to the existing shared table settings surface for formula
  columns.
- [x] Keep first-version formula authoring inside widget settings only.
- [x] Do not add a second grid or spreadsheet-style editing surface inside widget settings.
- [x] Keep view mode read-only for formula-capable tables.
- [x] Keep workspace edit mode limited to move/resize/configure behavior rather than live
  spreadsheet editing.
- [x] Preserve current live cell interaction semantics for selection outputs, active cell outputs,
  and variable publication.
- [x] Persist authored formulas in the shared table props/settings contract rather than transient
  AG Grid instance state.
- [x] Ensure formula columns render as ordinary table columns once computed, with no separate
  runtime interaction model.

### Pro Table

- [x] Gate that setting by table edition/capability so it is exposed on `pro-table`, not forced
  onto the Community `table` widget.
- [x] Make the `pro-table` widget default that formulas setting to `true`.
- [x] Ensure the shared table registry metadata and usage guidance describe that formula capability
  as part of the `pro-table` path.

### Asset Screener Inheritance

- [x] Introduce or reuse one shared Pro-table configuration bundle so `pro-table` and
  Asset Screener consume the same Enterprise table options instead of duplicating flags.
- [x] Update Asset Screener rendering to use the shared Pro-table capability path rather than the
  Community table defaults.
- [x] Update Asset Screener settings to use the shared Pro-table settings path rather than the
  Community table defaults.
- [x] Default Asset Screener table settings to formulas enabled unless the user explicitly turns
  them off.
- [x] Keep Asset Screener runtime merge behavior, identity semantics, and live-update contracts
  unchanged in this ADR.
- [x] Preserve backward compatibility for existing Asset Screener instances by treating the new
  formula setting as additive, with sane defaults when older saved widgets do not persist it yet.

### Regression And Compatibility

- [x] Add regression coverage proving:
  - `pro-table` enables formulas by default
  - Community `table` stays backward compatible
  - Asset Screener uses the shared Pro table capability path without forking shared table logic

## Plan Notes

This should be a small implementation if the shared table split is being used correctly.

The minimal code path should be:

1. add one shared `formulasEnabled`-style setting in the shared table settings contract
2. add one shared column-level formula field and formula expression input in the existing table
   settings UI
3. keep formula authoring settings-only and avoid introducing a second grid/editor surface
4. wire `pro-table` so that setting defaults to `true`
5. pass the same Pro table capability options into Asset Screener’s existing shared
   `TableFrameView` and `TableWidgetSettings` integration

The screener should not need its own formula UI or a second table settings implementation.

## Contract Notes

This ADR is expected to introduce an additive persisted table-setting field for formula enablement.

That means:

- existing `table` widget behavior should remain backward compatible
- existing Asset Screener saved instances should still load without a migration
- backend contract review is still required if the persisted shared table settings shape changes in
  a backend-visible way
