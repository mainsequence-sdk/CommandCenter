# Main Sequence AI Assistant-UI Boundary

## Purpose

This directory is the explicit `assistant-ui` integration boundary for the `Main Sequence AI` extension.

It owns:

- the assistant-ui runtime
- the shell chat rail mount
- the chat thread renderer
- the page chat scroll-position rail
- the local AgentSession state
- the shell context bridge
- the mock/live transport wiring
- the overlay/page shared state
- the canonical Command Center base-session bootstrap
- the resolved assistant-runtime access state used by the chat/runtime fetch layer

It currently powers two presentation modes that share one runtime:

- a full-page chat route at `/app/main_sequence_ai/chat`
- a full-height frosted shell rail that can either dock into `AppShell` and push content left or
  fall back to a fixed overlay on narrower layouts

The page and overlay transcript shells now share the same top-turn anchoring behavior so the newest
user turn is brought to the top of the visible chat area and the assistant answer gets the
remaining height. The two shells still differ intentionally:

- both shells render the composer/footer as an absolute bottom shell outside the transcript
  viewport, and the transcript keeps a measured footer inset so content stays clear of it
- the full page keeps long user bubbles trimmed to the final two paragraphs so oversized prompts do
  not consume the reply viewport
- the full-page composer now includes provider, model, and reasoning-effort selectors
- model options are fetched from the assistant backend at `/api/chat/get_available_models`
- available-model fetching resolves the backend Command Center base session first, so it calls the
  returned `runtime_access.rpc_url` instead of the static configured endpoint or Vite assistant
  proxy
- the picker now understands the grouped provider response from that endpoint and renders the
  workflow as `Provider -> Model -> Thinking`
- reasoning-effort options are derived from the currently selected model rather than a single
  global list
- the model dropdown now includes a direct `Sign in to provider` action that opens the shared user
  settings dialog on the `Model Providers` contributed section
- if the backend returns no models, the entire selector row is hidden and no fallback model or
  fallback reasoning effort is forced
- if the backend model catalog request fails in live mode, the composer is disabled and shows an
  explicit "models could not be fetched" error instead of allowing sends
- if the backend model catalog loads successfully but returns no available models, the composer is
  disabled and shows a provider-registration link rather than presenting it as a fetch failure
- the selected model and reasoning effort are owned by `ChatProvider`, not by assistant-ui composer
  `runConfig`
- if the backend returns models, `ChatProvider` selects one and every live request carries the
  currently selected model binding from the picker
- when a backend-attached session is selected, `ChatProvider` best-effort initializes the provider
  and model pickers from that session’s `llm_provider` and `llm_model`; if there is no catalog
  match, the normal provider/model fallback selection stays in effect
- the canonical Command Center base-session response also preserves `llm_provider` and `llm_model`,
  and those values are authoritative for picker initialization when they exist in the runtime
  model catalog
- if a selected session asks for a provider/model that is not available in
  `/api/chat/get_available_models`, the picker falls back to an available model and shows a toast
  explaining that the session model is unavailable
- when the user changes the provider or model picker for a backend-attached session, `ChatProvider`
  persists that selection to the ORM AgentSession using `llm_provider` and `llm_model`
- auth-backed models that are present in the catalog but not currently usable stay visible in the
  picker and are rendered disabled with a `Not authenticated` label
- live `/api/chat` requests now carry the optional top-level backend model binding:
  `model: { source: "<catalog-source>", model: "<catalog-model>", provider?: "<provider>", runConfig?: { reasoning_effort: "<selected-effort>" } }`
- live stream `type: "error"` frames preserve the backend `error` message and surface that message
  in the chat error state instead of falling back to assistant-ui's generic error text
- the overlay keeps a reduced chrome surface: no context disclosure, no run-status strip, and no
  in-message thinking/tool detail blocks. The user can expand into the full page for those details
- the right-side rail now warns when it is attached to a non-default session instead of the
  canonical Command Center base orchestrator session
