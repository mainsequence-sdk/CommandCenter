# ADR 056: Slide Structural Containment in Workspace Graph

- Status: Proposed
- Date: 2026-05-03
- Owners: Workspaces frontend
- Related:
  - [ADR 050: Workspace Slide as Structural Container](./adr-050-workspace-slide-as-structural-container.md)
  - [ADR 055: Simplify Slide To Body-Only Widget Hosting](./adr-055-simplify-slide-to-body-only-widget-hosting.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Workspace Widget Referenced Workspace Graph Expansion](./adr-workspace-widget-referenced-graph-expansion.md)

## Context

The workspace graph currently models two kinds of relationships well:

1. binding/dataflow edges
2. a small set of graph-only synthetic relationships such as referenced-workspace expansion and
   managed-source visibility affordances

The slide model introduces a third relationship type:

- a widget can be structurally hosted inside a `workspace-slide`

That relationship is persisted on the child widget:

- `slidePlacement.slideWidgetId`
- `slidePlacement.region`

After ADR 055, `region` is canonically `body`, but the structural hosting relationship remains.

Today the graph view does not represent that relationship explicitly. A slide-contained widget can
appear in graph mode only through its data bindings, which means:

- a widget inside a slide may appear visually unrelated to the slide that structurally hosts it
- a slide node may appear empty even when it owns several child widgets
- authors cannot infer structure from the graph alone

That is wrong, but the relationship is also **not** a normal widget connection:

- the slide does not publish an output consumed by the child
- the child does not provide an input to the slide
- the relationship must not participate in execution planning, contract validation, or binding
  mutation

So the graph should show the relationship, but it must not fake it as a binding edge.

## Decision

Slide membership will be represented in graph mode as a **graph-only structural containment
relationship**, not as a widget binding.

The graph model will keep dataflow edges and structural-containment relationships separate.

The first implementation should treat slide containment similarly to other graph-only synthetic
relationships:

- it is derived from persisted workspace structure
- it affects graph rendering only
- it must not alter widget IO, runtime execution, or saved bindings

## Design

### 1. Keep binding graph semantics pure

`DashboardWidgetDependencyGraph.edges` should remain reserved for real binding/dataflow edges.

Slide containment must not be encoded as:

- a fake slide output port
- a fake child input port
- a `source: "binding"` edge with a synthetic contract

That would pollute execution and validation semantics with a non-executable structural relationship.

### 2. Add a separate structural relationship channel

The dependency/graph layer should expose a separate relationship collection for graph-only structure.

Recommended shape:

```ts
interface DashboardWidgetStructuralRelationship {
  id: string;
  kind: "slide-membership";
  parentWidgetId: string;
  childWidgetId: string;
}
```

This relationship is derived from `child.slidePlacement?.slideWidgetId`.

### 3. Render slide membership as a synthetic structural edge

`CustomWorkspaceGraphPage` should project slide membership into React Flow as a non-binding,
non-connectable edge.

Recommended visual treatment:

- dashed or muted containment edge
- separate edge kind/source from binding edges
- non-deletable
- non-connectable
- excluded from connect validation

This makes the structural relationship visible without pretending it is dataflow.

### 4. Keep slide and child widgets as normal local nodes

The slide remains its normal widget node.

The child remains its normal widget node.

No synthetic child-node ids are required because both widgets already belong to the current local
workspace graph.

This differs from referenced-workspace expansion, where synthetic namespacing is needed because the
referenced workspace lives in a second graph namespace.

### 5. Add structural node metadata

Graph nodes should expose enough metadata to make structure legible even when the structural edge is
not the only cue.

Recommended additions:

- slide node:
  - `containedWidgetCount`
- slide-contained child node:
  - `hostedInSlideId`
  - `hostedInSlideTitle`

The renderer can use that for badges like:

- `Contains 4 widgets`
- `Inside slide`

### 6. Preserve edit boundaries

Structural containment edges are graph-visible only.

They must not support:

- connect gestures
- edge deletion
- contract mismatch states
- input/output port resolution

Dragging a widget out of a slide should update `slidePlacement`, and the graph should update because
the structural relationship disappears. The graph edge itself is never the mutation surface.

### 7. Keep execution planning unchanged

Slide membership is not an upstream execution dependency.

Therefore:

- execution ordering must ignore structural-containment edges
- refresh propagation must ignore structural-containment edges
- dependency highlighting for runtime/dataflow should remain binding-based unless a separate
  structural-highlighting mode is intentionally designed later

### 8. Allow future clustering, but do not require it for v1

The first version only needs to make slide membership explicit.

It does **not** require:

- embedded child layout inside the slide node
- an expandable slide subgraph frame
- slide-owned mini-canvases inside graph mode

Those can be considered later if authors need a stronger structural grouping.

## Consequences

### Positive

- The graph becomes structurally truthful for slides.
- Slide-contained widgets remain normal local graph nodes.
- Binding semantics remain clean.
- The implementation reuses the existing pattern of graph-only synthetic relationships without
  widening widget IO contracts.

### Negative

- The graph model becomes slightly more complex because it must represent more than one
  relationship family.
- Visual clutter can increase if many slide-contained widgets are present.
- The renderer must be explicit about which edges are structural and which are executable bindings.

## Rejected Alternatives

### 1. Fake slide membership as a normal binding edge

Rejected because the slide is not a data source and the child is not a true downstream consumer.

### 2. Ignore slide structure in graph mode

Rejected because it makes the graph structurally misleading.

### 3. Hide slide-contained widgets behind the slide node entirely

Rejected for the first version because the child widgets are still real local workspace widgets with
their own bindings, settings, and runtime behavior. Hiding them behind the slide would make the
graph less useful for actual debugging.

### 4. Persist graph-only slide edges into workspace bindings

Rejected because graph projection should not rewrite the canonical workspace data model for a purely
visual structural relationship.

## Storage Contract Assessment

This ADR should be implemented without changing persisted workspace storage.

It should reuse existing local structure:

- `DashboardWidgetInstance.slidePlacement`
- slide widget ids already present in `dashboard.widgets`

Any expanded/collapsed structural graph UI state should remain local graph-view state unless a
future ADR explicitly persists per-user graph preferences.

## Implementation Tasks

- [ ] Add a separate structural relationship type to the dependency/graph model layer instead of
      overloading binding edges.
- [ ] Extract slide-membership relationships from `slidePlacement.slideWidgetId`.
- [ ] Add slide containment metadata to graph node data for badges and summaries.
- [ ] Render slide-membership edges in `CustomWorkspaceGraphPage` as synthetic structural edges.
- [ ] Make those structural edges read-only, non-connectable, and non-deletable.
- [ ] Ensure all binding mutation paths ignore structural edges.
- [ ] Keep execution planning and dependency validation unchanged.
- [ ] Update graph documentation in `src/features/dashboards/README.md`.
- [ ] Update slide widget docs in `src/widgets/core/workspace-slide/README.md` if graph behavior
      becomes part of the authoring model.

## Success Criteria

The implementation is correct when all of the following are true:

1. A widget inside a slide is visibly related to that slide in graph mode.
2. That relationship is not represented as a fake binding.
3. Binding editing, execution planning, and runtime dependency logic behave exactly as before.
4. Removing a widget from a slide removes the structural relationship automatically.
5. The graph clearly distinguishes structural edges from binding/dataflow edges.
