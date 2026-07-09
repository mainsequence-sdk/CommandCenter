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
- session-bound assistant runtime resolution
- the resolved assistant-runtime access state used by the chat/runtime fetch layer

It currently powers two presentation modes that share one runtime:

- a full-page chat route at `/app/main_sequence_ai/chat`
- a session-pinned variant of that route at `/app/main_sequence_ai/chat?session=<session_uid>`
  when the user opens a recent session into its own browser tab
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
- available-model fetching resolves the selected backend `AgentSession` first, so it calls that
  session's `runtime_access.rpc_url` instead of the static configured endpoint or Vite assistant
  proxy
- when that per-session runtime-access response includes backend `image_drift`, chat stores only
  the warning metadata needed for UI and surfaces a generic "needs an update" warning in the full
  page and session-detail rail
- that warning metadata is now resolved directly for the selected backend session as part of chat
  hydration, so it still appears when assistant-runtime model catalogs come from cache or when
  local proxy mode bypasses runtime `rpc_url` resolution for the actual chat transport
- when the full chat page or right rail needs the Command Center orchestrator, `ChatProvider` first
  reads the user-scoped Astro service with
  `/orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid=<user_uid>`.
  If no service with an `agent_uid` is returned, chat shows the deploy-required state instead of
  creating anything. If an `agent_uid` is present, it calls
  `/orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/` for the canonical
  `astro-orchestrator-command-center` handle and then lets the normal AgentSession detail,
  insights, and history readiness gate run
- history user turns that arrive with `provenance.origin = "agent"` stay in the user lane, but the
  bubble now uses a robot badge plus a separate agent-origin tint so A2A-origin prompts are visually
  distinct from direct human user prompts
- that zero-session initialization is independent of `?session=<id>`; any existing backend session
  suppresses automatic orchestrator creation, and project-agent rails are excluded
- available-model fetching is cached per user + agent request name for 15 minutes, so switching
  between sessions does not refetch the same runtime catalog repeatedly
- when that 15-minute cache expires, the last applied catalog remains visible and usable while the
  refresh runs in the background; model discovery must not blank the picker or rebuild the chat
  shell once a catalog has already been applied for the same user + agent scope
- the available-model loader is keyed by a stable runtime scope
  (`user -> agent request name`), not by whole session object identity, so transcript or metadata
  rewrites do not restart the same request
- once that scope is established, switching between sessions for the same agent does not restart
  model discovery just because the concrete session UID changed
- the picker now understands the grouped provider response from that endpoint and renders the
  workflow as `Provider -> Model -> Thinking`
- reasoning-effort options are derived from the currently selected model rather than a single
  global list
- the model dropdown now includes a direct `Sign in to provider` action that opens the shared
  Settings app on the Main Sequence AI Model Providers section
- if the backend returns no models, the entire selector row is hidden and no fallback model or
  fallback reasoning effort is forced
- if the backend model catalog request fails in live mode, the composer is disabled and shows an
  explicit "models could not be fetched" error instead of allowing sends
- if the backend model catalog loads successfully but returns no available models, that catalog is
  authoritative: `ChatProvider` clears picker selection, the composer is disabled, the selector row
  stays hidden, and the only model-provider action shown is `Sign in to provider`
- if model resolution is still loading for the current user/agent scope, the composer stays
  disabled and Command Center does not start a send until the catalog resolves
- the selected model and reasoning effort are owned by `ChatProvider`, not by assistant-ui composer
  `runConfig`
- if the backend returns models, `ChatProvider` selects one for UI state and persists provider/model
  changes back to the selected backend session
- when a backend-attached session is selected, `ChatProvider` best-effort initializes the provider
  and model pickers from that session’s `llm_provider` and `llm_model`; if there is no catalog
  match, the normal provider/model fallback selection stays in effect
- the selected session metadata also preserves `llm_provider` and `llm_model`, and those values
  are authoritative for picker initialization when they exist in the runtime model catalog
- if a selected session asks for a provider/model that is not available in
  `/api/chat/get_available_models`, the picker falls back to an available model and shows a toast
  explaining that the session model is unavailable