- thinking blocks on the full page start collapsed by default, with a trimmed one-line preview of
  the latest reasoning/tool activity in the collapsed header
- the full-page composer footer now shows a compact context-window usage bar when session insights
  provide `context.percentOfContextWindow`

The app surface itself lives separately under `extensions/main_sequence_ai/surfaces/chat/`.
The shared page explorer UI now lives separately under `extensions/main_sequence_ai/features/chat/`.
Shared session history/tools transport now lives under `extensions/main_sequence_ai/runtime/` so
widgets can reuse the same backend contract without taking a dependency on assistant-ui runtime
state. The backend AgentSession catalog transport now also lives there for the same reason.

## Integration Boundary

All assistant-ui-specific runtime code lives under `extensions/main_sequence_ai/assistant-ui/`.

Files outside this folder that are intentionally touched:

- `src/app/layout/AppShell.tsx`
- `src/app/layout/Sidebar.tsx`
- `src/app/router.tsx`
- `src/config/env.ts`
- `extensions/main_sequence_ai/app.ts`
- `extensions/main_sequence_ai/features/chat/`
- `extensions/main_sequence_ai/index.ts`
- `extensions/main_sequence_ai/surfaces/chat/ChatPage.tsx`

Files intentionally not modified by the feature runtime:

- `src/stores/shell-store.ts`
- `src/auth/auth-store.ts`
- `src/data/live/rest-api.ts`
- shared UI primitives under `src/components/ui/`

The extension participates in the app registry through `extensions/main_sequence_ai/index.ts`, but this directory is specifically the assistant-ui runtime boundary, not the app-definition boundary.

## Current Architecture

### ChatProvider

`ChatProvider.tsx` is the only place that knows about `assistant-ui` runtime wiring.

It uses two runtimes behind one shell boundary:

- `VITE_USE_MOCK_DATA=true`: `useExternalStoreRuntime` with feature-local mock state
- `VITE_USE_MOCK_DATA=false`: `useLatestMessageDataStreamRuntime`, a feature-local wrapper around
  assistant-ui's data-stream runtime

Responsibilities:

- own message/thread state for the chat runtime
- own the selected AgentSession and its cached local transcript
- resolve the canonical Command Center base session from
  `/orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`
- bind dynamic assistant-runtime access from that same bootstrap for AgentSession runtime calls
- treat `activeSession` as a real backend-attached session only; local drafts/placeholders are
  selected sessions, but not active backend sessions
- fail fast when the backend cannot provide the canonical base session and there is no explicit
  backend-attached session to continue
- rely on the shared runtime endpoint helper for assistant-runtime requests so dynamic `rpc_url`
  and runtime-token refresh behavior stay centralized
- expose a normalized active session summary for page shell UI
- expose overlay/page navigation helpers
- bridge app context into chat requests
- own the selected backend model binding used for `/api/chat`
- translate backend events into runtime state
- expose request lifecycle feedback so the thread can show "sent / waiting / failed" before any
  assistant text appears
- respect `VITE_DEBUG_CHAT=true` and print the fully merged live assistant request body to the
  browser console before the request is sent
- respect `VITE_DEBUG_CHAT=true` and print the current active session to the browser console
  whenever the selected session changes

### Agent Sessions

The page chat now treats conversations as `AgentSessions`, not generic chat-history rows.

This boundary owns a feature-local session layer that:

- bootstraps the visible session list from `/orm/api/agents/v1/sessions/`, filtered to
  `created_by_user=<signed-in user id>`, newest first, limited to 20
- bootstraps the canonical Command Center base session from
  `/orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`
- persists local session snapshots in browser localStorage, scoped by signed-in user id
- keeps the selected session shared between the page and overlay runtime
- treats that canonical base session as the default assistant continuity session instead of
  inferring continuity from the latest `astro-orchestrator` session by name
