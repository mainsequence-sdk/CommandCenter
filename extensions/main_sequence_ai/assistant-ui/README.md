# Main Sequence AI Assistant-UI Boundary

## Purpose

This directory is the explicit `assistant-ui` integration boundary for the `Main Sequence AI` extension.

It owns:

- the assistant-ui runtime
- the overlay rail mount
- the chat thread renderer
- the page chat scroll-position rail
- the local AgentSession state
- the shell context bridge
- the mock/live transport wiring
- the overlay/page shared state

It currently powers two presentation modes that share one runtime:

- a full-page chat route at `/app/main_sequence_ai/chat`
- a full-height frosted side rail that can sit on top of any surface rendered by `AppShell`

The full-page thread renderer intentionally behaves differently from the overlay:

- once the first user turn exists, the page transcript uses assistant-ui's top turn anchoring so
  the newest user prompt is brought to the top of the visible chat area and the assistant answer
  gets the remaining height
- the active page composer/footer is rendered as an absolute bottom shell outside the transcript
  viewport, and the page transcript keeps extra bottom padding so content stays clear of it
- long page user bubbles are trimmed to the final two paragraphs so oversized prompts do not
  consume the reply viewport

The app surface itself lives separately under `extensions/main_sequence_ai/surfaces/chat/`.
The shared page explorer UI now lives separately under `extensions/main_sequence_ai/features/chat/`.

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
- expose overlay/page navigation helpers
- bridge app context into chat requests
- translate backend events into runtime state
- expose request lifecycle feedback so the thread can show "sent / waiting / failed" before any
  assistant text appears
- respect `VITE_DEBUG_CHAT=true` and print the fully merged live assistant request body to the
  browser console before the request is sent

### Agent Sessions

The page chat now treats conversations as `AgentSessions`, not generic chat-history rows.

This boundary owns a feature-local session layer that:

- bootstraps the visible session list from `/orm/api/agents/v1/sessions/` for the
  `astro-orchestrator` agent, filtered to `created_by_user=<signed-in user id>`, newest first,
  limited to 20
- persists local session snapshots in browser localStorage, scoped by signed-in user id
- keeps the selected session shared between the page and overlay runtime
- restores cached messages when the user switches sessions through the shared page explorer
- lets page surfaces search agents and start a new session attached to the selected agent

This is still intentionally hybrid for now. The visible explorer list comes from the backend latest
sessions endpoint, but cached frontend transcripts and newly-started local sessions are still kept
feature-local until the backend exposes a fuller session-history contract.

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

### Action Bridge

`chat-actions.ts` is the placeholder catalog for actions the assistant may eventually trigger.

The important rule is:

- chat-triggered mutations must call the same stores, query invalidations, and domain actions already used by the rest of the UI

Do not add a second mutation path that only chat uses.

## How It Is Mounted

### Shell Mount

`AppShell.tsx` wraps the shell in `ChatProvider` and renders `ChatMount`.

`ChatMount` is responsible for:

- overlay-only shell mounting
- keyboard shortcut handling
- rendering the overlay when open

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

- `assistant_ui.endpoint` is the canonical assistant `POST` endpoint in live mode.
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
