# ADR 058: Cross-Widget References And Variables

- Status: Accepted
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

This ADR makes five decisions:

1. cross-widget references are still bindings, not a second storage model
2. every widget's existing instance state becomes automatically explorable through the binding system
3. existing setting/configuration fields, including existing shell-owned fields such as widget title, become reference-capable
4. exact whole-value widget reference expressions are allowed as an authoring language when they compile back into the same explicit binding graph
5. mixed literal-plus-reference text interpolation remains out of scope for this slice

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

### Exact Reference Expressions

This slice allows one author-friendly string form for exact whole-value references:

```text
$(widget-identifier).source.path
```

Examples:

```text
$(prices-table).activeRow.symbol
$(prices-table).selectedRows.rows[0].symbol
$(query-source).props.query.symbols[0]
$(summary-note).runtimeState.latestSummary
$(chart-title).title
```

Rules:

- the entire saved literal value must be one reference expression
- the expression is authoring syntax only
- it compiles to one canonical binding edge plus ordered transform steps
- the compiled binding remains the persisted graph model
- widget expressions must not become arbitrary traversal or code execution

### Variable-Aware Settings Inputs

Widget settings fields that accept literal string values should be aware of the widget-reference
language while the user is typing.

The first required authoring affordance is:

- when the user types `$(` in a supported settings input, show an inline picker
- the picker lists referenceable widgets in the current workspace
- each option shows the widget label/title and the stable widget instance id
- selecting a widget inserts the widget reference token, for example `$(widget-instance-id)`
- the input remains the owning field; the picker is an authoring helper, not a second binding screen
- once a complete whole-value reference is selected, the field should render it as a removable
  reference token/pill rather than leaving it visually indistinguishable from normal string text
- the token/pill should show the selected widget label plus the selected source/path where possible
- the token/pill must expose an `X` remove affordance that clears the reference and restores the
  local literal editing state
- settings fields must not also render a separate chain-button/reference picker beside the same input
- non-string controls opt out by default unless they render through a text input or textarea
- custom settings controls that do not use the shared base input components can opt in with the
  stable `ms-widget-variable-reference-input` class or `data-widget-variable-reference-input="true"`
  attribute inside the widget settings provider

The picker must use the same source-widget index as the compiler so it cannot suggest references
that the binding layer cannot resolve. It must also respect the same self-reference and workspace
scope rules as canonical bindings.

This interaction is intentionally the first step. Later affordances can extend the same dropdown into
source/output/path completion such as `.activeRow.symbol`. The completion model should stay generic:

- after `$(widget).`, show the source roots exposed by that widget
- source roots include declared outputs and platform-owned roots such as `title`, `props`, and
  `runtimeState`
- after a selected source root plus `.`, show descriptor-backed object fields when the source has a
  value descriptor or a resolved runtime value descriptor
- completion options insert only the segment being completed, keeping the current text field as the
  authoring surface
- tokenized display is visual only; the field still compiles to the same canonical binding edge and
  does not create a second token storage model

That means a future mixed template such as:

```text
Price for {{ticker}}
```

is still a separate later slice. Mixed interpolation must compile to explicit binding-backed target
models too, but that is not what we are landing here.

### Runtime Variable Reference Registry

The widget-reference language also needs a workspace-scoped runtime registry of active variable
references. This registry is not a second persisted model and not a catalog of every discoverable
widget value.

The registry is derived from canonical widget bindings and contains only values that are actually
linked by at least one consumer.

Examples:

- include `$(prices-table).activeRow.symbol` when a card title or setting field references it
- include `$(prices-table).selectedRows.rows[0].symbol` when a downstream setting references it
- do not include every table column, row field, runtime-state key, or prop path only because it is
  discoverable in autocomplete
- do not include unselected autocomplete candidates
- do not include ordinary widget input bindings such as `connection-query.dataset -> table.source`;
  those remain dependency graph edges, not widget-reference-language variables

The runtime registry should index each active variable by:

- source widget id
- source output id or platform discovery root
- ordered binding transform signature
- consumer widget id
- consumer target input id
- consumer target kind for reference-backed settings, currently title or prop path

Its purpose is to make active references observable and efficiently invalidated:

```text
source title / props / runtimeState / declared output changes
  -> active variable keys for that source are invalidated
  -> dependent resolved inputs recompute
  -> effective title / props / widget inputs recompute
  -> dependent widgets rerender or become stale according to graph execution policy
```

