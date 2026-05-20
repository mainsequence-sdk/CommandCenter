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

But the current generic tabular stream implementation still behaves like full-row replacement and
does not distinguish same-source streams from user-composed table joins.

The current implementation has two concrete problems:

- stream deltas are validated as if they must have the same complete schema as the retained frame
- keyed deltas replace the whole retained row instead of patching only the changed fields
- table seed/live joins do not let the user define how differently shaped seed and live tables
  should be aligned before patching

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

There is a second, equally important case: users can compose a table from a seed dataset and a live
dataset that do not use the same provider shape.

Example:

- seed rows contain `symbol`, `last`, reference values, formulas, and other display columns
- live WebSocket rows contain `symbol`, `close`

In that case the live stream should first be transformed into the table patch shape, for example
`symbol, last`, and then joined to the seed rows by a user-authored merge mapping such as
`seed.symbol = live.symbol`. The client cannot assume that source-owned stream metadata is enough
for arbitrary table transformations.

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

### 2. Patch Mechanics Are Automatic, Merge Mapping Can Be User Authored

There must be no user-facing setting for low-level patch mechanics:

- patch mode versus replace mode
- partial-column WebSocket behavior

Those mechanics should be automatic after row identity is known.

The table consumer should not ask users to understand stream internals. If a source advertises a
stream as keyed tabular data and the seed/live shapes are the same source contract, partial deltas
patch rows automatically. If it cannot provide a safe row identity, the runtime must not guess.

However, table composition is different from a same-source graph stream. A user may intentionally
join a seed dataset and a live dataset from different providers, different field names, or an
intermediate transform. In that case the table/live consumer must expose a merge mapping that tells
the runtime how to match live rows to seed rows.

The user-facing mapping is identity mapping, not patch algorithm selection.

Example mapping:

```json
{
  "mergeKeys": [
    {
      "seedField": "symbol",
      "liveField": "symbol"
    }
  ]
}
```

For differently named providers:

```json
{
  "mergeKeys": [
    {
      "seedField": "symbol",
      "liveField": "ticker"
    }
  ]
}
```

For multi-key joins:

```json
{
  "mergeKeys": [
    {
      "seedField": "venue",
      "liveField": "exchange"
    },
    {
      "seedField": "symbol",
      "liveField": "instrument"
    }
  ]
}
```

### 3. Row Identity Resolution Has Automatic And Configured Modes

Automatic does not mean guessing from arbitrary column names.

For same-source streams, the runtime resolves row identity from source-owned metadata in this order:

1. runtime update diagnostics such as `mergeKeyFields`
2. connection query model stream metadata such as `defaultMergeKeyFields`
3. canonical frame semantics such as market `assetKey` field roles
4. explicit widget/source adapter defaults for a known widget contract

For user-composed table seed/live inputs, an explicit merge mapping can override automatic identity.
This is required when:

- seed and live fields use different names
- the live stream is transformed before reaching the table
- the seed has multiple possible keys and only the user knows the intended join
- the live provider exposes a narrower or differently named row identity

If no row identity can be resolved, deltas are append-only event rows or the stream is marked
invalid for patching. The table UI should surface a clear diagnostic instead of silently corrupting
rows.

### 4. Live Shape Normalization Happens Before Merge

When live updates do not already match the seed patch shape, users should normalize them with an
explicit transform node before binding them to the table live input.

Example:

- WebSocket source publishes `symbol`, `close`
- Tabular Transform projects/computes `symbol`, `last`
- Table live input receives `symbol`, `last`
- Table merge mapping patches seed rows by `symbol`

This keeps column renaming and value derivation visible in the graph instead of hiding provider
semantics inside the table widget.

### 5. Seed/Snapshot Owns The Table Contract

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

### 6. Formulas Recompute From The Patched Retained Row

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

### 7. Asset Screener Uses The Same Generic Contract

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
- Do not require manual merge mapping when same-source stream metadata already provides safe
  identity.
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
- [ ] Keep developer/source metadata explicit so adapters, query models, and widget contracts own
  identity rather than arbitrary UI guesses.

### User Authored Table Merge Mapping

- [ ] Add a table/pro-table live merge mapping for composed seed/live inputs.
- [ ] Support one or more merge key pairs such as `seed.symbol = live.symbol`.
- [ ] Support differently named fields such as `seed.symbol = live.ticker`.
- [ ] Prefer explicit merge mapping over automatic source metadata when the user configures it.
- [ ] Validate that configured seed and live fields are available from their respective inputs.
- [ ] Surface a clear table settings/runtime diagnostic when a live input needs a merge mapping but
  none is available.
- [ ] Keep patch mechanics automatic after the mapping resolves row identity.
- [ ] Document that shape normalization belongs in Tabular Transform before the table live input
  when live fields need renaming or formula derivation.

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
- [ ] Expose merge-key mapping for composed seed/live table inputs.
- [ ] Keep same-provider graph streams automatic when source metadata provides merge keys.
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
- table/pro-table props need a user-authored merge mapping for composed seed/live inputs where
  automatic source metadata is not sufficient

Backend and connection adapter review is required if any backend stream validation currently
requires delta frames to repeat the full retained schema.

## Consequences

### Positive

- WebSocket table updates become smaller and cheaper.
- Asset Screener can update live prices without resending the entire screener row.
- Formula columns can recompute from live values without source-owned hardcoded metric columns.
- The same stream behavior works for generic tables and market-specific table consumers.
- Users do not need to understand or configure patch semantics; they only configure row identity
  when they intentionally compose different seed/live shapes.

### Negative

- Source metadata must be reliable for same-source streams, and table merge mappings must be clear
  for composed seed/live inputs.
- Debugging moves toward source diagnostics and runtime update metadata.
- Schema expansion from live deltas needs a separate explicit policy.
- Tests that assumed exact schema matching need to be rewritten.
