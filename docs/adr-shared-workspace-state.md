# ADR: Shared Workspace Content vs Per-User View State

- Status: Proposed
- Date: 2026-03-21

## Context

The current frontend `Workspaces` implementation stores everything in one browser-local workspace
document, including:

- metadata such as title, description, and labels
- grid layout and widget configuration
- selected controls state
- widget runtime state such as zoom, pan, selected node, and minimap visibility

That approach works for single-user browser-local development, but production workspaces are
expected to be:

- shared across users
- editable by users with `can_edit`
- readable by users with `can_view`
- copyable for reuse and templating

If all state is stored in one shared document, personal interactions would overwrite each other.

Examples:

- one user changing the date range would change it for everyone
- one user panning or zooming a graph would overwrite another user's view
- one user selecting a node in a graph would change the open context for all viewers

## Decision

We split workspace persistence into four concepts:

1. `Workspace`
   Store shared, collaborative workspace content only:
   - title
   - description
   - labels
   - grid
   - shared controls configuration
   - widgets
   - widget props

2. `WorkspaceUserState`
   Store personal, non-collaborative view state:
   - selected control values
   - widget runtime state
   - last-opened view
   - last-opened timestamp

3. `WorkspaceUserGrant` and `WorkspaceTeamGrant`
   Store object-level access with `view` / `edit` semantics for direct users and teams.

4. `WorkspaceRevision`
   Store immutable shared-content snapshots for:
   - copy
   - import/export
   - history
   - recovery

## Why we are doing it this way

### Shared objects should share content, not temporary viewport state

The workspace itself is a collaborative artifact. Widget configuration, layout, labels, and
metadata are part of the shared artifact and should be visible to everyone with access.

But temporary viewport choices are not collaborative content. They are personal interaction state.

Putting both categories in the same stored document would create false collaboration and constant
last-write-wins conflicts.

### The frontend model already distinguishes durable config from runtime state

The widget contract already separates:

- widget `props`
- widget `runtimeState`

That same distinction should exist in the backend. `props` belong to the shared workspace content;
`runtimeState` belongs to the user's current view of that content.

### Workspaces need object-level sharing

Production workspaces are not just user preferences. They are shareable objects with RBAC.

That means the backend must support:

- direct user grants
- team grants
- `view` vs `edit` access levels

This is much easier to query, audit, and maintain with explicit grant tables than with a single
opaque JSON ACL field.

### Copy and history need immutable snapshots

Copying a workspace should copy the shared content only.

It should not copy:

- another user's transient zoom/pan
- another user's current selected date range
- another user's current graph selection

Using `WorkspaceRevision` snapshots keeps copy/import/history aligned around one shared-content
representation.

## Consequences

### Positive

- shared workspace edits are deterministic
- personal viewing state no longer clobbers collaborators
- copy/import/export become clean shared-content operations
- RBAC stays explicit and queryable
- revision history becomes straightforward

### Tradeoffs

- backend APIs must load and save two state categories instead of one
- the application layer must validate JSON document structure for widgets and controls
- effective permission resolution must combine direct user grants and team grants

## Non-decisions

This ADR does not decide:

- whether workspaces are version-published or autosaved
- whether revisions are created on every save or only on major events
- whether favorites belong in the workspace API or in the general shell preferences API

## Rejected alternatives

### Store everything in one shared workspace row

Rejected because it makes temporary per-user interactions collaborative by accident.

### Do not store any per-user workspace state

Rejected because it would force every user to lose useful personal viewing state across sessions,
even though that state clearly exists and is meaningful in the frontend.

### Normalize every widget instance into relational tables

Rejected for v1 because widget props and runtime state are heterogeneous by widget type, and the
workspace is already treated as a document in the frontend and import/export flow.