- when the user changes the provider or model picker for a backend-attached session, `ChatProvider`
  persists model-bound selection to the ORM AgentSession using `llm_provider`, `llm_model`, and
  `llm_thinking` from the third picker string value; provider-only changes stay local so the UI
  does not send incomplete PATCH payloads. The locally persisted injected session serializer is
  updated immediately so later `/api/chat` sends reflect the selected state
- live `/api/chat` sends must prefer the locally updated injected session serializer over the last
  fetched detail serializer, so picker changes are reflected in the next request immediately even
  before Main Sequence detail is re-read
- successful provider/model changes must not re-run the full AgentSession detail/insights readiness
  cycle; the shell keeps the current session interactive and updates summary chrome from the local
  session snapshot instead of forcing a visible rebuild
- auth-backed models that are present in the catalog but not currently usable stay visible in the
  picker and are rendered disabled with a `Not authenticated` label
- live `/api/chat` requests for existing sessions now carry the canonical loaded AgentSession
  serializer as top-level `session`; they do not send a parallel top-level `model` object
- model/provider remain session-owned Main Sequence data, while optional top-level
  `runConfig.reasoning_effort` can still travel as a per-run override
- live stream `type: "error"` frames preserve the backend `error` message and surface that message
  in the chat error state instead of falling back to assistant-ui's generic error text
- chat-visible errors now preserve source provenance in the displayed message, so failures such as
  missing request context can be attributed to Command Center, Main Sequence session APIs, or the
  agent runtime instead of appearing as anonymous text
- the overlay keeps a reduced chrome surface: no context disclosure, no run-status strip, and no
  in-message thinking/tool detail blocks. The user can expand into the full page for those details,
  but the overlay composer still exposes the model controls and compact context-window usage footer
- the right-side rail has two presentation modes:
  - the default Command Center rail now rebinds itself to the canonical
    `astro-orchestrator-command-center` handle session whenever the rail opens; it must not keep
    using an arbitrary previously selected non-orchestrator session
  - direct project-agent launches use a dedicated `Project Agent` rail variant with its own
    provider instance, header, theme-derived accent styling, session chip, and copy, and it
    intentionally stays isolated from the default Command Center rail selection
  - the project-agent rail is additive, not a replacement for the normal Command Center rail:
    Command Center `Cmd+J` and the project-agent launcher can both stay open at the same time
    because they no longer share one rail-open flag or one selected session/runtime
- Active chat sessions expose a configuration-wheel deployment action in the rail/page chrome.
  `ChatProvider.openDeploymentConfigurator` routes supported session agent types to their real
  deployment configurator: Astro command-center sessions use `AstroAgentDeploymentConfigurator`,
  `project-executor` sessions with a project UID use `ProjectAgentConfigurator`, and unsupported
  session types show a plain unavailable state without attempting deployment APIs. Astro
  deploy-required and unavailable states use the same action.
- thinking blocks on the full page start collapsed by default, with a trimmed one-line preview of
  the latest reasoning/tool activity in the collapsed header; their header label is `Thinking`
  only while the local message stream is still running and switches to `Reasoning` immediately
  after the response completes
- the page and overlay composer footers now show a compact context-window usage bar when session
  insights provide `context.percentOfContextWindow`
- chat interaction is gated by AgentSession readiness: the selected backend session must complete
  detail, insights, and history loading before the composer, provider/model controls, and send path
  become interactive; once insights have loaded successfully, later insights refreshes stay
  in-place and must not push the shell back into a full session-loading state
- the plain `/app/main_sequence_ai/chat` route does not auto-select a restored or latest backend
  session on first landing; selection there is driven by `?session=`, direct-launch flows, or an
  explicit user action
- the session-pinned `/app/main_sequence_ai/chat?session=<session_uid>` route must select that exact
  backend session; if it is not present in the latest-session page, `ChatProvider` fetches the
  session detail directly instead of falling back to the newest session