The registry must not push runtime values by mutating saved widget props or saved widget titles.
Saved fields remain authoring state. Runtime reference updates resolve effective values in memory
through the same dependency model used by widget bindings and graph execution.
The dependency model may derive missing canonical bindings from saved exact whole-value
expressions at resolution time so older drafts still render, but that repair stays in memory until
the settings save path persists the generated binding.

Executable downstream widgets need one more rule: a changed variable should not blindly execute
cost-generating or network-backed work. It should mark the relevant graph node stale or use the
existing graph refresh/execution policy so the backend remains the source of truth for work that
has side effects or cost.

### Variable Change Graph Update

The runtime variable registry is not only an inspection tool. It is also the narrowest safe place
to drive downstream updates when a widget commit changes a referenced value.

The important boundary is:

- draft typing in widget settings must not trigger graph execution
- a committed widget-settings change may invalidate active variable consumers
- only consumers that actually reference the changed widget through the variable registry should be
  considered

This ADR therefore requires a commit-scoped invalidation path rather than a generic
"any widget draft changed" watcher.

The intended flow is:

```text
widget settings commit
  -> compare committed before/after values for the changed widget
  -> use the runtime variable registry source index to find active variable consumers
  -> invalidate only affected variable keys
  -> recompute effective title / props / resolved inputs in memory
  -> rerender passive consumers immediately
  -> queue executable downstream consumers through existing stale/refresh/execution policy
```

This flow has four rules:

1. the invalidation trigger is a widget commit event, not keystrokes in a draft form
2. the runtime registry remains derived and in-memory only; it must not persist dirty flags or a
   second variable state model
3. impact should be computed from active variable consumers only, using
   `sourceWidgetId -> variable entries -> consumer widgets`
4. executable consumers should be scheduled through the graph runner as targeted downstream work,
   not through unconditional source-side auto-execution

Two execution lanes are required:

- render-only lane:
  - effective titles, props, and reference-backed resolved inputs recompute after commit
  - passive widgets rerender without graph execution
- execution lane:
  - affected executable widgets, or widgets with executable downstream branches, are marked stale
    and refreshed through the existing graph execution policy

This also implies one authoring constraint:

- widget settings paths that should participate in variable-driven downstream updates must share one
  explicit commit boundary

If one settings surface buffers local draft state and another mutates the workspace draft on every
edit, variable-driven graph refresh will still fire inconsistently while the user is configuring a
widget. The settings layer must therefore normalize around "draft first, commit once" before this
slice is considered complete.

### Planned Runtime Architecture

The implementation should land as one narrow runtime pipeline rather than as a broad
workspace-change observer.

The expected runtime pieces are:

1. **Commit emitter**
   - emits one explicit widget-settings commit event after a widget save/apply action succeeds
   - includes:
     - changed widget id
     - committed before snapshot
     - committed after snapshot
     - commit source such as settings save, settings apply, or another explicit authoring commit
   - must not fire for draft keystrokes, autocomplete selection while still editing, or preview-only
     local demo state

2. **Variable invalidation planner**
   - reads the runtime variable registry source index for the changed widget id
   - if no active variable consumers reference that widget, exits immediately
   - compares only the committed source values actually referenced by those variable entries
   - produces an impact plan that lists:
     - changed variable keys
     - affected passive consumer widgets
     - affected executable consumer widgets
     - affected widgets that are not executable themselves but have executable downstream branches

3. **Render-only lane**
   - invalidates the affected variable entries in memory
   - recomputes effective title / props / resolved inputs through the dependency model
   - lets passive widgets rerender from the recomputed effective state without graph execution

4. **Execution lane**
   - marks affected executable widgets stale through the existing execution policy
   - schedules only the targeted executable consumers or executable downstream branches
   - does not re-run the committed source widget automatically unless that widget itself is part of
     the affected executable target set

5. **Execution coordinator**
   - receives the impact plan after the workspace draft already reflects the committed widget state
   - runs targeted downstream refresh work through the existing graph runner rather than through an
     ad hoc side channel
   - dedupes repeated targets within one commit cycle

This keeps the boundary precise:

```text
explicit widget commit
  -> active-variable impact plan
  -> passive rerender in memory
  -> targeted executable stale/refresh queue
```

The implementation must not become:

