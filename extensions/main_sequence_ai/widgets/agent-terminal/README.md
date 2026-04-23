# Main Sequence AI Agent Terminal Widget

This folder owns the `main-sequence-ai-agent-terminal` widget.

## Entry Points

- `definition.ts`: widget registry definition and stable widget id.
- `AgentTerminalWidget.tsx`: terminal renderer, optional session hydration, live streaming
  behavior, and an edit-mode-only chat link in widget chrome.
- `AgentTerminalWidget.css`: theme-aware overrides for the `react-terminal-ui` shell.
- `AgentTerminalWidgetSettings.tsx`: widget settings UI with supported-agent selection, managed
  session creation/recycle actions, durable history-refresh configuration, and Markdown refresh
  prompts.
- `AgentTerminalWorkspaceLauncher.tsx`: reusable workspace action that selects a supported agent,
  creates a fresh session, and inserts or creates Agent Terminal widgets directly from the canvas
  flow.
- `AgentTerminalAgentPicker.tsx`: widget-scoped allowed-agent search UI reused by settings and the
  monitor launcher.
- `agentTerminalExecution.ts`: widget execution bridge that maps workspace refresh cycles to a
  terminal-history refresh nonce in widget runtime state.
- `agentTerminalWorkspace.ts`: workspace mutation helpers for finding and upserting
  `main-sequence-ai-agent-terminal` instances by `agentSessionId`.
- `agentTerminalModel.ts`: widget prop normalization and terminal line/session helpers.
- `agentTerminalAgents.ts`: shared frontend allowlist policy for agents that may create managed
  Agent Terminal sessions.

## Behavior Notes

- The widget is now agent-owned, not session-picked. Settings and the monitor launcher only let the
  user select allowlisted agents, currently `astro-orchestrator`.
- Selecting an agent from widget settings or from the monitor launcher immediately creates a new
  backend session through `POST /orm/api/agents/v1/agents/{agent_id}/start_new_session/` and binds
  the widget to that returned session id.
- New widgets persist `agentId`, `agentName`, and the widget-managed `agentSessionId`. The agent
  name lets the terminal send live chat requests without first loading history just to recover
  metadata.
- On mount or session-id change, the widget first validates the AgentSession through the normal
  Command Center backend detail endpoint. If that detail request returns `404`, the terminal is
  invalidated, shows `session-not-found`, and does not call the assistant runtime.
- Initial session history loading is optional and disabled by default through the
  `loadInitialHistory` prop. With the default settings, mounting the widget validates against the
  normal backend but does not call the assistant runtime.
- The terminal widget does not call `/api/chat/session-tools`; tool availability remains a chat UI
  concern and is intentionally not loaded by this widget.
- Session history is loaded only when `loadInitialHistory` is enabled, when a refresh without a
  prompt explicitly reloads history, or after a sent terminal message completes and the widget
  reconciles the transcript.
- Live requests post to the same assistant endpoint as chat, but render the stream as terminal
  output instead of chat bubbles.
- Widget settings and Agents Monitor now both reuse the same agent-only picker instead of exposing
  session browsing or raw session-id input.
- Widget settings expose `Recycle session` for the same agent. That creates a brand-new session and
  replaces the bound `agentSessionId` without exposing arbitrary existing-session selection.
- While the widget is being edited, the internal terminal chrome exposes the current session id as
  a direct link into the shared Main Sequence AI chat page. That authoring affordance stays hidden
  in normal non-edit canvas mode.
- Durable widget props now include `agentId`, `agentName`, optional `loadInitialHistory`, and a
  history refresh policy: `workspace`, `never`, or `interval`, plus interval seconds when custom
  polling is selected.
- The widget can also persist `blockUserInput`. When enabled, the prompt remains visible and the
  session still validates, refreshes, and streams output, but manual terminal typing is disabled.
- The default history refresh policy is `workspace`, so workspace refresh and auto-refresh cycles
  silently reload the session transcript when the workspace explicitly refreshes after mount.
