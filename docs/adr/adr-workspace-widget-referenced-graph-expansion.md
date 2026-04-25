# ADR: Workspace Widget Referenced Workspace Graph Expansion

- Status: Accepted
- Date: 2026-04-24
- Related:
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)
  - [ADR: Main Sequence AI Workspace Reference Widget](./adr-agent-monitor-workspace-reference-widget.md)
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)

## Context

The `Workspace` widget, internally registered as `main-sequence-ai-workspace`, publishes a minimal
workspace reference payload:

```json
{
  "id": "<workspace-id>"
}
```

That payload is intentionally small. It identifies another workspace, but it does not embed the
target workspace's widgets, bindings, layout, runtime state, or graph.

The workspace graph view is currently built from the selected workspace only:

1. `useCustomWorkspaceStudio()` resolves the selected workspace from the studio store.
2. `DashboardWidgetDependenciesProvider` calls `createDashboardWidgetDependencyModel(...)`.
3. `createDashboardWidgetDependencyModel(...)` flattens the selected workspace's widget tree,
   resolves each widget's IO, resolves outputs and inputs, and builds graph edges from saved
   bindings.
4. `CustomWorkspaceGraphPage` converts that dependency model into React Flow nodes and edges.

This means graph mode can show the local `Workspace` widget node and its output port, but it cannot
show the graph inside the referenced workspace. The reference id is available, but no layer currently
uses it to load and project the target workspace into the graph view.

There is already a suitable workspace detail loader:

- `loadPersistedWorkspaceDetail(userId, workspaceId)`

That loader can hydrate a full workspace definition on demand without changing the `Workspace`
widget output contract.

## Decision

Graph mode will support expanding a `Workspace` widget node into a read-only referenced workspace
subgraph.

This expansion is a graph-view projection. It must not change persisted workspace widgets,
bindings, runtime state, or the published `main-sequence-ai.workspace-reference@v1` contract.

The base dependency graph builder remains single-workspace and pure. Cross-workspace expansion is
handled by a layer above it in the graph page.

## Design

### Keep the base graph local

`createDashboardWidgetDependencyModel(...)` should continue to operate on one workspace's widget
tree at a time.

It should not fetch remote workspaces, synthesize cross-workspace nodes, or learn about the
`Workspace` widget specifically.

### Add graph-only expansion state

`CustomWorkspaceGraphPage` should own graph expansion state keyed by local widget instance id.

For example:

```ts
expandedReferenceByNodeId: Record<string, true>
```

When a local `Workspace` node is expanded, the graph page reads the node's resolved output value,
extracts the target workspace id, and loads that workspace detail on demand.

### Build a second dependency model for the referenced workspace

Once the referenced workspace detail is available, the graph page should run the same existing
dependency-model builder against the referenced workspace's widgets.

That produces the referenced workspace graph with the same IO, binding, and contract semantics as a
normal workspace graph.

### Namespace referenced graph ids

Referenced nodes and edges must use synthetic ids so they cannot collide with local widget instance
ids.

Recommended shape:

```text
ref::<local-workspace-widget-id>::<referenced-workspace-id>::<referenced-widget-id>
```

The original referenced widget id should remain available in node data for display, links, and
future inspection actions.

### Render as an attached read-only subgraph

The referenced workspace graph should be rendered as an attached framed cluster to the left of the
expanded local `Workspace` node.

It should not be merged into the normal global layout in a way that causes the whole graph to jump
when a reference is expanded.

The first version should use a visible boundary/container node that shows:

- referenced workspace title
- referenced workspace id
- load/error state
- an action to open that workspace directly

The referenced child graph is positioned inside that boundary so the expanded workspace reads as one
contained workspace, not loose cards mixed into the parent graph. Referenced child widgets should
render their internal edges and port anchors, but those anchors must be non-connectable from the
parent graph. The boundary should also connect back to the expanded local `Workspace` node through
synthetic read-only reference handles so the projection reads as a graph relationship, not a
floating panel.

### Preserve the editable local graph path

The current graph editing path depends on local workspace ids only:

- `instanceIndex` is built from the selected workspace's widget instances.
- `handleConnect(...)` resolves connections against that local `instanceIndex`.
- `isValidConnection(...)` validates against the selected workspace's dependency model.
- `handleEdgesDelete(...)` removes bindings from the selected workspace only.
- selection and dependency highlighting are currently keyed from the local `visibleGraph`.

Referenced workspace nodes must not be fed into those editable operations as if they were local
widget instances.

The implementation should keep two concepts separate:

- local dependency graph: editable, saved to the selected workspace
- rendered graph projection: local graph plus optional read-only referenced subgraphs

All binding mutation paths must continue to use the local dependency graph and local instance index.
If a React Flow event references a synthetic `ref::...` node or edge, the editable mutation path
must ignore it.

### Keep referenced nodes read-only in the first version

Referenced workspace nodes are inspection-only.

They should not allow binding edits from the parent workspace graph. Cross-workspace binding
authoring is a separate product decision because it changes ownership and save semantics across two
workspace documents.

