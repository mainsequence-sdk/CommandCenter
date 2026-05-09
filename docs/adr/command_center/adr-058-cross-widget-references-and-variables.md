# ADR 058: Cross-Widget References And Variables

- Status: Proposed
- Date: 2026-05-08
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Binding-Level Output Transforms for Structured Widget Outputs](./adr-binding-output-transforms.md)
  - [ADR: Connection-First Workspace Dataflow](./adr-connection-first-workspace-dataflow.md)
  - [ADR: Executable Widget Graph Runner and Refresh Coordination](./adr-executable-widget-graph-runner.md)

## Context

The widget graph already gives the platform most of what it needs for safe composition:

- explicit widget outputs
- explicit widget inputs
- canonical bindings stored on widget instances
- binding transforms such as `select-array-item` and `extract-path`
- execution ordering through the dependency graph
- self-reference blocking and contract validation

What it does not yet give users is a first-class cross-widget reference and variable model.

The need is generic:

- a source widget owns some useful value
- a downstream widget wants to reuse that value as:
  - chrome text such as a title
  - any saved config field
  - any request or filter field
  - any render-time scalar setting

The wrong direction would be to let widgets read free-form expressions over arbitrary widget state,
for example:

```text
($self.bindings.source_widget....)
```

We reject that direction.

Problems with it:

- it bypasses explicit source-output to target-input graph edges
- it couples consumers to internal binding storage and producer internals
- it weakens validation, self-reference blocking, and execution reasoning
- it creates an unbounded expression language over widget implementation details
- it makes public-workspace safety and persisted workspace validation harder

The system we want must stay graph-native. References must compile to known dependencies.

## Decision

Cross-widget references and variables will be modeled as canonical widget bindings between explicit
consumer targets and automatically discoverable existing producer state.

The key change from a fully manual model is this:

- automatic discovery from existing widget state is the default producer path
- widget authors must not have to redeclare every reusable field
- curated explicit outputs are optional convenience paths, not the baseline requirement

This ADR makes four decisions:

1. cross-widget references are still bindings, not a second storage model
2. every widget's existing instance state becomes automatically explorable through the binding system
3. existing setting/configuration fields, including existing shell-owned fields such as widget title, become reference-capable
4. any future template syntax must compile back into the same explicit binding graph

The dependency remains:

```text
source widget output
  -> canonical binding edge
  -> target widget input
  -> resolved widget behavior
```

## Producer Model

### Automatic Discovery Over Existing Instance State

Every widget instance already persists state through the widget instance model. The binding system
should discover that existing state directly rather than asking widget authors to republish it into
a second structure.

The default automatic roots are:

- `instance-title`
- `props`
- `runtime-state`

These are not widget-authored outputs and not a second persisted snapshot. They are stable binding
discovery namespaces over the existing instance model, exposed by the shared dependency layer and
binding UI.

The important rule is:

- users should be able to explore existing widget-owned state automatically
- widget authors should not have to hand-declare every reusable field
- the platform should read the existing instance model directly instead of forcing the same data to
  be republished under a second wrapper object

The binding UI can use the existing structured binding transform model to project nested values from
these roots:

- `extract-path`
- `select-array-item`

That gives an automatic exploration path without adding arbitrary expressions and without requiring a
second declared snapshot path such as `reference.props...`.

### What Is Automatically Exposed

The default automatic roots should expose widget-owned state only:

- saved instance title
- saved widget props
- widget runtime state

It should not expose:

- canonical binding metadata itself
- shell-owned internal bookkeeping
- DOM state
- non-serializable objects
- credentials or secure config
- arbitrary upstream resolved inputs by default

The last rule is important. Automatic discovery should describe what the widget owns, not quietly
republish transitive upstream dependencies.

### Curated Explicit Outputs Remain Useful

Widgets may still publish explicit additional outputs when they improve UX, stability, or clarity.

Examples:

- `primary-symbol`
- `request-label`
- `selected-row-id`
- `effective-date`

But these become optional convenience outputs. They are not the only way a value becomes
referenceable.

The intended model is:

- automatic discovery over existing widget state for broad exploration
- curated explicit outputs for common, stable, high-signal values

That keeps maintenance low without losing the ability to make common bindings simple.

## Consumer Model

### Existing Setting Fields Are Referenceable

Downstream widgets consume cross-widget values through existing configuration fields.

There are two classes of target:

1. existing shell-owned fields
2. existing widget-owned fields

Shell-owned fields cover values already owned by the workspace shell rather than one widget
implementation.

Example:

- existing widget title field
- accepted contract: `core.value.string@v1`

Widget-owned targets should not require one bespoke input definition per setting field. Instead, the
general settings/configuration system should allow a saved field to resolve from either:

- a local literal value
- a binding-backed reference value

In other words, the target model should be "any configurable field can opt into reference mode"
rather than "authors must add a separate synthetic input for each field they want bindable."

These generic targets may map to:

- a prop path
- a generated field
- a filter or request field
- a render-only scalar setting

The platform should prefer generic setting-field resolution over per-widget ad hoc parsing of
upstream widget data.

### Title Is An Existing Field, Not A New Feature

The widget title is still a useful example because it already exists and is shell-owned. Its
resolution can remain:

```text
resolved bound title
  ?? saved instance.title
  ?? widget.title
```

But title is not the core feature. The broader rule is:

- any setting/configuration field should be referenceable through the same generic mechanism
- shell-owned fields such as title participate through the same existing settings/runtime path
- widget-owned fields participate through generic setting-path targets

## Binding Semantics

Bindings remain canonical widget graph edges.

Cross-widget references do not require a second persistence model. The dependency stays:

- source widget id
- source root or declared output id
- optional transform steps
- target widget id
- target input id

That means any future template such as:

```text
Price for {{ticker}}
```

is acceptable only if `{{ticker}}` compiles to an explicit binding-backed target model. The
template layer must not become arbitrary runtime traversal or code execution.

## Why This Is Generic

This ADR is intentionally not tied to:

- `connection-query`
- `connection-stream-query`
- Alpaca
- charts
- titles only

Those are examples, not the architecture.

Valid examples under this model:

- a connection widget exposes `props.query.symbols` through automatic discovery, and a chart binds
  the first symbol to the existing widget title field
- a table exposes `runtime-state.selection` through automatic discovery, and an app-component widget
  binds a selected id into a request field
- an app-component exposes `runtime-state.lastResponse` through automatic discovery, and another
  widget extracts one nested field for display
- an agent widget exposes `runtime-state.latestSummary` through automatic discovery, and a note
  widget binds it into a display field
- a graph widget binds an upstream discovered value into any normal saved setting field such as a
  filter selector, legend label, request argument, or display option

The producer type is incidental. The contract is the same.

## Scope Of The First Slice

This ADR covers one platform slice only.

### Implementation Tasks