```text
any workspace draft mutation
  -> recompute all variables
  -> execute broad downstream graph work
```

### Planned Rollout Sequence

This slice should land in order. Earlier steps are prerequisites for later steps.

1. **Normalize commit boundaries**
   - make widget-settings surfaces converge on one explicit draft-to-commit boundary for changes
     that should participate in variable-driven downstream updates
   - explicitly exclude preview/test actions that should not count as a committed saved widget
     change

2. **Add the commit-scoped invalidation event**
   - create one runtime event or queue entry for "widget committed"
   - publish it only after the committed workspace draft is available to the dependency model

3. **Implement the variable invalidation planner**
   - start from changed source widget id
   - resolve active registry entries for that source
   - compare before/after only for referenced source values
   - emit a structured impact plan

4. **Wire passive rerender first**
   - invalidate the affected variable keys
   - verify effective titles, props, and resolved inputs recompute without persistence drift
   - verify no graph execution is triggered for passive-only impact plans

5. **Wire targeted executable downstream scheduling**
   - hand executable impact targets to the existing graph stale/refresh coordinator
   - avoid source-wide unconditional `executeWidgetFlow(...)` behavior
   - schedule only affected executable consumers or executable branches

6. **Add regression coverage**
   - passive consumer rerender after commit
   - no execution during draft typing
   - executable downstream queueing after commit
   - active-reference-only impact calculation
   - no saved-prop, saved-title, or runtime-registry persistence drift

### Planned Runtime Surface Boundaries

To avoid mixing concerns, the implementation should keep these responsibilities separate:

- settings authoring layer:
  - owns draft editing and explicit commit
  - does not decide downstream execution targets
- dependency / variable layer:
  - owns active variable indexes and effective value recomputation
  - does not persist dirty flags or a second variable snapshot
- graph execution layer:
  - owns stale marking, refresh policy, and targeted executable downstream scheduling
  - does not inspect raw draft keystrokes or individual settings UI events

The simplest acceptable implementation is therefore:

- commit in authoring layer
- plan in variable/dependency layer
- execute in graph runner layer

Anything that skips those boundaries risks recreating the original bug class where a UI edit path
causes broad unpredictable downstream work.

### Managed Executable Source Invalidation

Managed connection sources introduce a specific graph shape that the generic variable planner must
understand:

```text
table runtime output
  -> variable-backed owner setting
  -> owner effective props
  -> owned managed executable source props
  -> managed source runtime output
  -> owner rendered input
```

The important detail is that the executable node is not the owner widget. For example, a graph can
own a hidden `connection-query` widget through `managedBy.ownerInstanceId`, while the variable
reference is authored on the graph owner's `embeddedConnectionQuery.query.symbols` setting.

The existing plain downstream binding walk is insufficient for this shape because:

- the changed variable consumer is the owner widget
- the owner widget can be passive and have no execution definition
- the owned managed source is upstream of the owner through the generated source binding, not
  downstream of the owner
- the owned managed source's saved props are synchronized from owner props only on settings commits
- runtime variable changes resolve owner effective props in memory and must not mutate saved owner
  props or saved managed-source props

Therefore the variable invalidation planner must add a managed-source projection step before
targeted execution scheduling.

The exact runtime solution is:

1. Build the normal before/after dependency snapshots from the committed or runtime-updated widget
   trees.
2. For each changed variable entry, collect affected consumer widget ids from the active variable
   registry.
3. For each affected consumer, resolve the consumer's effective title and props through
   `resolveReferenceBackedWidgetState(...)` using the dependency model.
4. If the affected consumer has a managed-connection consumer adapter and is in a managed source
   mode, find its owned managed executable source widgets by `managedBy.ownerInstanceId`.
5. Create an execution-only projected widget tree where each owned managed source receives props,
   presentation, and title derived from the affected owner's effective props and the adapter.
6. Compare the before/after projected managed-source execution signature. If the projected managed
   source props did not change, do not schedule it.
7. If the projected managed source changed and has an execution definition, add it to the targeted
   executable queue.
8. From each projected managed source, also collect normal executable downstream targets through
   the existing downstream binding walk.
9. Execute the projected managed source before downstream executable targets so passive owners can
   rerender from the newly published source runtime state.

This is still generic. The planner does not special-case graph, Binance, or connection query
fields. It only depends on:

