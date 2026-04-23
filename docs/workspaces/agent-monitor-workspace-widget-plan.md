# Main Sequence AI Workspace Reference Widget Plan

## Goal

Add a new `Main Sequence AI` widget titled `WorkspaceReference` that publishes one bindable workspace
reference shaped exactly as:

```json
{ "id": "<workspace-id>" }
```

The widget is intentionally small. It is a selector and reference publisher, not a snapshot widget,
not an embedded workspace viewer, and not a cross-workspace sync mechanism.

## Recommended Contract

- Display title: `WorkspaceReference`
- Stable widget id: `main-sequence-ai-workspace`
- Folder: `extensions/main_sequence_ai/widgets/workspace/`
- Authored props:
  - `workspaceId?: string`
- Inputs:
  - none
- Output:
  - output id: `workspace-reference`
  - contract: `main-sequence-ai.workspace-reference@v1`
  - value: `{"id": "<workspace-id>"}`

Keep the contract extension-local for the first slice. The current use case is specific to Main
Sequence AI and does not justify promoting a new core widget contract yet.

## Authoring Rules

- The widget must never allow selecting the current workspace as its target.
- The settings picker should exclude the current workspace id from the candidate list.
- The widget should also validate the saved prop at runtime and publish no output when:
  - no workspace is selected
  - the selected workspace equals the current workspace
  - the selected workspace is no longer present in the accessible workspace list

That double guard matters because invalid state can still arrive through raw JSON edits, saved-widget
imports, or old persisted data.

## Availability

The widget should be registered as a normal `Main Sequence AI` workspace widget.

Implementation path:

1. add the widget to `extensions/main_sequence_ai/index.ts`
2. let the shared workspace studio catalog surface it through normal extension widget registration
3. also add the widget id to `agentMonitorWorkspaceStudioConfig.allowedWidgetIds`

This keeps the widget broadly usable in any Main Sequence AI workspace while still making it part
of the curated `Agents Monitor` authoring surface.

## Agent Binding Compatibility

This is the main architectural dependency.

`Agent Terminal` now accepts:

- input id: `upstream-context`
- contracts:
  - `core.widget-agent-context@v1`
  - `main-sequence-ai.workspace-reference@v1`

Implementation rules:

- keep workspace references separate from snapshot-derived widget context
- serialize workspace references into the refresh request as explicit workspace ids, not as fake
  widget snapshots

Do not force the `WorkspaceReference` widget to masquerade as `core.widget-agent-context@v1`. A workspace
pointer is not a live widget snapshot, and wrapping it in the snapshot contract would misrepresent
the data.

## UX Shape

The widget body can stay simple but should still be useful:

- show the selected workspace title when it can be resolved from workspace summaries
- show the raw workspace id for auditability
- show an invalid/empty state when no target is selected
- optionally expose an `Open workspace` link when route rules allow it

The runtime does not need editable rich behavior. Standard settings-based authoring is enough.

## Data Source For The Picker

Prefer `useCustomWorkspaceStudio()` for:

- current workspace id
- already-loaded `workspaceListItems`

But do not assume the list is always present. In backend mode, direct workspace routes can load the
selected workspace detail without preloading the full workspace list.

So the settings component should:

1. use the in-memory `workspaceListItems` when available
2. otherwise trigger a lightweight workspace-summary fetch through the shared workspace persistence
   API before rendering the final picker

## File Plan

### New widget files

- `extensions/main_sequence_ai/widgets/workspace/README.md`
- `extensions/main_sequence_ai/widgets/workspace/USAGE_GUIDANCE.md`
- `extensions/main_sequence_ai/widgets/workspace/definition.ts`
- `extensions/main_sequence_ai/widgets/workspace/WorkspaceWidget.tsx`
- `extensions/main_sequence_ai/widgets/workspace/WorkspaceWidgetSettings.tsx`
- `extensions/main_sequence_ai/widgets/workspace/workspaceReference.ts`

### Existing files to update

- `extensions/main_sequence_ai/widgets/README.md`
- `extensions/main_sequence_ai/index.ts`
- `extensions/main_sequence_ai/agent-monitor-workspaces.ts`
- `extensions/main_sequence_ai/app.ts`
- `extensions/main_sequence_ai/README.md`
- `extensions/main_sequence_ai/surfaces/monitor/README.md`
- `extensions/main_sequence_ai/widgets/agent-terminal/definition.ts`
- `extensions/main_sequence_ai/widgets/agent-terminal/agentTerminalModel.ts`
- `extensions/main_sequence_ai/widgets/agent-terminal/README.md`
- `extensions/main_sequence_ai/widgets/agent-terminal/USAGE_GUIDANCE.md`

## Storage And Backend Assessment

This does not change the shared workspace persistence model.

What changes:

- a new widget type becomes available in the frontend registry
- widget instances of that type persist one new widget-local prop: `workspaceId`
- `Agent Terminal` widens its accepted input contracts so direct workspace-reference binding works

What does not change:

- top-level workspace JSON schema
- workspace layout model
- shared binding graph structure

Backend impact:

- the backend widget registry must learn the new widget type and its published contract when the
  registry is published
- this is a widget-type contract update, not a workspace-schema migration

## Validation Checklist

- `WorkspaceReference` appears in the general workspace-studio catalog for Main Sequence AI widgets.
- `WorkspaceReference` also appears in the Agents Monitor widget catalog.
- The picker excludes the current workspace.
- Raw/imported self-references render as invalid and publish no output.
- The widget publishes exactly `{"id": "<workspace-id>"}`.
- `Agent Terminal` accepts the new contract and includes the workspace id in refresh composition.
- Run `npm run check` after TypeScript changes land.
