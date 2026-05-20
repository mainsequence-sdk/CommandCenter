# ADR 068: Automatic Partial WebSocket Row Patching For Tabular Consumers

- Status: Proposed
- Date: 2026-05-20
- Related:
  - [ADR 041: Query-Shaped WebSocket Streaming for Connections](./adr-041-connection-query-websocket-streaming.md)
  - [ADR 044: Incremental Connection Publications With Explicit Seed And Live Roles](./adr-044-incremental-connection-publications-seed-live-roles.md)
  - [ADR 047: Workspace Runtime Data Reference Store](./adr-047-workspace-runtime-data-reference-store.md)
  - [ADR 049: Publication-Driven Seed/Live Runtime Reduction](./adr-049-publication-driven-seed-live-runtime-reduction.md)
  - [ADR 065: Shared Table Core With Community And Pro Table Widgets](./adr-065-shared-table-core-with-community-and-pro-table-widgets.md)
  - [ADR 066: Pro Table Formula Enablement And Asset Screener Pro Inheritance](./adr-066-shared-table-formula-contract-and-asset-screener-metric-despecialization.md)

## Context

Tables and table-backed widgets now have the right high-level streaming shape:

- `connection-stream-query` owns WebSocket execution and publishes tabular snapshots/deltas
- shared incremental consumers can bind `seedData` and `liveUpdates`
- `table`, `pro-table`, and Asset Screener can consume retained tabular runtime data
- Asset Screener already models live market updates as latest-value mutations

But the current generic tabular stream implementation still behaves like full-row replacement.

The current implementation has two concrete problems:

- stream deltas are validated as if they must have the same complete schema as the retained frame
- keyed deltas replace the whole retained row instead of patching only the changed fields

That is wrong for WebSocket table updates.

A live feed should be able to publish:

```json
{
  "rows": [
    {
      "unique_identifier": "uid:BTCUSDT",
      "last_price": 109500
    }
  ],
  "columns": ["unique_identifier", "last_price"]
}
```

without also resending `sector`, `display_name`, reference prices, sparkline data, formula columns,
hidden source columns, or visual metadata.

The seed/snapshot owns the table contract. The WebSocket delta owns only the changed values.

## Decision

### 1. Partial Row Patching Is The Default Stream Semantics For Keyed Deltas

When a WebSocket tabular delta has a known row identity, the client runtime must patch the retained
row instead of replacing it.

The rule is:

```ts
nextRow = {
  ...retainedRow,
  ...deltaRow,
};
```

That means:

- omitted fields stay unchanged
- explicit `null` clears a field
- included fields update the retained value
- full-row deltas remain valid because they are just larger patches

Example retained row:

```json
{
  "symbol": "BTCUSDT",
  "sector": "Layer 1",
  "display_name": "Bitcoin",
  "last_price": 109420,
  "previous_close": 107980,
  "one_month_ago": 101300,
  "year_start": 92400,
  "price_sparkline": "100800,102400,104950,106700,107980,109420"
}
```

If the stream identity resolves to `symbol`, this WebSocket delta:

```json
{
  "symbol": "BTCUSDT",
  "last_price": 109500
}
```

produces this retained row:

```json
{
  "symbol": "BTCUSDT",
  "sector": "Layer 1",
  "display_name": "Bitcoin",
  "last_price": 109500,
  "previous_close": 107980,
  "one_month_ago": 101300,
  "year_start": 92400,
  "price_sparkline": "100800,102400,104950,106700,107980,109420"
}
```

Only `last_price` changed. The missing fields were not removed because omission means unchanged.
Any formula columns that depend on `last_price`, such as `1D`, `1M`, `YTD`, or `1Y`, recompute from
the patched retained row. The WebSocket message does not need to publish those formula result
columns.

This must apply consistently across:

- `connection-stream-query` retained state
- runtime data store delta application
- seed/live incremental consumer reduction
- generic `table` and `pro-table`
- Asset Screener when it consumes the shared incremental table path

### 2. Users Must Not Configure Patch Behavior

There must be no user-facing table setting for:

- patch mode versus replace mode
- partial-column WebSocket behavior
- merge strategy for normal live table updates

This behavior should be automatic.

The table consumer should not ask users to understand stream internals. If a source advertises a
stream as keyed tabular data, partial deltas patch rows. If it cannot provide a safe row identity,
the runtime must not guess.

### 3. Row Identity Resolution Is Automatic But Source-Owned

Automatic does not mean guessing from arbitrary column names.

The runtime resolves row identity from source-owned metadata in this order:

1. runtime update diagnostics such as `mergeKeyFields`
2. connection query model stream metadata such as `defaultMergeKeyFields`
3. canonical frame semantics such as market `assetKey` field roles
4. explicit widget/source adapter defaults for a known widget contract

If no row identity can be resolved, deltas are append-only event rows or the stream is marked
invalid for patching. The table UI should surface a clear diagnostic instead of silently corrupting
rows.

### 4. Seed/Snapshot Owns The Table Contract

The seed or latest snapshot frame owns:

- column order
- field schemas
- `meta.tableVisuals`
- formula column configuration
- hidden source columns
- semantic field roles
- selection key defaults
- initial retained rows

The delta frame may provide a subset of columns. It must not be required to repeat the full table
contract on every WebSocket message.

The delta frame may introduce new fields only under an explicit schema-expansion policy. Normal
live-price or live-value streams should not use deltas to create display schema.

### 5. Formulas Recompute From The Patched Retained Row

Formula columns are not sent over WebSockets as computed results unless the source explicitly owns
those results.

For the shared table formula path:

- the source row is patched first
- formula columns recompute from the patched row
- downstream consumers see the updated rendered value

