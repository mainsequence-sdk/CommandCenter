## buildPurpose

Bindable reference to one selected workspace.

## whenToUse

- Use when an agent or another downstream widget should point to a specific workspace by id.
- Use when the downstream consumer needs only the workspace identifier, not a live widget snapshot.
- Use when the widget should behave like a compact sidebar source token instead of a canvas card.

## whenNotToUse

- Do not use when the goal is to publish live chart, table, or note context from the current canvas.
- Do not use when the downstream workflow needs more than the selected workspace id.

## authoringSteps

- Open widget settings.
- Select one target workspace.
- Bind the `Workspace reference` output to a downstream widget input.
- The output uses `main-sequence-ai.workspace-reference@v1` and publishes only `{"id": "<workspace-id>"}`.
- New instances default to sidebar placement rather than opening as a canvas card.
- In graph mode, select the widget node and use `Expand workspace` to inspect the referenced
  workspace's read-only widget graph and internal connections.

## blockingRequirements

- A target workspace must be selected.
- The target workspace cannot be the current workspace.

## commonPitfalls

- This widget publishes only `{"id": "<workspace-id>"}`. It does not publish title, labels, or a live snapshot.
- The current workspace is intentionally excluded from selection and will be blocked if saved manually.
- This widget has no inputs and no refresh execution path. It only validates the selected workspace and publishes the id when that selection is valid.
- If you move the widget onto the canvas manually, that is a presentation override for that instance. The default authoring mode is sidebar-only.
- Graph expansion is inspection-only. Connections shown inside the referenced workspace cannot be
  edited from the parent workspace graph.