- the shared managed-connection consumer adapter registry
- the generic `managedBy.ownerInstanceId` ownership relation
- the widget execution definition on the owned managed source
- the existing dependency model and graph runner

The execution-only projection must not be persisted:

- saved owner props remain the authored value, including the reference expression or canonical
  binding-backed local literal
- saved managed-source props remain the last committed synchronized props
- the runtime variable registry remains derived
- only runtime execution receives the projected managed-source props

This closes the managed-source gap without turning variable changes into broad source-side flow
execution.

The target behavior for the graph connection case is:

```text
table.activeCellValue changes
  -> graph embeddedConnectionQuery.query.symbols effective value changes
  -> planner detects graph as affected variable consumer
  -> planner projects graph-owned connection-query props from graph effective props
  -> connection-query is queued as the executable target
  -> connection-query publishes a new dataset
  -> graph rerenders from its existing source binding
```

### Downstream Passive Variable Source Invalidation

#### Problem

Runtime variable invalidation is too narrow when the changed widget is not the variable source
itself.

A runtime write by widget `A` can change active variable values owned by downstream passive widget
`B`. For example:

```text
connection-query.dataset changes
  -> table consumes dataset
  -> table.activeRow.symbol changes
  -> another connection-query uses $(table).activeRow.symbol
```

The source value that must be compared is owned by the table, not by the upstream connection. If
the planner only checks variables exported directly by the changed connection widget, it misses the
real active variable change and never schedules the downstream executable branch.

This is not a connection-query readiness problem and it must not be fixed by adding
connection-query-specific execution gates. The variable planner must find the right changed active
variables and schedule the right executable targets.

#### Solution

Keep execution behavior unchanged and fix only the variable invalidation planner.

On a runtime update for `changedWidgetId`, the planner must build before/after execution snapshots
and compare active variable entries for:

- the changed widget id itself
- widgets downstream of the changed widget through normal graph bindings

It still compares only active variable entries. It must not scan every discoverable field in the
workspace.

If an active variable changed, the planner marks its consumers affected. For passive owner widgets
with managed executable sources, the planner projects the owner's effective props into the hidden
managed source as execution-only `targetOverrides`, then schedules the hidden managed source and
its downstream executable branch.

The projection must not persist resolved variable values into saved props. Saved owner props and
saved managed-source props remain the authored values.

The fix boundary is explicit:

- do not add connection-query-specific readiness gates
- do not change connection runtime model behavior
- do not change Asset Screener, Table rendering, empty states, or selection behavior

#### Implementation Tasks

- [ ] On runtime update for `changedWidgetId`, build before/after execution snapshots from the
  pre-write and post-write widget trees.
- [ ] Collect active variable entries for `changedWidgetId`.
- [ ] Walk normal graph bindings downstream from `changedWidgetId` in both before and after
  snapshots.
- [ ] Collect active variable entries owned by each downstream passive widget reached by that walk.
- [ ] Compare only those active variable values before/after; ignore unrelated props and
  discoverable values that are not linked variables.
- [ ] Mark consumers affected only when the active variable value signature changed.
- [ ] For affected passive owner widgets with managed executable sources, resolve the owner's
  effective props through the normal reference-backed state layer.
- [ ] Project effective owner props into the owned hidden executable source as execution-only
  `targetOverrides`.
- [ ] Schedule changed hidden managed sources before their downstream executable branches.
- [ ] Do not write projected managed-source props or resolved variable values back to saved owner
  props or saved managed-source props.
- [ ] Add regression coverage for
  `connection-query.dataset -> table.activeRow.symbol -> managed connection-query`.
- [ ] Add regression coverage that no executable source is scheduled when the active variable value
  did not change.
- [ ] Add regression coverage that saved owner props and saved managed-source props remain
  unchanged after the variable-driven execution plan.

### Follow-Up: Connection Runtime Keying Review

Runtime variable changes must keep connection instance identity separate from connection execution
identity.

There are two different maps in this area:

1. **Connection instance map/list**
   - This is `GET /api/v1/command_center/connections/`.
   - It is the catalog of configured connection instances, keyed by connection id.
   - Variables must not touch this map.
   - A Binance connection remains "Binance connection id 5"; a selected symbol is not part of the
     connection instance.

