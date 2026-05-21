# ADR 071: Atomic Widget Settings Workspace Save

- Status: Proposed
- Date: 2026-05-21
- Related:
  - [ADR 060: Instant Widget Settings Runtime](./adr-060-instant-widget-settings-runtime.md)
  - [ADR: Shared Workspace Content vs Per-User View State](./adr-shared-workspace-state.md)
  - [ADR: Incremental Workspace Normalization and Resource-Scoped Save](./adr-incremental-workspace-normalization.md)
  - [ADR: Preview-Only Demo Drafts for Widget Settings](./adr-widget-settings-demo-preview-draft.md)

## Context

Widget settings are edited from a dedicated settings surface inside Workspace Studio. A user can
change a chart, table, connection, or other widget, click `Save settings`, then click
`Save workspace`, and later return to the workspace expecting the backend to contain the exact
settings they just saved.

The current flow does not make that guarantee obvious enough:

- `Save settings` commits the widget edit into the local workspace draft only.
- `Save workspace` persists the current workspace draft, but it does not flush unsaved local
  widget-settings form state before saving.
- The widget settings commit path can build the next workspace from the rendered
  `selectedDashboard` snapshot instead of the latest store draft.

That creates a user-visible failure mode where the settings page appears saved, but returning to
the workspace can show older settings because the backend was saved from a stale or incomplete
workspace draft.

## Problem

Widget settings and workspace persistence are currently treated as two separate user actions.
That separation is too fragile for settings pages.

The specific risks are:

- a user changes widget settings but only clicks the page-level `Save workspace`, so local
  settings draft state may never be committed into the workspace draft
- a user clicks `Save settings`, receives a success toast, but the backend has not been updated yet
- the workspace save can persist an older draft if the widget settings commit used a stale
  rendered workspace snapshot
- navigation back to the workspace can reload the backend state and make the page look like it
  overwrote the user's latest settings

## Decision

Make widget settings save atomic from the user's perspective.

`Save settings` must commit the active widget settings into the latest workspace draft and then
persist that same updated workspace to the backend. The success state should only be shown after
both steps succeed.

The implementation should introduce one workspace-store operation for this shape:

```text
commit workspace draft update -> persist the same updated workspace -> replace saved/draft state
```

The operation must not depend on a rendered `selectedDashboard` closure after the user has started
editing. It should apply the widget settings update against the latest workspace draft held by the
store.

The top-level `Save workspace` button on a widget settings surface must also account for active
settings form state. It should either flush the active settings draft before saving, or be replaced
by a clearer settings-aware save action so it cannot persist a stale workspace while local form
edits are still pending.

## Expected Behavior

- Clicking `Save settings` on a chart persists the chart settings to the backend.
- Clicking `Save settings` shows success only after backend persistence succeeds.
- If backend persistence fails, the widget settings remain dirty and the user sees a failure toast.
- Returning to the workspace after a successful widget settings save shows the saved settings.
- Reloading the workspace from the backend after a successful save shows the saved settings.
- The workspace dirty badge is cleared only when the persisted backend workspace matches the saved
  draft revision.
- Runtime-only updates remain separate from authored workspace changes.

## Storage And Backend Contract

No backend contract change is expected.

The existing workspace detail save endpoint remains the persistence boundary:

```text
PUT /workspaces/:id/
```

The frontend should continue sending the full shared workspace payload through the existing
workspace mutation serializer. Runtime user state and public execution details must continue to be
stripped from shared workspace saves.

If implementation discovers that the backend response omits or normalizes widget settings fields
that the frontend expects to preserve, that should be escalated as a backend serializer issue.

## Implementation Tasks

### Store Contract

- [ ] Add a store-level operation that applies a workspace draft updater and immediately persists
  the resulting workspace snapshot.
- [ ] Ensure the operation reads the latest `draftWorkspaceById[workspaceId]` before applying the
  updater.
- [ ] Ensure the operation persists the exact updated workspace snapshot, not a later closure copy
  and not the previous `selectedDashboard`.
- [ ] Reuse the existing save normalization path so saved workspace state, draft workspace state,
  list summary, dirty flags, and revision counters stay consistent.
- [ ] Keep the operation scoped to one workspace id.

### Widget Settings Save

- [ ] Change `Save settings` in the dedicated widget settings page to call the atomic store
  operation.
- [ ] Build the widget update from the active settings draft: title, props, bindings, and
  presentation.
- [ ] Apply widget settings against the latest workspace draft.
- [ ] Preserve existing variable-driven commit behavior after the workspace draft is updated.
- [ ] Preserve executable source refresh behavior after settings changes that affect executable
  sources.
- [ ] Show the success toast only after backend persistence completes.
- [ ] Show an error toast when backend persistence fails and keep the workspace dirty.
- [ ] Update settings-page copy so it no longer says `Save settings` only updates a local draft in
  backend mode.

### Page-Level Save From Settings

- [ ] Make the settings page `Save workspace` action settings-aware.
- [ ] If the settings form has unsaved local edits, flush those edits into the workspace draft
  before saving.
- [ ] Avoid saving a stale workspace when the form draft differs from the persisted widget
  instance.
- [ ] Consider whether the page needs one primary `Save settings` action instead of two competing
  save actions.

### Navigation And Reload Safety

- [ ] Await the atomic settings save before navigating back to the workspace when save-and-return
  behavior is introduced.
- [ ] Ensure loading workspace detail from the backend does not replace a newer dirty draft with an
  older backend response.
- [ ] Ensure successful saves replace both saved and draft workspace state with the backend
  normalized response only when draft revisions still match.
- [ ] Keep per-user runtime state saves separate from shared widget settings saves.

### Verification

- [ ] Add a test where chart settings are edited and `Save settings` sends the changed widget props
  in the workspace `PUT` payload.
- [ ] Add a test where the top-level `Save workspace` button on the widget settings page flushes
  active local form edits before persisting.
- [ ] Add a test proving widget settings save applies against the latest store draft, not a stale
  rendered workspace snapshot.
- [ ] Add a test proving failed backend save leaves the workspace dirty and shows an error state.
- [ ] Manually verify: edit chart settings, click `Save settings`, return to workspace, refresh the
  page, and confirm the chart keeps the updated settings.
- [ ] Manually verify: edit chart settings, click page-level `Save workspace`, return to workspace,
  refresh the page, and confirm the chart keeps the updated settings.

## Consequences

### Benefits

- Widget settings save becomes aligned with user expectations.
- Settings-page success feedback means the backend is actually persisted.
- Stale workspace snapshots are less likely to overwrite newer edits.
- Returning to a workspace after editing a widget no longer appears to restore previous state.

### Tradeoffs

- `Save settings` becomes an async persistence operation instead of a local draft-only commit.
- Widget settings pages need clearer pending and failure states.
- Existing tests that assumed settings save is local-only must be updated.

### Non-Goals

- This ADR does not change the backend workspace payload shape.
- This ADR does not merge runtime user state into shared workspace saves.
- This ADR does not change public workspace rendering.
- This ADR does not redesign widget settings UI beyond making save behavior safe and clear.
