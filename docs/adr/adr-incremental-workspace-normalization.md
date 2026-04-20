# ADR: Incremental Workspace Normalization and Resource-Scoped Save

- Status: Proposed
- Date: 2026-04-03
- Related:
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
  - [Workspace Runtime Performance Remediation](../workspaces/runtime-performance-remediation.md)

## Context

The Workspaces feature currently pays too much synchronous client-side cost before a save request is
sent.

Two problems are coupled together:

1. save has historically been treated as a full-collection synchronization problem instead of a
   resource-scoped workspace save
2. normalization/migration work is still too concentrated on the save path

That creates the wrong runtime behavior for the normal user action:

- the user is editing one selected workspace
- the UI says `Save workspace`
- but the client can still spend significant time serializing, normalizing, and reconciling more
  state than the selected workspace actually needs

The deeper architectural issue is that `normalizeDashboardDefinition(...)` currently carries too
many responsibilities:

- migrate legacy persisted workspace shapes
- sanitize current workspace structure
- materialize layout defaults
- repair partially normalized widget instances

Those responsibilities are all valid, but they should not all happen on the hot path every time the
user clicks save.

## Problem

The current save-time approach has three bad properties:

1. it is late
   Save is doing structural cleanup after the user is already waiting for the request to leave the
   browser.

2. it is global
   The code tends to normalize larger workspace structures than the user actually changed.

3. it is mixed-purpose
   Legacy migration and cheap canonical sanitization are treated as the same operation.

This makes save slower, harder to reason about, and harder to debug when the request does not even
reach the backend immediately.

## Decision

We will move the workspace model toward:

1. resource-scoped persistence
2. canonical draft state
3. incremental normalization
4. cheap save-time sanitization

### 1. Save is resource-scoped

Normal workspace save must operate on the selected workspace only.

That means:

- `POST /workspaces/` for create
- `PUT /workspaces/:id/` for save/update
- `DELETE /workspaces/:id/` for delete

The normal `Save workspace` action must not perform full-collection reconciliation first.

### 2. Draft state should stay close to canonical

The workspace draft stored in the client should already be in near-persisted shape.

Mutation helpers should return canonical data for the part they touch instead of letting malformed
or legacy-compatible intermediate shapes accumulate until save.

### 3. Migration and sanitization are separate concerns

We will split the current normalization intent into two layers:

- `migrateDashboardDefinition(...)`
  Handles legacy persisted shapes and one-time structural upgrades.
- `sanitizeDashboardDefinition(...)`
  Applies cheap canonical cleanup for the current schema.

Migration is for:

- load from backend
- load from local storage
- JSON import

Sanitization is for:

- mutation helper boundaries
- final save-time cleanup

### 4. Save-time work must be lightweight and idempotent

By the time the user clicks save, the selected workspace should already be mostly canonical.

The save path should do only:

1. fetch selected draft workspace
2. run cheap `sanitizeDashboardDefinition(...)`
3. serialize once
4. send request
5. merge backend response

It must not perform broad migration or whole-collection repair work.

## Implementation Guidance

### Mutation boundaries

Helpers that update workspace content should sanitize the changed slice immediately.

Examples include:

- widget settings updates
- bindings updates
- widget runtime-state updates
- row collapse/expand operations
- committed layout writes
- companion layout updates

The principle is:

- normalize early
- normalize locally
- preserve structural sharing for unchanged branches

### Store initialization

When a workspace collection is loaded, workspaces should be migrated once before entering the draft
store.

After load, the editor should operate on canonical workspace objects rather than repeatedly
re-migrating them on save.

### Save path

The save path should be resource-scoped and small:

- selected workspace only
- no collection diff
- no whole-collection serialization
- no legacy migration pass

### Local mode and backend mode

Both persistence modes should follow the same conceptual model:

- save one workspace
- update saved state for that workspace
- keep collection metadata such as `savedAt`

The difference should only be the transport:

- local storage write
- backend `PUT`

## Consequences

### Positive

- save requests leave the browser faster
- save behavior matches the UI action the user actually invoked
- normalization becomes easier to reason about and profile
- legacy migration remains supported without polluting the hot path
- draft state is more stable and predictable across canvas, graph, and settings surfaces

### Negative

- mutation helpers must take on stricter responsibility for returning canonical state
- the storage layer will need a clearer split between migration and sanitization helpers
- some existing broad normalization helpers may need to be decomposed before the architecture is
  fully clean

## Non-Goals

This ADR does not require:

- removing all normalization from the frontend
- sending arbitrary unsanitized draft JSON to the backend
- changing the backend workspace schema

The goal is not to skip canonicalization. The goal is to do it at the right boundaries and at the
right cost.

## Follow-Up Work

1. Introduce `migrateDashboardDefinition(...)` and `sanitizeDashboardDefinition(...)`
2. Migrate workspaces once at load/import time
3. Update mutation helpers to sanitize only the changed slice
4. Keep save-time normalization cheap and resource-scoped
5. Remove remaining deep full-workspace repair from normal save flows
