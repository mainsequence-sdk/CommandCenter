# ADR: Main Sequence AI Workspace Reference Widget

- Status: Accepted
- Date: 2026-04-23
- Related:
  - [Workspaces](../workspaces/overview.md)
  - [Main Sequence AI Workspace Reference Widget Plan](../workspaces/agent-monitor-workspace-widget-plan.md)
  - [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](./adr-widget-agent-context-bindings.md)
  - [ADR: Agent Terminal Managed Session Creation and Agent Allowlist](./adr-agent-terminal-managed-session-creation.md)
  - [ADR: Agent-Ready Widget Type Registry Contract](./adr-agent-ready-widget-type-registry-contract.md)

## Context

`Main Sequence AI` already exposes workspace widgets through the shared workspace studio catalog,
and `Agents Monitor` applies an additional curated allowlist through
`agentMonitorWorkspaceStudioConfig.allowedWidgetIds`.

That extension surface area already supports:

- `Agent Terminal`
- `Upstream Inspector`
- the `WorkspaceReference` widget through both the general Main Sequence AI catalog and the monitor
  allowlist

Those widgets alone are the wrong abstraction when the authoring goal is simpler:

- point at one existing workspace
- bind that reference into an agent workflow
- publish only the referenced workspace id

We need an explicit workspace pointer widget instead of forcing users to overload a snapshot widget
or paste ids into prompt text manually.

There is also one guardrail that must be first-class:

- the widget must not allow selecting its own containing workspace

Without that rule, the widget becomes a confusing self-reference surface and makes copied/imported
workspace configurations harder to reason about.

One more compatibility requirement exists here:

- `Agent Terminal` must accept both snapshot-style widget context and explicit workspace-reference
  inputs

So a new widget that publishes only `{"id": "<workspace-id>"}` requires a companion
`Agent Terminal` contract widening rather than an incorrect attempt to disguise the workspace
pointer as widget snapshot context.

## Decision

We will add a new Main Sequence AI widget titled `WorkspaceReference` that publishes a minimal workspace
reference contract and is available as a normal Main Sequence AI widget, including within
`Agents Monitor`.

### 1. The widget is a reference publisher, not a snapshot widget

The widget will store one authored target workspace id and publish one minimal structured output:

```json
{ "id": "<workspace-id>" }
```

It will not attempt to serialize the referenced workspace contents, layout, or live widget state.

### 2. The widget is generally available in Main Sequence AI workspaces

The widget will be registered in the normal `Main Sequence AI` extension widget list so it appears
in the broader shared workspace-studio catalog.

`Agents Monitor` will also include the widget in its curated allowlist, but the widget is not
monitor-exclusive.

### 3. The contract is extension-local for v1

The widget will publish:

- contract: `main-sequence-ai.workspace-reference@v1`

Recommended output id:

- `workspace-reference`

Recommended value descriptor:

- object contract with one required string field:
  - `id`

This contract remains extension-local until more than one product area needs the same semantic
shape.

### 4. Self-selection is blocked in both authoring and runtime

The widget must not allow the current workspace to be selected as its target.

Enforcement rules:

- the settings picker excludes the current workspace id
- runtime normalization/output resolution treats a self-target as invalid
- invalid or self-targeted widget instances publish no output

That second rule is required because invalid state can still arrive through raw JSON editing,
imports, copied workspaces, or stale persisted instances.

### 5. The widget stores only the target id

Recommended authored prop:

- `workspaceId?: string`

The widget should not persist duplicated workspace title or label metadata as durable props.

Display metadata can be resolved from workspace summaries at runtime when available. The canonical
authored value is the target workspace id only.

### 6. Agent Terminal accepts both snapshot context and workspace references

If the intended consumer is `Agent Terminal`, it accepts:

- `core.widget-agent-context@v1`
- `main-sequence-ai.workspace-reference@v1`

