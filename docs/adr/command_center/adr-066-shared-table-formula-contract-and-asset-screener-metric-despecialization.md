# ADR 066: Shared Table Formula Contract And Asset Screener Metric De-specialization

- Status: Proposed
- Date: 2026-05-20
- Related:
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)

## Context

Asset Screener already follows the intended live-data shape:

- `seedData` carries the full seeded snapshot
- `liveUpdates` can carry partial latest-value rows keyed by asset identity
- the runtime merges those live updates into the current latest state and recomputes visible rows

That part is correct and should be preserved.

The architectural problem is elsewhere: the metric operations are still split between a generic
table computation layer and Asset Screener-specific runtime semantics.

Today there are two different operation layers:

1. shared table transform metadata through `meta.tableTransforms.computedColumns`
2. screener-owned metric semantics such as `Net Chg`, `% Chg`, `1M`, `YTD`, and `1Y`

The current screener implementation still owns return semantics directly in the market runtime. It
computes return columns from latest values plus seeded references such as `previousClose`,
`oneMonthAgo`, `yearStart`, and `oneYearAgo`.

That works for Asset Screener, but it does not scale well:

- derived row metrics become widget-specific behavior instead of a reusable table capability
- table-derived metrics cannot be owned consistently across generic Table and table-derived widgets
- any future table-like widget risks introducing another custom operation layer
- the live update contract becomes harder to reason about because part of the recomputation logic is
  generic and part of it is market-specific

The intended direction is:

- keep `liveUpdates` minimal, often just latest price by symbol or asset key
- keep seeded reference values in `seedData`
- let the visible metrics recompute locally from the current latest value plus seeded references
- make that derived-metric behavior a general table capability instead of a screener-specific one

There is also a product/implementation opportunity to evaluate AG Grid Enterprise formulas as an
Excel-like editing surface. That could reduce the need to invent a custom authoring UI for derived
table metrics, but it must be assessed carefully before it becomes any part of the runtime
contract.

## Decision

### 1. Derived Row Metrics Become A Shared Table Capability

Row-level derived metrics belong to the shared Table contract, not to one specialized widget.

The canonical source of truth should be a grid-agnostic, serializable table formula / computed
column contract owned by the shared table layer.

This capability must work for:

- generic Table
- Asset Screener
- any widget that renders or derives from the shared table frame path

### 2. Asset Screener Stops Owning Custom Metric Operators

Asset Screener should keep only the market-specific semantics that are truly market-specific:

- stable asset identity
- the required `unique_identifier` / canonical asset key requirement
- mapping seeded rows into latest/reference/history/value semantics
- merging partial live updates into the current latest value state
- inline sparkline/reference metadata interpretation where required by market semantics

Asset Screener should not remain the long-term owner of generic derived metric operations such as:

- absolute difference
- percent change
- month-to-date / year-to-date return logic
- any future row-level arithmetic derived from one latest value and one reference value

Those operations should resolve through the shared table formula / computed-column contract.

### 3. Live Updates Stay Minimal And Partial

The live stream contract remains intentionally small.

`liveUpdates` may publish only the changed latest values for a keyed asset row, for example:

- asset key
- observed timestamp
- latest price

The stream does not need to resend:

- seeded reference points
- full historical sparkline payloads
- the already-seeded static identity payload

The runtime should recompute derived metrics locally from:

- current merged latest value
- seeded references
- seeded or source-owned computed columns

### 4. AG Grid Enterprise Formulas Are An Evaluation Candidate, Not The Runtime Contract

AG Grid Enterprise formulas are worth evaluating as an editing and authoring surface, but they must
not become the canonical runtime semantics by default.

The canonical runtime contract must remain:

- serializable
- headless
- deterministic outside the grid UI
- safe to evaluate for output publication and downstream widget consumption

If AG Grid formulas are adopted, they should compile into or synchronize with the shared canonical
table formula contract, rather than replacing it.

## Why AG Grid Formulas Cannot Be Assumed As The Whole Solution

The current AG Grid Enterprise formulas feature is promising, but it has important constraints:

- it is an Enterprise-only feature
- it is cell/grid-oriented, not inherently widget-runtime-oriented
- it requires row ids and formula-enabled columns
- it is designed around interactive grid editing behavior
- it is documented with feature compatibility limits, including unsupported combinations such as
  row grouping and some advanced row models
- it uses formula caching and explicit refresh semantics that are grid-instance concerns, not
  general widget-runtime concerns

That means AG Grid formulas may be a strong UI/editor layer, but they are not automatically the
right source of truth for:

- workspace runtime outputs
- public/private workspace parity
- headless recomputation after stream updates
- persisted widget contracts
- agent-readable or backend-synced widget metadata

## Implementation Tasks

- [ ] Define one canonical shared Table formula / computed-column contract that is serializable and
  grid-agnostic.
- [ ] Decide where that contract can live:
  source metadata, widget props, or both, and define precedence rules clearly.
- [ ] Keep shared table formula evaluation independent from AG Grid runtime state so derived values
  can be recomputed without relying on grid UI internals.
- [ ] Expose shared table formula authoring as a general Table capability rather than a
  screener-only setting pattern.
- [ ] Make table-derived widgets consume the same shared formula contract, including Asset
  Screener.
- [ ] Migrate Asset Screener default metric columns such as `Net Chg`, `% Chg`, `1M`, `YTD`, and
  `1Y` to the shared table formula / computed-column layer.
- [ ] Remove screener-owned generic return helpers after shared-table parity exists.
- [ ] Keep Asset Screener-specific requirements limited to:
  asset identity semantics, `unique_identifier`, latest/reference/history mapping, and live-update
  merge behavior.
- [ ] Preserve the current stream contract where `liveUpdates` may publish partial latest values
  only, keyed by canonical asset identity.
- [ ] Verify that derived metrics recompute correctly when only the latest streamed value changes
  and seeded references remain unchanged.
- [ ] Evaluate AG Grid Enterprise formulas in a dedicated spike focused on:
  authoring UX, persistence shape, grouping compatibility, public/private parity, and runtime
  recomputation behavior.
- [ ] Verify whether AG Grid formulas are compatible with our grouped/synthetic row presentation
  needs before using them in any table-derived widget workflow.
- [ ] If AG Grid formulas are adopted, implement an adapter/compiler so persisted formulas resolve
  through the canonical shared table formula contract instead of becoming a grid-only side system.
- [ ] If AG Grid formulas are not compatible enough, keep them out of the runtime contract and
  continue with the shared in-house canonical formula evaluator only.
- [ ] Update `README.md` and `USAGE_GUIDANCE.md` for Table and Asset Screener when the runtime
  ownership changes are implemented.
- [ ] Add regression coverage for:
  partial live updates, derived metric recomputation, grouped table/screener rendering, and
  persisted formula compatibility.

## Consequences

### Positive

- derived metric behavior becomes reusable across table-derived widgets
- Asset Screener keeps the market-specific semantics that actually belong to it
- live stream payloads remain small and scalable
- derived metrics can recompute from partial latest-value updates without forcing upstreams to
  publish full recalculated rows
- AG Grid formulas can be adopted later as a UX layer without forcing the runtime contract to
  depend on the grid engine

### Tradeoffs

- this introduces a migration from screener-owned metric semantics to shared table semantics
- formula authoring, persistence, and evaluation rules must be defined carefully to avoid
  introducing a second incompatible formula system
- AG Grid Enterprise formulas may still prove too constrained for our grouped/read-only/runtime
  needs, in which case we keep the shared formula engine and do extra authoring work ourselves