- The widget can also store a Markdown `promptOnRefresh`. When present, each refresh sends that
  prompt into the bound session instead of only reloading transcript history.
- `Prompt on refresh` is now settings-only. It is no longer a bindable widget input.
- The widget now exposes one bindable `Upstream agent input` with `cardinality: "many"`. Each
  bound value may use either the shared `core.widget-agent-context@v1` contract derived from
  another widget's `buildAgentSnapshot(...)` or the new
  `main-sequence-ai.workspace-reference@v1` contract published by the `WorkspaceReference` widget.
- During automated refresh, the terminal composes `saved prompt + bound upstream sources` into one
  request body before sending it to the selected AgentSession.
- Manual terminal typing stays direct. Bound widget context or workspace references are not
  prepended to live user-entered terminal input.
- The widget now also publishes `Latest assistant markdown` as a bindable string output sourced
  from runtime state. That output remains independent from the new upstream widget-context input.
- When the terminal completes a new response and the latest assistant markdown changed, the widget
  triggers a downstream execution flow so bound consumers receive `upstream-update` immediately.
- The live terminal prompt still stays pinned to the bottom of the terminal's own internal
  viewport, but it must not scroll the outer workspace viewport just to keep the prompt visible.
- The widget hides the third-party terminal mock chrome and renders as a clean nested terminal
  surface inside the workspace widget frame.
- The widget uses the robot glyph in workspace chrome and launchers because it represents an agent
  session surface, not a generic terminal utility.
- When session detail is available, the internal terminal shell also shows the current provider and
  model alongside the bound agent/session metadata.
- New Agent Terminal instances spawned through the AI workspace helpers open wider and at double
  the previous height so the terminal has more usable space by default.
- Newly inserted Agent Terminal instances also stamp an autofocus runtime hint so the hidden prompt
  input is focused automatically after the widget lands on the canvas. Normal transcript refreshes
  must not keep stealing page-level focus after that initial autofocus.
- Transcript buffers and stream state stay component-local. Durable props are limited to the
  selected `agentId`, selected `agentName`, widget-managed `agentSessionId`, optional
  `blockUserInput`, optional initial-history loading, the history-refresh configuration, and the
  optional refresh prompt. The published latest-assistant output lives in widget runtime state, not
  durable props.

## Maintenance Notes

- The temporary terminal shell uses `react-terminal-ui` as an adapter. Keep transport and session
  helpers decoupled so a future full terminal integration can replace only the presentation layer.
- Workspace insertion should prefer `AgentTerminalWorkspaceLauncher.tsx` and
  `agentTerminalWorkspace.ts` rather than duplicating widget-upsert logic inside page surfaces.
- Cross-screen navigation from this widget should link directly to the shared Main Sequence AI chat
  page instead of introducing widget-local detail routing.
- The terminal now depends on the platform-generated `agent-context` binding output derived from
  `buildAgentSnapshot(...)` plus the extension-local workspace-reference contract published by the
  `WorkspaceReference` widget. If either contract changes, update this widget in the same change. See
  [ADR: Widget Agent Context Bindings for Agent Terminal Consumers](../../../../docs/adr/adr-widget-agent-context-bindings.md).
- If backend widget-prop validation is strict, this widget's persisted `agentId`, `agentName`,
  `agentSessionId`, `blockUserInput`, `loadInitialHistory`, `historyRefreshMode`,
  `historyRefreshIntervalSeconds`, and `promptOnRefresh` props must be allowed by the widget-type
  sync contract as well.
- `definition.ts` now publishes both `widgetVersion` and an explicit backend-facing
  `registryContract`.
- Keep that registry contract aligned with the real execution-owner behavior here: managed session
  lifecycle, refresh modes, saved prompt semantics, multi-binding upstream inputs, published
  latest-assistant output, and the distinction between durable props and component-local transcript
  state.
- Bump `widgetVersion` when refresh semantics, inputs/outputs, runtime behavior, or agent-facing
  authoring guidance changes materially.