2. **Connection execution/runtime map**
   - This map must be keyed by the effective resolved execution configuration.
   - The key must distinguish at least:
     - workspace or runtime scope
     - source widget id or owner widget id
     - connection id
     - query model id
     - resolved query payload, for example `symbols: ["ETHUSDT"]`
     - requested output contract
     - time range or refresh identity
     - max rows and incremental refresh settings

If any runtime key is only `connectionId`, or only the hidden connection widget id, it is wrong. It
can reuse stale runtime for a different variable value.

The current incremental query cache partly follows the right shape:

- `incrementalConnectionRefresh.ts` builds an identity that includes `request.query`,
  `request.variables`, `connectionTypeId`, `queryModelId`, requested contract, `maxRows`, and
  `scopeId`
- therefore, if the request has already resolved from `BTCUSDT` to `ETHUSDT`, the incremental
  identity is different

The remaining review points are:

- verify the variable is resolved before building the connection request
- verify runtime refresh actually executes the hidden managed connection source
- verify the owner widget, such as a graph, consumes the new hidden source runtime state through
  its existing binding
- verify no connection runtime store, in-flight dedupe path, retained state path, or preview/runtime
  status path is keyed only by widget id or connection id when it should be keyed by the resolved
  execution configuration

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

- [x] Wire binding discovery directly to existing widget instance state such as `instance.title`, `props`, and `runtimeState`
- [x] Define the canonical discovery namespaces and path semantics used by bindings when they point into existing widget instance state
- [ ] Define the safe default discovery boundaries and exclusion rules
- [ ] Define how non-serializable values, empty values, and missing paths are represented during discovery and resolution
- [x] Extend binding source metadata so a binding can target either a declared output id or a discovered instance-state path
- [x] Extend binding validation so discovered-path bindings still participate in contract checks, cycle detection, self-reference blocking, and dependency ordering
- [x] Define the scalar and structured value coercion rules when a discovered path is consumed by a configurable setting field
- [x] Define the exact whole-value widget reference expression grammar for `$(widget-identifier).source.path`
- [x] Add a shared variable-aware settings input behavior that listens for `$(` in supported literal fields
- [x] Show an inline workspace widget picker when `$(` is typed, populated from the same referenceable widget source index used by the compiler
- [x] Render each widget picker option with the human label/title, widget type context, and stable widget instance id
- [x] Insert the selected widget token into the current field as `$(widget-instance-id)` without moving the user into a separate binding screen
- [x] Commit completed reference completions with Enter/Tab so keyboard authoring lands in token view instead of leaving a raw-looking string
- [x] Reuse the variable-aware input behavior for the shared card-title field and schema-backed string settings inputs
- [x] Remove the separate inline chain-button setting-reference picker from shared widget settings now that references are authored in the owning field
- [x] Render completed whole-value references as removable token/pill UI inside supported settings inputs
- [x] Show the widget label and selected source/path on the reference token/pill when that metadata is available
- [x] Add an `X` remove affordance on reference tokens that clears the reference and returns the field to literal editing
- [x] Define how non-string settings controls opt out or expose a string-editing path before receiving the variable picker
- [x] Expose a stable class/data-attribute opt-in for custom settings controls that do not render the shared base input components
- [x] Add source-root completion after `$(widget).` using the same declared output and platform-root model as the compiler
- [x] Add descriptor-backed nested field completion after `$(widget).source.` when object fields are known
- [ ] Define array-selector completion for paths such as `rows[0]`, `[first]`, and `[last]`
- [x] Resolve widget identifiers in expressions by instance id first, then by unique current widget title
- [x] Compile expression roots to either platform-owned discovery sources (`title`, `props`, `runtimeState`) or declared source output ids
- [x] Compile nested object paths and array selectors in expressions into ordered canonical binding transform steps
- [x] Make existing setting/configuration fields resolve from either literal values or bindings
- [x] Define how shell-owned existing fields such as widget title participate in the same generic resolution path
- [x] Route widget settings reads through a shared resolution layer instead of per-widget ad hoc upstream parsing
- [x] Update the binding authoring UI so source-widget exploration can browse discovered existing instance state without requiring widget-authored exports
- [ ] Update the binding authoring UI so target-field selection works for generic configurable fields instead of only declared bespoke inputs
- [x] Define how the UI distinguishes authored literal values from binding-backed values on the same configuration field
- [x] Define how unresolved references, invalid paths, and contract mismatches are surfaced to the user at authoring time and at runtime
- [x] Preserve existing widget binding transforms such as `extract-path` and `select-array-item` for discovered-path bindings
- [ ] Define whether discovered-path references are persisted as path arrays, strings, or another stable serialized form
- [x] Keep exact-expression authoring ephemeral by compiling it into canonical bindings instead of persisting a second expression storage model
- [x] Keep reference-authored fields editable in shared settings when the literal value itself is an exact widget expression
- [x] Assess whether the persisted binding/storage model changes the backend contract and notify the backend side if serialization semantics change
- [ ] Document the maintenance boundary clearly: widget authors should not need to redeclare fields already present in instance state, while explicit outputs remain optional ergonomic shortcuts