- when that plain chat route has no selected session yet, the page stays in a neutral idle shell:
  it does not show AgentSession readiness errors or loading states, and it also defers
  session-bound model discovery until the user selects or starts a session
- when the user clicks a recent session from that plain unbound chat page, the current tab becomes
  the session-pinned chat route; cross-tab latest-session opens only apply once the current chat
  tab is already bound to a concrete session
- once a selected session finishes loading backend history, the transcript viewport auto-scrolls to
  the latest message for that session instead of leaving the user at the first historical turn

The app surface itself lives separately under `extensions/main_sequence_ai/surfaces/chat/`.
The shared page explorer UI now lives separately under `extensions/main_sequence_ai/features/chat/`.
Shared session history transport now lives under `extensions/main_sequence_ai/runtime/` so widgets
can reuse the same backend contract without taking a dependency on assistant-ui runtime state. The
backend AgentSession catalog transport now also lives there for the same reason.

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
- `extensions/main_sequence_ai/agent-session-detail/`
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
- require a concrete backend `AgentSession` before resolving dynamic assistant-runtime access
- bind dynamic assistant-runtime access from the selected session's
  `/orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/` contract
- consume the shared `agent-session-detail/` controller instead of owning full AgentSession detail
  composition inline
- treat `activeSession` as a real backend-attached session only; local drafts/placeholders are
  selected sessions, but not active backend sessions
- fail fast when a concrete selected backend `AgentSession` fails to hydrate, while still keeping
  the plain unselected chat page in a neutral idle state
- rely on the shared runtime endpoint helper for assistant-runtime requests so dynamic `rpc_url`
  and runtime-token refresh behavior stay centralized
- expose a normalized active session summary for page shell UI
- expose overlay/page navigation helpers
- bridge app context into chat requests
- own the locally persisted injected AgentSession serializer used for `/api/chat`
- expose and enforce the selected AgentSession interaction-readiness gate so UI components do not
  treat partial session identity or cached local transcript state as interactive readiness
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
  `created_by_user_uid=<signed-in user uid>`, newest first, limited to 20
- persists local session snapshots in browser localStorage, scoped by signed-in user id
- keeps the selected session shared between the page and overlay runtime
- exposes the selected session summary to the page shell so static session metadata can live in a
  dedicated rail instead of above the transcript
- exposes the active shared AgentSession detail snapshot so chat chrome can render core detail
  without duplicating fetch state
- restores cached messages when the user switches sessions through the shared page explorer
- rehydrates the selected session from `/orm/api/agents/v1/sessions/<session_uid>/history/` when the
  user selects a backend session, then replaces the local cached transcript with the backend
  history payload
- preserves backend message `provenance` from that history payload in assistant-ui message
  metadata and in a hidden per-message provenance data part so agent-origin user turns can render
  with a robot badge in the transcript without changing their underlying `role: "user"` semantics
- creates user-initiated fresh chat sessions through the backend `start_new_session` action before
  selecting them, so a local placeholder id is never treated as an interactive session
- treats backend detail, insights, and history as required readiness facets before enabling chat
  interaction for the selected AgentSession
- lets page surfaces search agents and start a new session attached to the selected agent
- also exposes a direct session-launch path for page surfaces that already know a backend
  `agent_id`, so they can open the left rail and start a session through
  `/orm/api/agents/v1/agents/{agent_id}/start_new_session/` without going through agent search
- also exposes a direct "open latest or start" path for page surfaces such as project detail:
  it first checks the latest sessions endpoint for that `agent_id` and current user, reuses the
  newest session when one exists, and only creates a fresh session when no prior session is found
- keeps that direct project-agent launch on a dedicated rail path: it skips the generic latest
  session refresh, skips assistant-runtime model/tool bootstrap on initial open, and hydrates the
  rail from the created session record first so the canonical Astro orchestrator transport does not
  mix into the first-open experience
- direct-launched sessions no longer mark history as ready from local placeholder state;
  they stay loading until a real `/orm/api/agents/v1/sessions/<session_uid>/history/` read
  succeeds