- exposes the selected session summary to the page shell so static session metadata can live in a
  dedicated rail instead of above the transcript
- restores cached messages when the user switches sessions through the shared page explorer
- rehydrates the selected session from `/api/chat/history?sessionId=<AgentSession.id>` when the
  user selects a backend session, then replaces the local cached transcript with the backend
  history payload
- lets page surfaces search agents and start a new session attached to the selected agent
- applies `agent_id=<selected agent id>` to the latest-sessions query after the user picks an
  agent from the session search bar
- uses backend `agent_name` from session API records to populate the session request-name when
  sessions are hydrated from the filtered latest-session query
- replaces the visible latest-session list on every backend refresh instead of appending stale
  sessions from previous queries, while still preserving the active unsynced local draft session
- refreshes backend session tools every time the effective backend session changes
- refreshes backend session insights from
  `/orm/api/agents/v1/sessions/{agent_session_id}/insights/` every time the effective backend
  session changes
- preserves backend `bound_handles` metadata in normalized session records so handles can be shown
  in the explorer, catalog picker, and session detail rail
- preserves backend `runtime_state` and `working` on normalized session records. `working=true`
  means the backend runtime is already processing that session, so the composer is read-only and
  the send action becomes a stop action instead of starting another chat request
- sends user stop requests to `/api/chat/session/cancel` with the selected runtime session id,
  thread id, user id, and `reason: "user_requested"` before clearing the local busy state

This is still intentionally hybrid for now. The visible explorer list comes from the backend latest
sessions endpoint, but cached frontend transcripts and newly-started local sessions are still kept
feature-local until the backend exposes a fuller session-history contract.

If the canonical base-session bootstrap fails, the assistant does not silently reinterpret another
session as the default. The composer stays disabled until a real backend session is available or
the user explicitly selects a valid backend-attached session.

When `VITE_ASSISTANT_UI_PROXY_TARGET` is set, assistant-runtime calls use the configured Vite
proxy endpoint and the base-session bootstrap sends `create_knative_service=false`. When that proxy
target is unset, agent-runtime calls resolve through the base-session bootstrap and use the returned
`runtime_access.rpc_url` plus runtime-scoped bearer token.

### Backend Adapter

`chat-backend-adapter.ts` defines the feature-local transport contract.

This file is now mock-only.

- `VITE_USE_MOCK_DATA=true`: use the feature-local mock async stream
- `VITE_USE_MOCK_DATA=false`: bypass this adapter entirely and use the feature-local latest-message
  data-stream runtime

The removable mock path stays isolated here so local UI work can still happen without a backend.

### Context Bridge

`chat-context.ts` collects the currently visible app context:

- route path
- resolved app and surface ids/titles when available
- assistant-facing surface summary and available actions from the app registry
- route-specific detail context for pages that sit outside the generic `:appId/:surfaceId` renderer
- current user id

This is deliberately read-only and local to the chat feature.

Normal app surfaces should define this metadata on the surface itself through
`AppSurfaceDefinition.assistantContext`. Only explicit detail routes outside the generic app-surface
router should need chat-local route resolvers.

### Session Tools

The backend exposes per-session tool availability through:

- `/api/chat/session-tools?sessionId=<AgentSession.id>`

`ChatProvider.tsx` owns that lifecycle. It is global chat state, not renderer-local state.

Rules:

- tools refresh every time the effective backend session changes
- session changes include:
  - manual selection in the left explorer
  - streamed `new_session`
  - streamed `session_switch`
  - initial load of a selected session that already has a backend `runtimeSessionId`
- placeholder or local-only sessions without a backend `AgentSession.id` do not fetch tools
- in-flight tool requests are aborted when the selected session changes
- the backend `available_tools` payload is the source of truth for per-session tool capability

The current tool case table starts with:

- `repo_diff`

Unknown tool keys are still normalized and kept as `kind: "unknown"` so backend capability flags do
not disappear just because the UI does not render them yet.

