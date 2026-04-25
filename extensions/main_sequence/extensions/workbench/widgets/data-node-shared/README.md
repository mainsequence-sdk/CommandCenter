# Main Sequence Data Node Shared Widgets

This folder owns reusable workbench-level building blocks for widgets that consume Main Sequence
data-node metadata and remote rows.

## Entry Points

- `dataNodeShared.ts`: shared metadata helpers such as field inference, date-range resolution,
  and label formatting for data nodes and local updates.
- `dataNodePublishedDataset.ts`: the shared published runtime contract for Data Node consumers.
  This is the standard hop-local dataset shape used by `Data Node Graph`, `Data Node Table`, and
  `Statistic`: `status`, `dataNodeId`, `columns: string[]`, `rows: Record<string, unknown>[]`,
  optional normalized `fields`, optional `source`, plus range metadata, identifiers, and update
  timestamps. Published `fields` now carry schema provenance metadata as well:
  `provenance`, `reason`, `derivedFrom`, and `warnings`.
- `dataNodeWidgetSource.tsx`: reusable source/date-range widget contract used by legacy Main
  Sequence consumers that bind to Data Node-shaped datasets. It can still resolve source settings
  from existing bound `main-sequence-data-node` instances in old workspace documents, but new
  source querying belongs to the `mainsequence.data-node` connection plus core widgets. The shared
  fixed date controls mark `From` and `To` as half-width schema fields, so they render on the same
  row in settings instead of stacking vertically. When a passive consumer is canonically bound to an
  executable upstream widget and no published source value exists yet, this source layer exposes
  `requiresUpstreamResolution` so consumer widgets can delegate that work to the shared dashboard
  execution coordinator before they render.
- `widgetBindings.ts`: shared binding ids for Data Node-family composition.
- `DataNodePreviewTable.tsx`: reusable simple table preview used inside settings flows that inspect
  fetched data-node rows without mounting the full table formatter widget.
- `DataNodeFieldSchemaInspector.tsx`: reusable modal-driven schema inspector used by Data Node
  widgets to show the resolved field contract, provenance, warnings, and representative sample
  values without dumping long schema tables inline into settings pages.
- `DataNodeQuickSearchPicker.tsx`: reusable remote-search picker for selecting a data node from
  widget settings or companion-card controls.
- `LocalTimeSerieQuickSearchPicker.tsx`: reusable remote-search picker for selecting a
  `local_time_serie` update from widget settings.
- `SimpleTableUpdateQuickSearchPicker.tsx`: reusable remote-search picker for selecting a
  `simple_table_update` when a widget needs to bind to a Simple Table run rather than a Data Node
  run.
- `DataNodeDateTimeField.tsx`: shared local datetime input used by data-node widgets that support
  fixed saved ranges. It now preserves seconds in both formatting and native input editing, so
  saved fixed timestamps do not collapse to minute precision in widget settings.

## Scope

Keep only reusable data-node widget primitives here. Widget-specific chart transforms, table
formatting, and widget-specific preview behavior should stay in the owning widget folder.

When multiple widgets point at the same resolved source and request the same row shape, keep their
React Query keys aligned through the shared helpers here so identical remote row requests dedupe.

For chained `Data Node` pipelines, keep the contract hop-local: source binding resolves the selected
upstream widget, then downstream widgets consume that upstream widget's published runtime dataset.
Do not add special cases for chain depth; the same `published dataset -> local transform/render`
pattern should hold no matter how many Data Nodes are linked together.

Recursive upstream execution also follows that same rule now: downstream passive widgets ask the
shared dashboard execution layer to resolve upstream sources, and the execution layer walks through
passive hops until it finds executable ancestors. Widgets in this folder should not special-case
`AppComponent` or any other source type. The old `main-sequence-data-node` source widget has been
removed from code and the live catalog; new source execution should flow through Connection Query.

Keep the consumer contract explicit:

- Connection Query and Tabular Transform own querying and reusable transforms.
- `Graph`, `Table`, and `Statistic` consume the published tabular frame:
  `columns + rows` plus optional normalized `fields` and `source` metadata.
- Consumer widgets may derive local series, frames, or KPI cards, but they should not mutate the
  upstream transport shape.
- Published `fields` should stay honest about origin:
  - preserve backend-declared metadata when a source column survives unchanged
  - mark transform-created fields as `derived`
  - use `inferred` only when no authoritative schema is available
- Table-local manual fields should still be marked as `manual` in table settings/schema
  inspection, but they are not published by the `Data Node` widget as a reusable dataset.
- Widget settings that depend on field typing should expose that runtime contract through the shared
  schema inspector instead of silently inferring types with no user visibility.

Shared source/date-range widgets should keep fixed-date editing compact. If the shared source schema
adds more small controls in the future, prefer the same `settingsColumnSpan` contract instead of
hardcoding one-off layout wrappers inside individual widget settings screens.

For the current bindings-only path, keep two layers distinct:

- `widget-contracts/` owns the typed cross-widget contract id and payload shape.
- `widgetBindings.ts` owns the shared input/output ids used by Data Node-family widgets.
