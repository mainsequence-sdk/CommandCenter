# Main Sequence AI Agent Terminal Widget

This folder owns the `main-sequence-ai-agent-terminal` widget.

## Entry Points

- `definition.ts`: widget registry definition and stable widget id.
- `AgentTerminalWidget.tsx`: terminal renderer, session hydration, and live streaming behavior.
- `AgentTerminalWidget.css`: theme-aware overrides for the `react-terminal-ui` shell.
- `AgentTerminalWidgetSettings.tsx`: widget settings UI with the reusable agent-first/session-second
  picker plus durable history-refresh configuration and Markdown refresh prompts.
- `AgentTerminalWorkspaceLauncher.tsx`: reusable workspace action that opens the session picker and
  inserts or creates Agent Terminal widgets directly from the canvas flow.
- `agentTerminalExecution.ts`: widget execution bridge that maps workspace refresh cycles to a
  terminal-history refresh nonce in widget runtime state.
- `agentTerminalWorkspace.ts`: workspace mutation helpers for finding and upserting
  `main-sequence-ai-agent-terminal` instances by `agentSessionId`.
- `agentTerminalModel.ts`: widget prop normalization and terminal line/session helpers.

## Behavior Notes

- The widget binds to one existing AgentSession id and does not create sessions.
- Session history and tools are loaded through the same endpoints used by the page chat.
- Live requests post to the same assistant endpoint as chat, but render the stream as terminal
  output instead of chat bubbles.
- Widget settings and Agents Monitor now both reuse the same agent/session picker instead of
  requiring a raw session-id text field.
- Durable widget props now include a history refresh policy:
  `workspace`, `never`, or `interval`, plus interval seconds when custom polling is selected.
- The default history refresh policy is `workspace`, so workspace refresh and auto-refresh cycles
  silently reload the session transcript after the initial load.
- The widget can also store a Markdown `promptOnRefresh`. When present, each refresh sends that
  prompt into the bound session instead of only reloading transcript history.
- `Prompt on refresh` is also exposed as a bindable string input, so other widgets can drive the
  refresh prompt without mutating raw widget props directly.
- The live terminal prompt stays visible whenever the widget is mounted, even while the selected
  session is still hydrating, so terminal input never disappears from the shell.
- The widget hides the third-party terminal mock chrome and renders as a clean nested terminal
  surface inside the workspace widget frame.
- The widget uses the robot glyph in workspace chrome and launchers because it represents an agent
  session surface, not a generic terminal utility.
- New Agent Terminal instances spawned through the AI workspace helpers open wider and at double
  the previous height so the terminal has more usable space by default.
- Newly inserted Agent Terminal instances also stamp an autofocus runtime hint so the hidden prompt
  input is focused automatically after the widget lands on the canvas.
- Transcript buffers and stream state stay component-local. Durable props are limited to the
  selected `agentSessionId`, the history-refresh configuration, and the optional refresh prompt.

## Maintenance Notes

- The temporary terminal shell uses `react-terminal-ui` as an adapter. Keep transport and session
  helpers decoupled so a future full terminal integration can replace only the presentation layer.
- Workspace insertion should prefer `AgentTerminalWorkspaceLauncher.tsx` and
  `agentTerminalWorkspace.ts` rather than duplicating widget-upsert logic inside page surfaces.
- If backend widget-prop validation is strict, this widget's persisted `agentSessionId`,
  `historyRefreshMode`, `historyRefreshIntervalSeconds`, and `promptOnRefresh` props must be
  allowed by the widget-type sync contract as well.