### Session Insights

The backend exposes per-session runtime/model/usage metadata through:

- `/api/chat/session-insights?sessionId=<runtime_session_id>`

`ChatProvider.tsx` owns this lifecycle alongside session tools.

Rules:

- insights refresh every time the effective backend session changes
- the fetch key is the runtime session id when available, otherwise the selected backend
  AgentSession id
- placeholder or local-only sessions without a backend session id do not fetch insights
- in-flight insight requests are aborted when the selected session changes
- the normalized snapshot is exposed through `activeSessionSummary.sessionInsights`
- the frontend now accepts the extended `config` section from that endpoint and merges
  `config.model` / `config.compaction` into the normalized model and context views for rendering
- the frontend also accepts the recursive `info` tree from that endpoint and uses it as
  enhancement metadata for labels and help text in the insights UI, with frontend copy as fallback
- `ChatProvider` also exposes `refreshSessionInsights()` so feature-layer editors can patch session
  config and then refetch the canonical insights snapshot

The page session-detail rail is responsible for rendering that snapshot. The transcript pane does
not own static runtime/model usage metadata.

The first concrete tool renderer now lives in the page feature layer:

- `repo_diff` fetches the backend-provided tool `url`
- `diff.files` drives the changed-file selector in the session detail rail
- `diff.patch` renders as a unified git diff via `react-diff-view`

## How It Is Mounted

### Shell Mount

`AppShell.tsx` wraps the shell in `ChatProvider`, renders `ChatMount`, and owns the docked
right-rail shell column.

`ChatMount` is responsible for:

- overlay-only shell mounting when the chat rail is in overlay mode
- keyboard shortcut handling
- rendering the overlay rail when open

The persistent visible trigger now lives in the sidebar chrome above the user menu/avatar instead of a floating bubble.

### Feature Flag

The chat scaffold is gated by the `VITE_INCLUDE_AUI` environment variable.

- default: `true`
- when `false`: the shell does not mount `ChatProvider`, does not render `ChatMount`, hides the sidebar trigger, and the `Main Sequence AI` app is not registered

This keeps the dependency installed while making the UI integration effectively disappear at runtime.

### Dedicated Route

The chat page is now a normal extension app surface:

- `/app/main_sequence_ai/chat`

`router.tsx` only keeps `/app/chat` as a compatibility redirect.

## Removal

To remove this feature completely:

1. Delete `extensions/main_sequence_ai/`.
2. Remove `@assistant-ui/react` and `@assistant-ui/react-data-stream` from `package.json`.
3. Remove the related entries from `package-lock.json`.
4. Remove the `ChatProvider` and `ChatMount` imports/usages from `src/app/layout/AppShell.tsx`.
5. Remove the chat trigger imports/usages from `src/app/layout/Sidebar.tsx`.
6. Remove the legacy `/app/chat` redirect from `src/app/router.tsx`.
7. Run `npm install` to refresh `node_modules` and the lockfile.

If you do those steps, the main project should return to its pre-chat shape because this assistant-ui boundary still avoids changing:

- shell store structure
- auth store structure
- shared component contracts

## Live Transport Notes

- Live assistant-runtime requests resolve their root through `runtime/assistant-endpoint.ts`,
  which exchanges the Command Center base session handle and uses `runtime_access.rpc_url`.
  `assistant_ui.endpoint` is only for explicitly configured/static mode and is not a fallback for
  Main Sequence AI agent-runtime calls.
- The live runtime keeps assistant-ui's standard stream decoding, but sends only the most recent
  user message in `messages` instead of the full thread history.
- The selected `AgentSession` now overrides `threadId` in the live request body, so backend session
  continuity follows the session chosen in the left explorer instead of the default local
  assistant-ui thread id. If the session has already been promoted by a streamed `new_session`
  chunk, the runtime sends the backend-provided `thread_id`; otherwise it falls back to the local
  session id.
