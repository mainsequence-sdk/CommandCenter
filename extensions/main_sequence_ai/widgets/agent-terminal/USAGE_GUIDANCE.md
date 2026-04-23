## buildPurpose

Use this widget to create and continue one managed Main Sequence AI agent conversation inside a workspace and let the agent reason over bound widget snapshots or bound workspace references during automated refresh.

## whenToUse

- Use when a workspace needs an interactive terminal that owns a fresh agent session for one supported agent.
- Use when automated refresh should combine a saved instruction with live widget context from tables, charts, notes, or one or more explicit workspace ids.
- Use when a workspace should expose session output on the canvas but prevent direct manual typing, letting only refresh-driven prompts drive the session.

## whenNotToUse

- Do not use when the goal is only to inspect one bound value or call one HTTP endpoint.

## authoringSteps

- Select one supported agent. The widget creates a fresh session automatically.
- Optionally enable `Block user input` when the terminal should be read-only for manual typing.
- Write the saved refresh prompt in settings.
- Optionally bind one or more upstream inputs from the Bindings tab.
- `Upstream agent input` accepts `core.widget-agent-context@v1` and `main-sequence-ai.workspace-reference@v1`.

## blockingRequirements

- A supported agent selection is required.

## commonPitfalls

- This widget does not let you browse arbitrary existing sessions. Use `Recycle session` when the same widget needs a fresh session for the same agent.
- Only the frontend allowlisted agents are selectable here. The current scope is `astro-orchestrator`.
- When `Block user input` is enabled, the terminal still validates the session and shows streamed output, but manual typing is disabled. Use `Prompt on refresh` together with a refresh mode if the widget should continue sending instructions automatically.
- Bound widget context or workspace references are only appended during automated refresh; manual terminal input stays unchanged.
- The widget also publishes `Latest assistant markdown` as a separate downstream string output. That output is independent from the upstream binding input.
