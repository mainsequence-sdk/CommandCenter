# ADR 042: Lightweight Row Filtering in Tabular Transform

- Status: Accepted
- Date: 2026-04-28
- Related:
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)

## Context

Command Center already has the right high-level dataflow model:

- `connection-query` fetches a canonical dataset
- `tabular-transform` reshapes a canonical dataset
- Graph, Table, Statistic, and similar widgets passively consume the resulting dataset

That architecture is general and should stay general. The current gap is not that the platform
lacks transforms. It is that the existing `tabular-transform` widget only supports:

- `none`
- `aggregate`
- `pivot`
- `unpivot`
- final projection

The binding layer is even narrower and only supports structured-value transforms such as
`select-array-item` and `extract-path`.

That leaves no generic way to take one wider tabular dataset and publish a filtered subset for
downstream widgets. The problem shows up clearly with Prometheus-backed workspaces, but it is not a
Prometheus-specific problem. Any connection that publishes a canonical `core.tabular_frame@v1`
dataset may need:

- one broad upstream query
- several downstream filtered slices
- passive graph/statistic/table widgets bound to those slices

Without a generic row filter, authors are forced to keep one source query per consumer even when
the source data could be shared safely.

## Decision

Add a generic `filter` mode to the core `tabular-transform` widget.

The filter must operate on canonical tabular rows, not on source-specific query syntax or
source-specific metadata. It becomes another first-class transform mode beside `aggregate`,
`pivot`, and `unpivot`.

The widget remains a single-input, single-output tabular transform:

- input: one `core.tabular_frame@v1`
- output: one filtered `core.tabular_frame@v1`

Branching happens by binding multiple transform widgets to the same upstream source, not by turning
one transform widget into a multi-output fanout node.

## Scope

This ADR intentionally limits filter semantics to inexpensive, predictable client-side row
predicates.

### Supported v1 operators

- `equals`
- `not-equals`
- `in`
- `not-in`
- `gt`
- `gte`
- `lt`
- `lte`
- `is-empty`
- `is-not-empty`

### Explicitly out of scope for v1

- regex or pattern-matching operators
- free-text substring search such as `contains`
- source-specific operators
- computed expressions
- cross-field comparisons
- joins, lookups, or external fetches
- multi-output split/fanout behavior

This keeps the transform cheap, deterministic, and easy to reason about on large but still
frontend-resident tabular frames.

## Proposed Contract

The persisted widget props should grow additively in a way equivalent to:

```ts
type TabularTransformMode =
  | "none"
  | "filter"
  | "aggregate"
  | "pivot"
  | "unpivot";

type TabularFilterOperator =
  | "equals"
  | "not-equals"
  | "in"
  | "not-in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is-empty"
  | "is-not-empty";

interface TabularFilterRule {
  field: string;
  operator: TabularFilterOperator;
  value?: string | number | boolean | null | Array<string | number | boolean | null>;
}

interface TabularTransformWidgetProps {
  transformMode?: TabularTransformMode;
  filterCombineMode?: "all" | "any";
  filterRules?: TabularFilterRule[];
}
```

Implementation details may refine names, but the stored contract should preserve those semantics.

## Runtime Rules

- Filtering runs against the resolved tabular rows of the upstream dataset.
- Filtering must preserve column order and field metadata for surviving columns.
- Filtering must not mutate upstream rows in place.
- An invalid rule configuration should surface as a normal transform configuration error, not as a
  silent pass-through.
- Filter mode is eligible to publish filtered incremental deltas when upstream delta metadata is
  available and the filter can be applied row-by-row without needing global recomputation.
- Empty result sets are valid outputs, not errors.

## UI Rules

The transform settings UI should expose:

- `Transform mode = Filter`
- combine mode:
  - `All rules`
  - `Any rule`
- ordered rule rows with:
  - field picker
  - operator picker
  - value editor only when the operator requires one

The field picker must be driven by the resolved upstream tabular schema, not by free-form source
knowledge. The UI should not expose source-specific labels such as Prometheus terminology unless
those are already present in the tabular field names.

## Consequences

Positive:

- one upstream source query can feed several filtered downstream datasets
- Graph, Table, and Statistic stay passive consumers
- the workspace graph stays explicit: source -> transform -> consumer
- the feature works for any canonical tabular dataset, not only Prometheus
- broad-source reuse becomes possible without abusing widget-specific query logic

Negative:

- workspaces may gain more visible transform nodes when authors split one broad dataset into many
  slices
- large row sets still require client-side row scans, so the supported operator set must stay
  conservative
- persisted `tabular-transform` props grow additively and backend validation may need to allow the
  new fields

## Guardrails

- Do not add source-specific filter semantics to `tabular-transform`.
- Do not turn filter mode into a full query language.
- Do not add regex, free-text search, or computed expressions in the first rollout.
- Do not hide data shaping inside binding-level transforms when the operation is analytical and
  reusable.
- Do not make Graph, Table, or Statistic own row filtering themselves.

## Backend And Storage Impact

This ADR does not change connection query request or response contracts.

When implemented, it will add optional persisted widget props to `tabular-transform`, such as:

- `transformMode: "filter"`
- `filterCombineMode`
- `filterRules`

If backend workspace validation treats widget props as strict schemas, it must allow these additive
`tabular-transform` fields and the new transform mode value.

## Rollout Tasks

- [x] Add `filter` to `TabularTransformMode`.
- [x] Add additive filter props normalization and validation.
- [x] Implement lightweight row predicate evaluation in the transform runtime/model layer.
- [x] Preserve field metadata and column order through filtered outputs.
- [x] Publish filtered incremental deltas when safe; fall back to snapshot output when not.
- [x] Add settings UI for combine mode, rules, and operator-specific value editors.
- [x] Add focused tests for empty outputs, scalar equality, set membership, numeric comparison, and
  invalid rule handling.
- [x] Update `src/widgets/core/tabular-transform/README.md` and `USAGE_GUIDANCE.md` after the
  implementation lands.
- [ ] Revisit workspace-level source consolidation opportunities that currently require one query
  per consumer.
