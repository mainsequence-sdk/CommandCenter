# ADR 070: Workspace Variable Explorer

- Status: Accepted
- Date: 2026-05-21
- Related:
  - [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
  - [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)
  - [ADR 069: Variable-Driven WebSocket Stream Resubscription](./adr-069-websocket-stream-variable-resubscription.md)
  - [ADR: First-Class Widget Bindings and Dependency Graph](./adr-widget-bindings-and-dependency-graph.md)

## Context

Workspace authors need a way to inspect variable behavior while composing widgets.

Today the platform has two different inspection needs that should not be mixed:

- authoring a new reference, where the UI may need to show possible source widgets, outputs, and
  paths
- debugging an existing workspace, where the user needs to see only variables that actually exist
  or are actively referenced

The second case is not served well by a broad picker. Showing every possible variable candidate
creates noise and hides the actual runtime state. When a table selection changes, a connection query
waits for a referenced value, or a WebSocket stream resubscribes from a variable-backed query, the
useful question is:

```text
Which variables exist in this workspace right now, what are their current values, and who consumes
them?
```

The existing request/debug rail is a good interaction reference: it is a workspace-level inspection
surface, not a widget settings panel. The Variable Explorer should follow that model.

## Decision

Add a workspace-level Variable Explorer rail.

The Variable Explorer shows only:

- variables currently present in the workspace variable store
- variable references that are actively used by saved widget bindings or reference expressions

It must not show:

- every possible widget output
- every possible nested runtime-state path
- all discoverable values from the binding picker
- unused source-output candidates

This surface is for runtime/debug visibility, not reference authoring.

## Data Model

### Variable Store Entries

For variables that exist in the runtime variable store, the explorer should show:

- source widget title and instance id
- source output id
- transform signature, if any
- normalized variable id
- current value preview
- source contract
- consumers that currently depend on the variable
- update freshness, when available

The value preview should be readable and safe:

- scalars show directly
- arrays and objects show a compact JSON preview with expandable details
- large values are truncated by default
- unavailable values show an explicit empty/waiting state

### Referenced Variables

For variables that are referenced by widget bindings but not currently present in the variable
store, the explorer should show a separate referenced/waiting state.

Examples:

- a downstream connection query references `$(Table).activeCellValue`, but no table cell is active
- a title references `$(AssetScreener).activeRow.Symbol`, but the screener has no active row
- a WebSocket source depends on a variable that has not resolved yet

These entries are important because they explain why a downstream widget is waiting, but they must
not be confused with successfully materialized variable values.

## UI Placement

The Variable Explorer should be a workspace right-side rail, similar to the request/debug rail.

It should be opened from a dedicated icon in the workspace navigation bar. That icon must be
visible in both edit mode and view mode because variables are part of runtime understanding, not
only authoring. In view mode the explorer is read-only, just like the variable store it inspects.

It should be available in both canvas and graph contexts. It should not be embedded inside
individual widget settings because it describes workspace-level runtime state and cross-widget
dependencies.

The rail should support:

- grouped sections for `Current variables` and `Referenced variables`
- search/filter by widget title, output id, target widget, or token text
- expandable value details
- consumer list per variable
- copyable reference token or normalized id
- clear user-facing states for `ready`, `waiting`, `stale`, and `error` where those states can be
  inferred

## Behavior

### Current Variables

The explorer reads from the same variable store used by runtime variable commits and reference
resolution.

If a user clicks a table row and the variable store updates from `BTCUSDT` to `ETHUSDT`, the
explorer should update immediately and show the current value.

### Referenced Variables

The explorer also reads saved widget bindings/reference expressions to identify variables that are
actively referenced.

This is a filtered view of real dependencies. It is not a discovery catalog.

### No New Runtime Ownership

The explorer must be passive.

It must not:

- create variables
- mutate widget runtime state
- execute widgets
- refresh widgets
- open WebSocket streams
- write workspace storage

It should only explain the current state of the variable store and reference graph.

## Storage And Backend Contract

No backend contract change is required.

The Variable Explorer is a frontend inspection surface over existing runtime state and saved widget
bindings. It should not introduce a new persisted workspace field or backend API payload.

If a future iteration adds user-saved filters or pinned explorer layout, that should be stored as
per-user workspace UI state, not as shared workspace content.

## Implementation Tasks

### Data Source

- [x] Reuse the existing workspace variable store as the source for current variable entries.
- [x] Reuse the existing dependency/reference graph to derive actively referenced variables.
- [x] Build one normalized explorer model that separates materialized variables from referenced but
  unresolved variables.
- [x] Include consumers per variable, including target widget id, target kind, target input id, and
  prop path when available.
- [x] Add compact value serialization for scalar, array, object, null, and unavailable values.

### UI Surface

- [x] Add a workspace-level Variable Explorer rail beside the existing debug/request tooling.
- [x] Add a dedicated Variable Explorer icon to the workspace navigation bar.
- [x] Ensure the navigation-bar icon is visible in both workspace edit mode and workspace view mode.
- [x] Ensure the explorer opens from canvas mode.
- [x] Ensure the explorer opens from graph mode.
- [x] Keep the explorer read-only in both edit and view mode.
- [x] Group entries into `Current variables` and `Referenced variables`.
- [x] Add search/filter over source widget, output id, target widget, and token text.
- [x] Render current values with safe truncation and expandable JSON details.
- [x] Render unresolved references with a clear waiting state and consumer list.

### Guardrails

- [x] Do not show all possible source widget outputs.
- [x] Do not reuse the reference authoring picker as the explorer body.
- [x] Do not mutate widget props, bindings, runtime state, or workspace storage from the explorer.
- [x] Do not trigger graph execution, refresh, or stream resubscription from the explorer.
- [x] Keep user-facing copy focused on variables and values, not internal implementation names.

### Verification

- [x] Add tests for explorer model construction from variable store entries.
- [x] Add tests for referenced-but-unresolved variables.
- [x] Add tests proving unused possible outputs do not appear.
- [x] Add tests for consumer grouping and value preview truncation.
- [ ] Manually verify a table selection variable updates live in the explorer.
- [ ] Manually verify a waiting connection/WebSocket reference appears as unresolved.

## Consequences

### Benefits

- Users can see the actual values driving workspace variables.
- Debugging variable-backed queries, titles, and stream subscriptions becomes direct.
- The explorer avoids the noise of showing every possible output/path.
- The UI reinforces the difference between reference authoring and runtime inspection.

### Tradeoffs

- The explorer depends on the variable store and dependency graph staying aligned.
- Unresolved referenced variables need careful copy so users understand that the reference exists
  but has no current value.
- Large object values require truncation and expansion behavior to avoid making the rail unusable.

### Non-Goals

- This ADR does not add a new variable authoring language.
- This ADR does not add a global variable registry.
- This ADR does not persist variable explorer state into shared workspace content.
- This ADR does not replace the binding/reference picker.