This requires more than marking edges as `deletable: false`. The node rendering layer must also
avoid exposing active connection handles for referenced nodes, or explicitly pass a read-only flag
that makes the handles non-connectable. Otherwise users can start invalid connection gestures from
foreign nodes even though `isValidConnection(...)` rejects them.

Referenced nodes should either use a dedicated read-only node type or extend `WorkspaceGraphNode`
with explicit read-only data that disables binding affordances, settings actions, and destructive
edge interactions.

### Avoid graph-wide jumps

The current graph auto-fit is keyed by a graph structure signature. Referenced workspace expansion
may trigger a reveal fit when the user explicitly expands a reference or when the referenced graph
finishes loading, because the cluster opens to the left of the source node and may otherwise be out
of view.

Expansion must still preserve pinned local node positions and must not re-run the local dependency
layout. Runtime refresh and progress animation should not independently reframe the graph.

### Limit recursion

The first version should expand one level only.

If the referenced workspace contains another `Workspace` widget, the graph can show that node, but
it should not recursively inline the next referenced workspace until a separate recursion policy is
designed.

## Non-Goals

- Persisting referenced workspace nodes into the current workspace.
- Widening `main-sequence-ai.workspace-reference@v1` to include a workspace snapshot.
- Allowing parent workspaces to edit child workspace bindings from the expanded subgraph.
- Moving cross-workspace fetch behavior into `createDashboardWidgetDependencyModel(...)`.
- Replacing the current dependency graph implementation.
- Recursively expanding arbitrary workspace reference chains in the first version.

## Storage Contract Assessment

This ADR should be implemented without changing storage contracts.

No change is required to:

- `DashboardDefinition`
- `DashboardWidgetInstance`
- widget `props`
- widget `bindings`
- widget `runtimeState`
- `main-sequence-ai.workspace-reference@v1`

The expansion state should be local UI state in graph mode. If a later version persists expanded
reference state as per-user view state, that should be treated as a separate workspace user-state
contract change.

## Consequences

### Positive

- Workspace references become inspectable in graph mode without navigating away.
- The feature reuses the existing dependency model builder.
- The `Workspace` widget remains a minimal reference widget.
- The implementation stays graph-view-owned instead of pushing cross-workspace behavior into every
  widget consumer.

### Negative

- Graph mode now needs lazy workspace-detail loading for expanded references.
- The graph renderer must manage synthetic node ids and a second graph namespace.
- Read-only referenced nodes need clear visual treatment so users do not confuse them with editable
  local widgets.

## Implementation Tasks

- [x] Add a graph expansion state map in `CustomWorkspaceGraphPage` keyed by local `Workspace`
      widget instance id.
- [x] Detect expandable `Workspace` graph nodes by widget id and resolved output value, not by
      display title. The implementation also falls back to the authored `workspaceId` prop when
      graph mode has not yet received fresh runtime state for the output.
- [x] Add expand/collapse UI to `WorkspaceGraphNode` for expandable reference nodes.
- [x] Load referenced workspace detail lazily with `loadPersistedWorkspaceDetail(userId,
      workspaceId)`.
- [x] Cache referenced workspace load results per workspace id during the graph session.
- [x] Build a dependency model for each loaded referenced workspace using
      `createDashboardWidgetDependencyModel(...)`.
- [x] Convert referenced dependency models into namespaced React Flow nodes and edges.
- [x] Add a read-only boundary/container node for the referenced workspace title, id, load state,
      and open-workspace action.
- [x] Position the referenced subgraph relative to the expanded local `Workspace` node without
      forcing a full local graph relayout.
- [x] Keep local editable graph data separate from the rendered graph projection that includes
      referenced subgraphs.
- [x] Ensure `handleConnect`, `isValidConnection`, `handleEdgesDelete`, and keyboard-delete paths
      ignore synthetic referenced nodes and edges.
- [x] Mark referenced nodes and edges as read-only so graph binding edits only affect the current
      workspace.
- [x] Disable connection handles and settings/destructive actions on referenced read-only nodes, or
      render them with a dedicated read-only node type.
- [x] Render referenced workspace child edges inside the frame using non-connectable read-only port
      handles, so the subgraph shows actual widget connections without allowing edits.
- [x] Add synthetic read-only reference handles between the referenced workspace frame and the
      source `Workspace` node so the expansion is visibly connected to its origin.
- [x] Keep graph auto-fit keyed to local graph structure plus explicit reference expansion/load
      state so a left-side reference can be revealed without local graph relayout.
- [x] Decide whether dependency highlighting is local-only for referenced nodes or computed inside
      each referenced subgraph model, then implement that explicitly. The first implementation keeps
      dependency highlighting local-only.
- [x] Prevent recursive expansion beyond one level in the first implementation.
- [x] Add empty, loading, missing, and error states for referenced workspace expansion.
- [x] Update graph documentation in `src/features/dashboards/README.md`.
- [x] Update the `Workspace` widget README if the graph expansion affordance changes widget
      authoring expectations.
- [ ] Verify with at least one workspace that contains a `Workspace` widget pointing at another
      workspace with multiple bound widgets.