#### Runtime Variable Reference Registry

- [x] Define the workspace-scoped runtime variable registry as a derived index over canonical widget bindings
- [x] Ensure the registry contains only active linked variables, not every discoverable widget output, prop path, runtime-state key, or autocomplete candidate
- [x] Define the variable key shape using source widget id, source output id or platform root, and ordered binding transform signature
- [x] Define the consumer metadata shape using target widget id, target input id, target kind, and optional prop path
- [x] Build the registry from normalized `WidgetInstanceBindings` so `widgets[].bindings` stays the source of truth
- [x] Exclude ordinary widget IO bindings from the variable registry; they remain represented by the dependency graph
- [x] Add source-to-consumer indexes so changes to a widget title, props, runtime state, or declared output can invalidate only affected variables
- [x] Route invalidation through the dependency model so effective title, props, and resolved widget inputs recompute in memory
- [x] Keep saved widget props and saved widget titles immutable during runtime variable updates
- [x] Route executable downstream widgets through stale/refresh/execution policy instead of unconditional automatic execution
- [x] Add a commit-scoped widget-change invalidation path so variable-driven updates run only after a settings commit, not while the user is typing in draft inputs
- [x] Compare committed before/after source values only for active variable entries referenced from the changed source widget instead of treating every prop change as globally impactful
- [x] Split variable-driven updates into a render-only lane for passive consumers and an execution lane for affected executable downstream widgets
- [x] Add a targeted downstream execution planner that starts from changed variable sources and schedules only affected executable consumers or executable branches
- [ ] Normalize widget-settings authoring paths around one explicit draft-to-commit boundary before variable-driven downstream execution is enabled everywhere
- [x] Expose debug/inspection helpers that can list active variables and their consumers for a workspace session

It does not cover:

- mixed literal-plus-reference text templates
- arbitrary string interpolation over any widget internals
- analytical transforms embedded inside the reference layer
- a separate persisted workspace-wide global variables registry
- automatic exposure of transitive upstream data by default

## Backend And Storage Impact

Workspace storage impact:

- binding storage stays on existing widget `bindings`
- existing settings/configuration fields gain reference-capable resolution without a second storage model
- exact whole-value widget reference expressions should compile away into canonical bindings before
  persistence rather than creating a second saved expression model
- the runtime variable registry is derived per workspace session from existing bindings and should
  not be persisted as a second source of truth
- if widget instances later persist mixed-template text or named variable metadata, that will be a
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
- users get one compact widget-reference language for whole-value settings without introducing a
  second graph model
- active referenced values become inspectable and efficiently invalidated without tracking every
  possible widget value

Negative:

- the platform must define safe automatic discovery boundaries
- some widgets may still want custom curation because raw props or runtime state can be noisy
- a runtime reference registry adds another derived cache that must not drift from canonical
  bindings
- a later mixed-template interpolation layer will still need a second ADR

## Guardrails

- Do not let consumers traverse binding metadata or shell internals.
- Do not introduce arbitrary expression parsing or widget-internal traversal syntax.
- Do not add a second graph model or a presentation-only binding storage path outside canonical
  widget bindings.
- Do not persist exact widget-reference expressions as a second saved authoring model when they can
  compile to canonical bindings.
- Do not make the reference model connection-specific, provider-specific, or chart-specific.
- Do not automatically expose transitive upstream resolved inputs unless a later ADR decides that
  explicitly.
- Do not require widget authors to add a bespoke synthetic input for every setting field that should
  support references.
- Do not reintroduce a second inline chain/link picker beside widget setting inputs; the owning
  input plus `$(` autocomplete is the settings authoring surface.
