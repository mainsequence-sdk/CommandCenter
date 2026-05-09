## buildPurpose

Managed Main Sequence AI agent conversation with bound workspace context.

## whenToUse

- Use when a workspace needs an interactive terminal that owns a fresh agent session for one supported agent.
- Use when automated refresh should combine a saved or bound instruction with live widget context from tables, charts, notes, or one or more explicit workspace ids.
- Use when a workspace should expose session output on the canvas but prevent direct manual typing, letting only refresh-driven prompts drive the session.

## whenNotToUse

- Do not use when the goal is only to inspect one bound value or call one HTTP endpoint.

## authoringSteps

- Select one supported agent. The widget creates a fresh session automatically.
- Optionally enable `Block user input` when the terminal should be read-only for manual typing.
- Write the saved refresh prompt in settings or in the default floating `Prompt on refresh`
  companion card, or bind one upstream string source into `Prompt markdown`.
- Use the standard canvas-companion toggle in settings to show or hide that floating prompt card.
- The floating prompt card renders Markdown directly; click it to edit, and it returns to rendered
  Markdown automatically when editing ends.
- In workspace graph mode, use the graph-node prompt button to open the same saved prompt in an
  attached card above the Agent Terminal node, and edit it there without leaving the graph.
- Optionally bind one or more upstream inputs from the Bindings tab.
- `Prompt markdown` accepts `core.value.string@v1`.
- `Upstream agent input` accepts `core.widget-agent-context@v1` and `main-sequence-ai.workspace-reference@v1`.

## inboundPorts

- `prompt-markdown` / `Prompt markdown`
  - Contract: `core.value.string@v1`
  - Cardinality: `one`
  - Uses the bound string as the automated refresh prompt. When bound, it overrides the saved prompt from settings.
- `upstream-context` / `Upstream agent input`
  - Contracts: `core.widget-agent-context@v1`, `main-sequence-ai.workspace-reference@v1`
  - Cardinality: `many`
  - Appends widget context and workspace references as evidence after the automated refresh prompt.

## outboundPorts

- `latest-assistant-markdown` / `Latest assistant markdown`
  - Contract: `core.value.string@v1`
  - Publishes the latest assistant response rendered by this terminal.

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
- A bound `Prompt markdown` string only affects automated refresh. It does not replace what the user types manually into the terminal.
- The floating `Prompt on refresh` card shows the effective automated refresh prompt. When
  `Prompt markdown` is bound, the card becomes a read-only rendered view of that bound value while the
  saved prompt remains the fallback edited in settings.
- The graph-mode prompt card edits the same saved `promptOnRefresh` prop as widget settings and
  the floating companion card.
- The widget also publishes `Latest assistant markdown` as a separate downstream string output. That output is independent from the upstream binding inputs.