- The local AgentSession cache now stores a separate `runtimeSessionId`. This is the backend
  `agent_session_id` used for live request continuity and is distinct from any temporary local id
  used before the first session assignment arrives.
- The live request also includes root `userId`, `agentName`, and
  `sessionMetadata.workflow_key`.
- For any selected existing session, the live request now includes both `sessionId` and
  `runtime_session_id`, using the selected backend session id.
- `agentName` is taken from the session's stable request name, not from the streamed runtime
  `agent_unique_id`.
- The first live request after a fresh/reset conversation includes `newChat: true`.
- Every live request after that must include `runtime_session_id`.
- `newChat` requests are the only live requests allowed to omit `runtime_session_id`.
- `newChat` requests also omit `threadId`. They do not send any session identifier at all.
- After a `newChat` request, the very next streamed response is expected to include a
  `new_session` chunk. If that chunk never arrives before the response finishes, the frontend marks
  the run as invalid and keeps the conversation in "needs new session assignment" state.
- If the user has not selected an explicit agent yet, the launch agent defaults to
  `astro-orchestrator`.
- If the backend includes `agent_id` on streamed response chunks, the feature-local runtime
  extracts it from the raw byte stream before the assistant-ui decoder runs and stores it in shared
  chat state so the full-page header can label the current agent instead of a static placeholder.
  String and numeric agent ids are both accepted.
- If the backend emits a `new_session` chunk for the currently streaming agent, the active local
  AgentSession is promoted in place to the backend session identity:
  - local session `id` becomes `new_session.agent_session_id`
  - local `runtimeSessionId` becomes `new_session.agent_session_id`
  - local `threadId` becomes `new_session.thread_id`
  - local `sessionKey` becomes `new_session.session_key`
  - local agent metadata adopts `new_session.agent_id` and `new_session.agent_unique_id`
- If a `new_session` chunk arrives for a different streamed agent id, the UI currently does not
  branch into a new session automatically. It instead shows an inline notice that a new agent
  session was created by another agent.
- If the backend emits a `session_switch` chunk, the active global `AgentSession` is rewritten in
  place to the switched backend session while preserving the transcript already on screen:
  - local session `id` becomes `session_switch.agent_session_id`
  - local `runtimeSessionId` becomes `session_switch.runtime_session_id`
  - local `threadId` becomes `session_switch.thread_id`
  - local `sessionKey` becomes `session_switch.session_key`
  - local agent metadata adopts `session_switch.to_agent_name`, `session_switch.agent_id`, and
    `session_switch.agent_unique_id`
  - local session metadata also stores `session_switch.project_id` and `session_switch.cwd`
  - the switched session becomes the selected session in the left explorer immediately
  - later requests continue with the switched `runtime_session_id`
- whenever the selected session has a backend `runtimeSessionId`, the provider fetches
  `/api/chat/session-tools?sessionId=<runtime_session_id>` from the assistant backend origin
- the normalized tool payload is stored in a provider-owned map keyed by backend session id
- the first explicit tool case is `repo_diff`, which uses the backend-provided `url` directly
  instead of rebuilding tool URLs in the UI
- The feature-local runtime now raises a request-start callback before `fetch()` and inspects
  streamed `ui-message-stream` chunk types so the UI can distinguish:
  - request sent but no response yet
  - response accepted but no assistant output yet
  - reasoning started
  - text streaming started
  - request failed before any visible assistant output
- The decoder is still selected by `assistant_ui.protocol`.
- The frontend sends the normal assistant-ui request body and merges the current shell context into
  the request body as `context`.
- If the configured endpoint omits a scheme, the frontend infers `http://` on HTTP pages and
  `https://` on HTTPS pages.

## Next Integration Step

The next meaningful integration step is backend-side: implement assistant-ui's streamed response
contract completely, including reasoning/tool parts, so the current chat UI can render the built-in
chain-of-thought and tool-call groups without additional frontend protocol glue.