For Asset Screener:

- the seed frame can provide identity, reference values, hidden source columns, and formula columns
- live updates can provide only `assetKey`, timestamp, and changed latest values
- return columns and other formulas recompute locally from the patched latest values

### 6. Asset Screener Uses The Same Generic Contract

Asset Screener should not need a separate WebSocket-specific table contract.

The intended Asset Screener stream shape is:

```json
{
  "rows": [
    {
      "unique_identifier": "uid:BTCUSDT",
      "time": "2026-05-20T13:00:01.000Z",
      "last_price": 109500
    }
  ],
  "columns": ["unique_identifier", "time", "last_price"]
}
```

The seed/snapshot can contain:

- `unique_identifier`
- `Symbol`
- `sector`
- `display_name`
- reference prices
- hidden source values
- formula columns
- sparkline source data
- visual configuration

The WebSocket update should not resend those fields unless they actually changed.

## Non-Goals

- Do not add a table setting that asks users to pick patch or replace mode.
- Do not make users manually configure merge keys in normal table or Asset Screener usage.
- Do not make passive table consumers open WebSockets directly.
- Do not require WebSocket messages to resend the full table schema.
- Do not infer row identity by unsafe column-name guessing.
- Do not persist live runtime row patches to backend workspace storage.
- Do not make this Asset Screener-specific; Asset Screener must benefit from the shared tabular
  stream path.

## Implementation Tasks

### Stream Delta Contract

- [ ] Replace exact-schema delta validation in `connection-stream-query` with patch-compatible
  validation.
- [ ] Require a resolved row identity before applying keyed partial patches.
- [ ] Allow delta frames to publish only merge key fields plus changed fields.
- [ ] Preserve full-row delta compatibility.
- [ ] Treat missing fields as unchanged and explicit `null` as a real update.
- [ ] Surface a clear runtime diagnostic when a patch delta has no safe row identity.

### Automatic Identity Resolution

- [ ] Resolve merge keys automatically from runtime update diagnostics when present.
- [ ] Resolve merge keys from query model stream metadata when diagnostics are absent.
- [ ] Resolve market asset identity from `assetKey` field roles for Asset Screener and market
  tabular frames.
- [ ] Remove or hide normal user-facing merge-key configuration from table-backed live-update
  flows once automatic resolution covers the path.
- [ ] Keep developer/source metadata explicit so adapters, query models, and widget contracts own
  identity rather than arbitrary UI guesses.

### Runtime Data Store

- [ ] Change keyed `applyDelta(...)` behavior from row replacement to row patching.
- [ ] Change keyed `combine(...)` behavior from seed/live row replacement to row patching.
- [ ] Keep retained frame columns, fields, and metadata anchored to the seed/snapshot frame.
- [ ] Add operation counters or diagnostics that distinguish patched, appended, pruned, and
  returned rows.
- [ ] Preserve existing ref/version dedupe behavior from ADR 049.

### Incremental Consumer Reduction

- [ ] Change the shared incremental tabular consumer merge from row replacement to row patching.
- [ ] Ensure live update refs can contain subset-column delta frames.
- [ ] Keep seed/live reduction publication-driven and not render-driven.
- [ ] Preserve `deltaDataset` as the delta-only payload for consumers that need the raw update.
- [ ] Ensure table consumers receive the patched retained dataset as their normal render input.

### Table And Pro Table

- [ ] Ensure `table` and `pro-table` render patched retained rows without requiring a full delta
  schema.
- [ ] Recompute formula columns after patched source values change.
- [ ] Preserve selection state using resolved selection keys when patched rows update.
- [ ] Avoid resetting grid state or column configuration when only row values changed.
- [ ] Keep Community and Pro table behavior backward compatible for non-streamed sources.

### Asset Screener

- [ ] Make Asset Screener consume partial live updates through the same shared tabular patch
  semantics.
- [ ] Use market `assetKey` semantics, normally `unique_identifier`, as automatic row identity.
- [ ] Allow live update rows to include only identity, timestamp, and changed latest values.
- [ ] Preserve seed-owned reference values, sparkline source data, formulas, visuals, and hidden
  columns when live values update.
- [ ] Add regression coverage proving a live `last_price` patch recomputes return formula columns
  without resending reference columns.

### Tests

- [ ] Add `connectionStreamQueryModel` coverage for subset-column keyed delta patches.
- [ ] Add runtime data store coverage proving partial deltas preserve untouched fields.
- [ ] Add incremental consumer coverage proving seed/live partial patches produce a retained
  patched dataset.
- [ ] Add table/pro-table coverage for formula recomputation after partial row patches.
- [ ] Add Asset Screener coverage for partial live market updates keyed by `unique_identifier`.
- [ ] Update tests that currently assert different-schema deltas are rejected.

## Contract Notes

This ADR does not require a backend workspace storage change.

It does affect the stream adapter/query model contract:

- stream-capable sources must expose safe row identity metadata for patchable streams
- WebSocket delta responses may carry subset-column tabular frames
- existing full-row deltas remain valid

Backend and connection adapter review is required if any backend stream validation currently
requires delta frames to repeat the full retained schema.

## Consequences

### Positive

- WebSocket table updates become smaller and cheaper.
- Asset Screener can update live prices without resending the entire screener row.
- Formula columns can recompute from live values without source-owned hardcoded metric columns.
- The same stream behavior works for generic tables and market-specific table consumers.
- Users do not need to understand or configure patch semantics.

### Negative

- Source metadata must be reliable because the client will not guess unsafe row identity.
- Debugging moves toward source diagnostics and runtime update metadata.
- Schema expansion from live deltas needs a separate explicit policy.
- Tests that assumed exact schema matching need to be rewritten.
