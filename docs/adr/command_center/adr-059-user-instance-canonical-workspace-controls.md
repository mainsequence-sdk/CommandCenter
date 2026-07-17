# ADR 059: User-Instance Canonical Workspace Controls

- Status: Proposed
- Date: 2026-05-12
- Related:
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
  - [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
  - [ADR 038: Progressive Workspace Initial Rendering and Per-Widget Hydration](./adr-038-progressive-workspace-widget-hydration.md)
  - [ADR 040: Dashboard Surface Return Hydration](./adr-040-dashboard-surface-return-hydration.md)

## Context

Workspace control state is currently split across two overlapping representations:

- shared workspace `dashboard.controls`
- per-user workspace user-state `selectedControls`

That split exists in the right places conceptually, but the current implementation still mixes the
two at runtime:

- live time-range and refresh selections are written back into `dashboard.controls`
- user-state hydration is optional instead of canonical
- workspace load can still fall back to control defaults when no hydrated user-state selection is
  present yet
- local user-state updates currently mutate both saved and draft workspace maps, which blurs
  shared workspace content and per-user state

This creates buggy behavior:

- the active selected range and refresh interval can drift back to defaults
- the base workspace can leak into the current user's active workspace instance
- user-state can be treated as an overlay instead of the canonical active control state
- reopening the same workspace can restore a different control state than the one the user last set

The required workflow is stricter:

1. if the user changes refresh interval or time range in workspace edit mode, that update must hit:
   - the base workspace seed configuration
   - the current user's workspace instance
2. whenever a workspace loads, it must always resolve active controls from the user instance
3. the runtime must never silently fall back to generic defaults for an already-addressable backend
   workspace route
4. if a user instance does not exist yet for that workspace, create it from the base workspace
   control seed first, then load active controls from that user instance

This ADR uses `user instance` to mean the per-user state record for one workspace. It does not
introduce a separate global cross-workspace user preference model.

## Decision

The current user's workspace instance becomes the canonical source of active workspace control
state.

`dashboard.controls` remains part of the shared workspace document, but only as:

- control capability/configuration
- control seed values for first-time user-instance creation

The active selected values:

- `timeRangeKey`
- `rangeStartMs`
- `rangeEndMs`
- `refreshIntervalMs`

must be treated as user-instance-owned state after hydration.

The runtime must not use shared workspace defaults as a fallback active selection for a backend
workspace once that workspace id is known.

## Shared vs User-Owned Semantics

### Shared Workspace Owns

The shared workspace document owns:

- whether controls are enabled
- available time-range options
- available refresh intervals
- the base seed selection copied into a missing user instance
- all non-user-scoped workspace structure and widget definitions

### User Instance Owns

The workspace user-state record owns:

- the active selected time range
- the active selected custom range bounds
- the active selected refresh interval
- widget runtime state already scoped to the current user/session view

After hydration, these values are canonical for runtime and authoring surfaces.

## Load Workflow

The load workflow becomes:

1. fetch the shared base workspace document
2. fetch the current user's workspace-instance state for that workspace
3. if the user-state record does not exist:
   - build a user-state record from the shared workspace control seed
   - persist that user-state record
   - use that persisted record as the canonical active state
4. hydrate the selected workspace draft from:
   - shared workspace structure
   - user-instance selected controls
   - user-instance widget runtime state
5. mount workspace controls from the hydrated user-instance selection only

The important hardening rule is:

- runtime must not mount from generic control defaults while waiting for whether user-state exists
- runtime must resolve through the user-instance path first

## Edit Workflow

When a user edits refresh or time range in workspace edit mode, the system must perform two
separate writes with separate ownership:

1. update the shared workspace control seed
2. update the current user's workspace-instance active selection

These are not the same state even when they happen from one UI action.

The shared write affects:

- what a first-time user instance will inherit later
- what the workspace author intends as the seed configuration

The user-instance write affects:

- what this current user sees immediately
- what this current user gets when they reopen the workspace later

The implementation must not satisfy both semantics by reusing one object that mixes shared seed
fields and active user selection fields indiscriminately.

## No Runtime Default Fallback For Backend Workspace Routes

For backend-backed workspaces, generic control defaults such as `"15m"` or `1800000` are allowed
only as:

- framework-level empty initialization before any workspace id exists
- seed normalization when creating a brand-new shared workspace document

They are not allowed as the active fallback for an existing backend workspace route during normal
load.

If the app can identify a workspace id, it must resolve:

- shared workspace
- user-instance state

before treating the control state as authoritative.

## Consequences

### Positive

- active controls become deterministic per user and per workspace
- reopening a workspace restores the same user-scoped range and refresh selection
- shared workspace seeds stay distinct from active user selections
- control-state bugs become easier to reason about because ownership is explicit

### Costs

- control-state persistence/hydration becomes a stricter two-record workflow
- edit-mode control changes now require coordinated shared-workspace and user-instance updates
- backend user-state semantics must distinguish missing state from empty state
- migration is required for older workspaces that still store active selected controls in the
  shared document shape

## Implementation Tasks

- [ ] Define one canonical ownership rule in code comments and docs: shared workspace controls are seed/config only, user-instance controls are active runtime state.
- [ ] Audit all reads of `dashboard.controls.timeRange.selectedRange`, `customStartMs`, `customEndMs`, and `refresh.selectedIntervalMs` and classify each call site as shared-seed logic or active-user-state logic.
- [ ] Stop treating active selected control values as part of the authoritative shared workspace state after hydration.
- [ ] Refactor `updateWorkspaceUserState(...)` in [custom-workspace-studio-store.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/custom-workspace-studio-store.ts) so it no longer mutates `savedWorkspaceById` as if user-state were shared workspace content.
- [ ] Keep user-state updates scoped to the hydrated selected draft projection plus user-state revision bookkeeping.
- [ ] Refactor workspace load in [custom-workspace-studio-store.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/custom-workspace-studio-store.ts) so base workspace detail and user-state are resolved as one canonical hydration workflow instead of “base first, user overlay if present”.
- [ ] Treat a missing workspace user-state record as a first-class branch, not as equivalent to “no selected controls”.
- [ ] On missing user-state, derive a new user-instance selected-controls snapshot from the shared workspace control seed.
- [ ] Persist that synthesized user-state record before marking the workspace as fully hydrated.
- [ ] Hydrate the runtime-selected workspace from the persisted user-instance state, not from shared control defaults.
- [ ] Remove runtime fallback behavior that treats `DashboardControls.tsx` defaults as acceptable active selections for an already-addressable backend workspace.
- [ ] Ensure [DashboardControls.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/dashboards/DashboardControls.tsx) mounts backend workspaces from hydrated user-instance selection and does not silently revert to generic defaults once a workspace id exists.
- [ ] Keep framework-level defaults only for blank/new local initialization before any workspace hydration path exists.
- [ ] Separate “shared control seed update” from “current user active selection update” in the edit-mode controls flow.
- [ ] Update [useCustomWorkspaceStudio.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/useCustomWorkspaceStudio.ts) so committing controls writes the user-instance state canonically and coordinates any required shared-workspace seed update through a separate explicit path.
- [ ] Review [custom-dashboard-storage.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/custom-dashboard-storage.ts) `updateDashboardControlsState(...)` and either restrict it to shared seed authoring or split it into separate shared-seed and active-selection helpers.
- [ ] Update [workspace-user-state.ts](/Users/jose/code/MainSequenceClientSide/CommandCenter/src/features/dashboards/workspace-user-state.ts) helpers so extract/apply logic reflects the new ownership model and does not blur shared seed with active user selection.
- [ ] Decide whether the current shared `controls` shape remains the seed carrier or whether a dedicated seed-only subshape is needed for clarity.
- [ ] If a dedicated shared seed shape is introduced, assess and document the backend workspace payload contract change before implementation.
- [ ] If the current `controls` shape is retained temporarily, document which fields are seed-only versus active-user-state-only during migration.
- [ ] Add migration logic for older workspace payloads that still embed live selected control values in the shared workspace document.
- [ ] Ensure save flows persist shared workspace structure separately from workspace user-state, even when one UI action updates both ownership layers.
- [ ] Ensure workspace reopen always prefers the hydrated user-instance state over shared workspace seed values.
- [ ] Ensure switching between users cannot leak one user's control selection into another user's workspace instance.
- [ ] Add regression tests for:
  - existing user-state load
  - missing user-state creation from shared seed
  - custom-range persistence
  - refresh-interval persistence
  - reopen behavior
  - user switch isolation
  - edit-mode dual write semantics
- [ ] Update [src/features/dashboards/README.md](https://github.com/mainsequence-sdk/CommandCenter/blob/main/src/features/dashboards/README.md) and any nearby workspace persistence docs to describe the hardened ownership and load workflow.

## Backend Contract Impact

This is a backend-relevant contract hardening, not a frontend-only cleanup.

The frontend can keep using the existing workspace detail endpoint plus workspace user-state
endpoint only if the backend semantics support all of the following clearly:

- shared workspace detail returns shared/base workspace content
- user-state fetch distinguishes a missing user record from a valid empty state
- user-state mutation can create the user-instance record deterministically
- shared workspace save and user-state save remain independent operations

If the current backend user-state endpoint cannot distinguish “missing record” from “empty state”
or cannot reliably create the per-user workspace instance on first access, backend work is required
before this ADR can be fully implemented.

This ADR does not introduce a new global user-default workspace-controls endpoint. The user
instance remains workspace-scoped.
