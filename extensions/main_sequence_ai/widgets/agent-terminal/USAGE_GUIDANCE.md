## buildPurpose

Managed Main Sequence AI agent conversation with bound workspace context.

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
- The bound AgentSession must finish detail and history readiness before manual typing or automated
  refresh can interact with the session.

## commonPitfalls

- This widget does not let you browse arbitrary existing sessions. Use `Recycle session` when the same widget needs a fresh session for the same agent.
- Only the frontend allowlisted agents are selectable here. The current scope is `astro-orchestrator`.
- When `Block user input` is enabled, the terminal still validates the session and shows streamed output, but manual typing is disabled. Use `Prompt on refresh` together with a refresh mode if the widget should continue sending instructions automatically.
- The manual prompt is only visible when typing is allowed. When it appears, it includes the bound
  agent name so user-entered turns are visibly addressed to that agent.
- `Load initial history` controls whether prior transcript lines are rendered after readiness and
  during later reconciliation. It does not skip the required history request used to make the
  session interactive.
- Bound widget context or workspace references are only appended during automated refresh; manual terminal input stays unchanged.
- The widget also publishes `Latest assistant markdown` as a separate downstream string output. That output is independent from the upstream binding input.