- Do not leave completed whole-value references visually indistinguishable from literal strings in
  settings fields that support tokenized display.
- Do not persist reference tokens as a second storage shape; tokenization is a view over the exact
  reference expression and canonical binding.
- Do not persist the runtime variable registry or let it become a second source of truth beside
  widget bindings.
- Do not populate the runtime registry with every discoverable value; include only variables that
  are actively linked by at least one consumer.
- Do not mutate saved widget props or titles when a runtime variable changes; recompute effective
  values in memory.
- Do not auto-execute cost-generating downstream widgets on every variable invalidation unless the
  existing graph execution policy explicitly allows it.

## Implementation Checklist

- [x] Implement automatic discovery in the general widget platform and shared dependency layer, not
  in per-widget `defineWidget(...)` construction.
- [x] Add automatic discovery roots for every widget instance from existing widget state.
- [ ] Define and document the default discovery roots and exclusion rules.
- [x] Extend the shared settings/runtime model so existing configuration fields can resolve from a
  local literal value or a binding-backed reference value.
- [x] Add exact whole-value widget reference expression authoring to shared widget settings for the
  instance title plus saved prop paths.
- [x] Add `$(` autocomplete to supported shared settings inputs so users can discover workspace
  widgets by label and instance id while typing expressions.
- [x] Extend the same autocomplete flow so `$(widget).` completes exposed source roots and
  `$(widget).source.` completes known object fields.
- [x] Render selected whole-value references as removable token/pill UI in supported settings inputs,
  while preserving canonical binding storage.
- [x] Commit keyboard-selected completions with Enter/Tab so completed references immediately render
  as tokens.
- [x] Remove the old settings-side chain-button picker so reference authoring happens in the
  relevant title or schema field instead of in a parallel panel.
- [x] Route the existing widget title field through the same generic reference-resolution path.
- [x] Compile exact widget-reference expressions into canonical bindings before persistence and keep
  the expression form as authoring syntax only.
- [x] Update the workspace widget host to prefer the resolved bound title over the saved instance
  title.
- [x] Keep binding updates, validation, transforms, and execution ordering inside the existing
  widget dependency model.
- [x] Treat curated explicit outputs as optional ergonomics, not mandatory per-field maintenance.

### Runtime Variable Reference Registry

- [x] Implement a workspace-scoped runtime variable registry provider/store derived from normalized widget bindings.
- [x] Register only linked variable keys that have at least one consumer.
- [x] Keep ordinary widget IO bindings out of the variable registry so debug/inspection output only shows widget-reference-language variables.
- [x] Track source-to-consumer and consumer-to-source indexes for efficient invalidation and debugging.
- [x] Recompute registry entries when widgets, bindings, source outputs, or runtime state change.
- [x] Resolve active variable values through dependency-model selectors so downstream effective settings update without mutating persisted props or titles.
- [x] Integrate variable invalidation with existing graph stale/refresh/execution policy for executable widgets.
- [x] Add commit-scoped variable change graph updates so executable downstream refresh happens after widget-settings commit, not during draft editing.
- [x] Add one explicit runtime widget-commit event carrying changed widget id plus committed before/after snapshots.
- [x] Publish the widget-commit event only after the committed workspace draft is visible to dependency resolution.
- [x] Implement a variable invalidation planner that starts from `sourceWidgetId -> active variable entries -> affected consumers`.
- [x] Restrict before/after comparison to referenced source values only; do not treat unrelated prop changes on the same widget as variable-impactful.
- [x] Apply passive variable invalidation first so effective titles, props, and resolved inputs rerender in memory before any executable downstream scheduling.
- [x] Add a targeted executable downstream scheduler that consumes the invalidation plan instead of broad source-side flow execution.
- [ ] Audit connection runtime identity so connection instance catalogs remain keyed by connection id, while execution/runtime, retained-state, in-flight dedupe, and preview/status entries are keyed by resolved effective execution configuration.
- [ ] Add regression coverage proving `symbols: ["BTCUSDT"]` and `symbols: ["ETHUSDT"]` from the same connection id and hidden source widget do not reuse stale connection runtime or retained query state.
- [ ] Add targeted invalidation tests covering active-reference-only impact calculation, passive rerender after commit, executable downstream queueing, and no persistence/runtime-store drift.
- [ ] Add tests covering linked-only registration, source invalidation, effective prop/title recomputation, and no persistence drift.
