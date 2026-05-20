# ADR 069: Canonical Effective Widget State Across Runtime Surfaces

- Status: Proposed
- Date: 2026-05-20
- Related:
  - [ADR 058: Cross-Widget References And Variables](./adr-058-cross-widget-references-and-variables.md)
  - [ADR 060: Instant Widget Settings Runtime](./adr-060-instant-widget-settings-runtime.md)
  - [ADR 064: Variable References as Widget Graph Edges](./adr-064-variable-reference-graph-integration.md)

## Context

Command Center currently resolves reference-backed widget state in more than one way.

For executable widgets such as `connection-query`, the execution provider resolves bindings into
effective props before deciding whether the widget can execute and before building the backend
request.

For self-owned runtime widgets such as `connection-stream-query`, the runtime mount currently starts
from the mounted widget props on the dashboard surface. Hidden and sidebar-only widgets are mounted
from persisted widget instances, which means they can observe raw saved props instead of the same
graph-resolved effective props used by executable widgets.

This creates a shared-contract mismatch:

- the graph and bindings say a variable-backed source is valid
- HTTP execution paths can work because they resolve effective props through the graph
- WebSocket runtime owners can fail because they subscribe from unresolved or stale mounted props
- widget settings and preview surfaces can also diverge when they rebuild from a different runtime
  source than the main workspace surface

The problem becomes visible when a widget depends on selection-backed variables such as:

- `$(Table).activeRow.symbol`
- `$(Table).activeCellValue`
- `$(Asset Screener).selectedRows`

Those values are runtime-derived, not persisted authoring props. If they are available only in a
page-local canvas state, then switching surfaces such as:

- dashboard
- widget settings
- graph
- hidden sidebar runtime mounts

can make the same binding appear valid in one place and empty in another.

That is not scalable. The platform needs one canonical answer for:

- what a widget's effective title is
- what a widget's effective props are
- whether a reference-backed input is unresolved
- whether a runtime owner should execute, subscribe, or wait

## Decision

### 1. Effective widget state becomes a first-class graph contract

For every widget instance, Command Center must resolve one canonical effective widget state from:

- persisted instance title
- persisted instance props
- persisted bindings
- resolved graph inputs
- runtime-backed reference outputs

That effective state must include at least:

- `effectiveTitle`
- `effectiveProps`
- `resolvedInputs`
- `unresolvedReferencePaths`
- `rawTitle`
- `rawProps`

This is the canonical widget state for runtime and settings behavior. Widgets must not invent local
alternative resolution rules.

### 2. All runtime owners must consume canonical effective state

Every widget runtime owner must read from the same canonical effective state, not directly from raw
persisted props.

This applies to:

- executable widgets driven through the graph runner
- self-owned runtime widgets such as `connection-stream-query`
- hidden and sidebar-only widget mounts
- visible widget mounts
- widget settings previews
- route-level widget settings surfaces
- graph route previews and diagnostics

The platform must not have one prop-resolution contract for HTTP widgets and another for WebSocket
widgets.

### 3. Hidden and sidebar widgets are graph participants, not special prop islands

Hidden widgets and sidebar-only widgets exist for execution ownership and dependency publication,
not as isolated local components.

Their mounted runtime must observe the same effective state that the graph execution layer sees.

That means:

- a hidden `connection-stream-query` bound to `$(Table).activeRow.symbol` must subscribe using the
  resolved symbol value when available
- the same widget must wait with a clear unresolved state when the symbol is not available
- the same binding must not behave differently just because the widget is mounted offscreen

### 4. Unresolved references must be explicit runtime state, not silent emptiness

When a widget depends on a reference-backed value that is not currently satisfiable, the runtime
owner must not silently degrade to a misleading empty configured state.

Instead, the platform should produce a canonical unresolved/waiting state such as:

- awaiting upstream
- waiting for referenced value
- waiting for `activeRow.symbol`

This rule applies equally to:

- query execution
- WebSocket subscription startup
- settings previews
- source-binding previews

### 5. Selection-backed variables are workspace runtime state, not canvas-local implementation detail

Selection-derived outputs such as:

- `activeRow`
- `activeCell`
- `activeCellValue`
- `selectedRows`
- `selectedCellValues`

must be treated as shared workspace runtime state.

They may originate from a visible interactive widget, but once published they must remain available
to the dependency graph across workspace surfaces as long as the owning widget runtime state remains
valid.

Surface transitions must not arbitrarily clear or fork that state between:

- dashboard view
- dashboard edit mode
- widget settings route
- graph route

### 6. Settings surfaces must reuse the canonical runtime/dependency model

Widget settings must not reconstruct a separate notion of reference-backed truth just to preview a
widget.

Settings surfaces may still stage local draft props and draft bindings, but they must layer those
drafts on top of the same canonical workspace dependency/runtime state.

That means:

- draft widget edits can override the target widget being edited
- upstream widgets and upstream runtime-backed variables must still come from the shared workspace
  dependency/runtime model
- settings preview logic must not become a second runtime contract

### 7. The fix is frontend-runtime architecture, not backend contract change

This decision does not require a backend payload or API contract change.

The issue is caused by inconsistent frontend ownership of:

- reference resolution
- hidden widget runtime mounts
- surface-level runtime continuity

Backend connection query and WebSocket subscription contracts remain unchanged. The frontend must
present one consistent effective widget state to every runtime owner.

## Consequences

### Benefits

- Variable-backed HTTP and WebSocket sources follow the same runtime contract.
- Hidden source widgets behave like normal graph participants instead of special-case mounts.
- Widget settings, dashboard, and graph routes stop disagreeing about whether a binding is ready.
- Future self-owned runtime widgets can reuse the same effective-state contract without new
  one-off fixes.

### Costs

- The workspace runtime/dependency layer must own more canonical state explicitly.
- Hidden/sidebar mount paths will need to stop reading raw props directly.
- Settings preview and route-level runtime composition will need to be aligned with the shared
  effective-state model.

### Non-goals

- This ADR does not define the exact implementation sequence.
- This ADR does not change backend WebSocket or query payload contracts.
- This ADR does not require selection state to persist forever; it requires consistent ownership and
  surface continuity while the workspace runtime is active.