The terminal should format workspace references explicitly in its refresh composition path instead
of pretending they are widget snapshots.

## Goals

- Give Main Sequence AI workspaces a simple widget for passing one workspace id into agent
  workflows.
- Keep the published value minimal and stable.
- Prevent self-reference from the start.
- Keep the authored prop model honest and small.

## Non-Goals

- Embedding the referenced workspace inside the widget
- Publishing live workspace snapshots
- Changing the shared workspace persistence schema
- Creating a new core workspace contract immediately
- Allowing the widget to point to itself

## Design

### Widget module

Recommended module:

- `extensions/main_sequence_ai/widgets/workspace/`

Required files:

- `README.md`
- `USAGE_GUIDANCE.md`
- `definition.ts`
- `WorkspaceWidget.tsx`
- `WorkspaceWidgetSettings.tsx`

### UI behavior

The runtime card should stay small and explicit:

- show the selected workspace title when available
- show the raw workspace id
- show an empty or invalid state when no usable target is configured
- optionally offer an `Open workspace` link

The widget does not need special inline editing or execution ownership.

### Settings behavior

The settings surface should:

1. resolve the current workspace id
2. load accessible workspace summaries
3. exclude the current workspace from candidate options
4. save only the selected target id

In backend direct-link flows, the widget settings should not assume the global workspace list is
already hydrated.

### Catalog placement

The widget should:

- be registered in the normal `Main Sequence AI` extension widget list
- be included in `agentMonitorWorkspaceStudioConfig.allowedWidgetIds`

## Storage Contract Assessment

This proposal does not change the shared workspace document model.

Shared workspace persistence remains:

- one workspace with normal widget instances
- one widget instance with widget-local props

This proposal only adds a new widget type whose local authored prop is `workspaceId`.

Backend coordination required:

- publish the new widget type through the widget registry before relying on backend validation in
  saved backend workspaces

Backend coordination not required:

- no workspace schema migration
- no new top-level workspace fields
- no change to the binding graph storage model

## Consequences

### Positive

- Main Sequence AI workspaces get a purpose-built workspace pointer instead of a prompt hack.
- The published value is small and stable.
- Self-reference is explicitly forbidden instead of being left to user judgment.
- `Agents Monitor` can include the widget without owning a separate implementation.

### Negative

- The widget becomes visible outside monitor-specific workflows, so authors can place it in
  workspaces where it may not be immediately useful without an AI consumer.
- `Agent Terminal` now carries a broader binding surface because it accepts both snapshot context
  and explicit workspace references.
- Widget settings need workspace-summary access even in backend direct-link flows where the list may
  not already be loaded.
- A new extension-local contract adds one more contract surface to document and maintain.

## Tasks

- [x] Add a new `Workspace` widget module under `extensions/main_sequence_ai/widgets/workspace/`.
- [x] Add `README.md` and `USAGE_GUIDANCE.md` for the new widget.
- [x] Define `main-sequence-ai.workspace-reference@v1` and its object value descriptor.
- [x] Persist only `workspaceId` in widget props.
- [x] Exclude the current workspace from the settings picker.
- [x] Block self-targets during runtime normalization/output resolution.
- [x] Register the widget in `extensions/main_sequence_ai/index.ts`.
- [x] Add the widget id to `agentMonitorWorkspaceStudioConfig.allowedWidgetIds`.
- [x] Widen `Agent Terminal` to accept the new workspace reference contract and update its request
  composition logic.
- [x] Update Main Sequence AI widget docs after implementation lands.

## Rejected Alternative

### Reuse `core.widget-agent-context@v1` for workspace ids

Rejected.

Reason:

- a workspace pointer is not a live widget snapshot
- the user requirement is intentionally minimal: only `{"id": "<workspace-id>"}`
- forcing the workspace pointer into the snapshot contract would add irrelevant wrapper fields and
  blur the difference between "reason over this widget's live state" and "use this workspace id"