- session-bound runtime calls now resolve runtime access from
  `/orm/api/agents/v1/sessions/{session_uid}/resolve_runtime_access/` instead of routing
  every selected session through a separate Astro Command Center bootstrap endpoint
- the normal Command Center chat rail resolves the user-scoped Astro service through
  `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid=<signed-in-user-uid>`
  and then gets/selects the canonical `astro-orchestrator-command-center` handle session through
  `/orm/api/agents/v1/agents/{agent_uid}/sessions/get_or_create_session/`; it does not deploy Astro
  and it does not resolve runtime access until the first chat/runtime interaction
- while the normal Command Center rail is resolving that canonical handle session, the generic
  latest-session bootstrap must not auto-select the newest arbitrary AgentSession as a fallback
- a fresh backend `start_new_session` with no persisted transcript is treated as a valid empty
  history state; a `404` history response is normalized to an empty thread instead of surfacing a
  session error banner
- applies `agent_id=<selected agent id>` to the latest-sessions query after the user picks an
  agent from the session search bar
- uses backend `agent_type` from session API records to populate the session request-agent-type when
  sessions are hydrated from the filtered latest-session query
- replaces the visible latest-session list on every backend refresh instead of appending stale
  sessions from previous queries, while still preserving the active unsynced local draft session
- refreshes backend session insights from
  `/orm/api/agents/v1/sessions/{session_uid}/insights/` every time the effective backend
  session changes
- once a session already has an insights snapshot, later background insights refreshes must patch
  that snapshot in place instead of reverting the rail/footer UI to loading placeholders
- treats an empty session-insights payload as a valid state: if the backend returns `200` with
  `has_insights=false` and `insights={}`, the UI shows "no persisted insights yet" instead of an
  error state
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

If no backend `AgentSession` is available, the assistant does not silently reinterpret another
session as the default. The composer stays disabled until a real backend session is available or
the user explicitly selects a valid backend-attached session.

When `VITE_ASSISTANT_UI_PROXY_TARGET` is set, Command Center operational traffic still resolves
Astro service identity, gets the canonical handle session, and calls `resolve_runtime_access/` with
the normal empty `{}` body. Assistant-runtime calls use the configured Vite proxy endpoint instead
of the returned `runtime_access.rpc_url`, while still using the runtime-scoped bearer token.
When `VITE_ASSISTANT_UI_EXECUTOR_TARGET` is also set, session-bound proxy traffic branches by
agent type: `project-executor` sessions use the dedicated executor proxy route,
while all other sessions stay on the standard assistant proxy route.

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

### Session Insights

The backend exposes per-session runtime/model/usage metadata through:

- `/api/chat/session-insights?sessionId=<runtime_session_uid>`

`ChatProvider.tsx` owns this lifecycle.

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
  which resolves runtime access from the selected `AgentSession` and uses `runtime_access.rpc_url`.
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
  session lookup uid used for ORM session detail/history/runtime-access reads and is distinct from
  any temporary local id used before the first session assignment arrives.
- The live request also includes root `user_uid`, runtime `agentType` identity, and
  `sessionMetadata.workflow_key`.
- For any selected existing session, the live request includes `runtime_session_uid`, using the
  selected backend session uid.
- The live request emits `agentType` as the runtime identity.
- The first live request after a fresh/reset conversation includes `newChat: true`.
- Every live request after that must include `runtime_session_uid`.
- `newChat` requests are the only live requests allowed to omit `runtime_session_uid`.
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
  - local session `id` becomes `new_session.runtime_session_uid` or another canonical session UID
  - local `runtimeSessionId` becomes `new_session.runtime_session_uid` or another canonical session UID
  - local `threadId` becomes `new_session.thread_id`
  - local `sessionKey` becomes `new_session.session_key`
  - local agent metadata adopts `new_session.agent_id` and `new_session.agent_unique_id`
- `new_session` is only honored for the current chat's own backend session assignment path. The
  frontend no longer stages or opens cross-agent handoffs, and it ignores runtime stream switching
  semantics for other agents.
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