- [ ] Wire binding discovery directly to existing widget instance state such as `instance.title`, `props`, and `runtimeState`
- [ ] Define the canonical discovery namespaces and path semantics used by bindings when they point into existing widget instance state
- [ ] Define the safe default discovery boundaries and exclusion rules
- [ ] Define how non-serializable values, empty values, and missing paths are represented during discovery and resolution
- [ ] Extend binding source metadata so a binding can target either a declared output id or a discovered instance-state path
- [ ] Extend binding validation so discovered-path bindings still participate in contract checks, cycle detection, self-reference blocking, and dependency ordering
- [ ] Define the scalar and structured value coercion rules when a discovered path is consumed by a configurable setting field
- [ ] Make existing setting/configuration fields resolve from either literal values or bindings
- [ ] Define how shell-owned existing fields such as widget title participate in the same generic resolution path
- [ ] Route widget settings reads through a shared resolution layer instead of per-widget ad hoc upstream parsing
- [ ] Update the binding authoring UI so source-widget exploration can browse discovered existing instance state without requiring widget-authored exports
- [ ] Update the binding authoring UI so target-field selection works for generic configurable fields instead of only declared bespoke inputs
- [ ] Define how the UI distinguishes authored literal values from binding-backed values on the same configuration field
- [ ] Define how unresolved references, invalid paths, and contract mismatches are surfaced to the user at authoring time and at runtime
- [ ] Preserve existing widget binding transforms such as `extract-path` and `select-array-item` for discovered-path bindings
- [ ] Define whether discovered-path references are persisted as path arrays, strings, or another stable serialized form
- [ ] Assess whether the persisted binding/storage model changes the backend contract and notify the backend side if serialization semantics change
- [ ] Document the maintenance boundary clearly: widget authors should not need to redeclare fields already present in instance state, while explicit outputs remain optional ergonomic shortcuts
4. wire existing shell-owned fields such as widget title through the same generic resolution path
5. keep binding transforms and graph topology unchanged
6. keep dependency resolution explicit and typed
7. allow curated explicit outputs as optional convenience paths

It does not cover:

- arbitrary text templates
- arbitrary string interpolation over any widget internals
- analytical transforms embedded inside the reference layer
- a separate workspace-wide global variables registry
- automatic exposure of transitive upstream data by default

## Backend And Storage Impact

Workspace storage impact:

- binding storage stays on existing widget `bindings`
- existing settings/configuration fields gain reference-capable resolution without a second storage model
- if widget instances later persist template text or named variable metadata, that will be a
  separate persisted contract change and should get its own explicit assessment

Backend impact:

- if backend widget validation distinguishes between literal setting values and reference-backed
  setting values, it must tolerate the generic reference-capable setting shape
- if widget type contracts or saved-widget validation enumerate allowed source kinds, they must
  tolerate the platform-owned automatic discovery roots
- if backend validation treats bindings as opaque graph metadata today, this slice remains largely
  frontend-dominant

Public workspace safety:

- automatic discovery must exclude credentials, secure config, and backend-only transport state
- discovered values must stay JSON-serializable and bounded enough for UI exploration

## Consequences

Positive:

- the platform gets one generic cross-widget reference model
- widgets do not need to hand-declare every reusable field
- titles, request fields, filters, and any other configurable settings can all use the same binding semantics
- curated outputs still exist when the default exploration path is too noisy

Negative:

- the platform must define safe automatic discovery boundaries
- some widgets may still want custom curation because raw props or runtime state can be noisy
- a later template layer will still need a second ADR if we decide to add author-friendly string
  interpolation

## Guardrails

- Do not let consumers traverse binding metadata or shell internals.
- Do not introduce arbitrary expression parsing or widget-internal traversal syntax.
- Do not add a second graph model or a presentation-only binding storage path outside canonical
  widget bindings.
- Do not make the reference model connection-specific, provider-specific, or chart-specific.
- Do not automatically expose transitive upstream resolved inputs unless a later ADR decides that
  explicitly.
- Do not require widget authors to add a bespoke synthetic input for every setting field that should
  support references.

## Implementation Checklist

- [ ] Implement automatic discovery in the general widget platform and shared dependency layer, not
  in per-widget `defineWidget(...)` construction.
- [ ] Add automatic discovery roots for every widget instance from existing widget state.
- [ ] Define and document the default discovery roots and exclusion rules.
- [ ] Extend the shared settings/runtime model so existing configuration fields can resolve from a
  local literal value or a binding-backed reference value.
- [ ] Route the existing widget title field through the same generic reference-resolution path.
- [ ] Update the workspace widget host to prefer the resolved bound title over the saved instance
  title.
- [ ] Keep binding updates, validation, transforms, and execution ordering inside the existing
  widget dependency model.
- [ ] Treat curated explicit outputs as optional ergonomics, not mandatory per-field maintenance.
