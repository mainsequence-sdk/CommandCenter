# Main Sequence AI Agents Surface

## Purpose

This directory owns the `Agents` surface for the `Main Sequence AI` app.

The page is now a registry-style agent list. It loads backend agents from the plain
`/orm/api/agents/v1/agents/` endpoint, renders them in a standard table view, and lets the user
start a fresh chat session for one selected agent.

It also supports same-surface detail navigation through URL params, following the same list/detail
pattern used by the rest of the Main Sequence app surfaces.

The list page now includes a dedicated semantic agent-discovery card backed by
`POST /orm/api/agents/v1/agents/semantic-search/`. That search is separate from the registry
filter, uses natural-language queries against function/skills/description intent, and clicking a
result opens the agent detail view instead of starting a session.

## Entry Points

- `AgentsPage.tsx`
  Foundry-style list surface built from the shared agent list client. It keeps pagination, local
  filtering, semantic-search discovery, loading, empty, and action states local to the page, and
  switches into agent detail mode when `msAgentId` is present in the URL search params. Agent rows
  use the backend public `uid` as their preferred lookup key and only keep numeric IDs as a legacy
  fallback.
- `AgentDetailView.tsx`
  Same-surface agent detail screen. It renders the agent summary header plus `Overview`,
  `Agent Card`, `Sessions`, and `Capabilities` tabs while preserving the surrounding app path and
  shell framing. The summary header now comes from the canonical agent `/summary/` endpoint and is
  locally augmented with `image_drift` checks from the detail serializer. If the summary endpoint
  fails, the header shows the backend error instead of inventing fallback header data. The header
  actions also include a `Runtime` lookup that resolves
  `/orm/api/agents/v1/agents/{agent_uid}/runtime-ref/`, reads `runtime_uid`, and deep-links into
  the Foundry `scalable-services` detail view when a runtime exists. The header also exposes
  `Configure agent deployment` for supported coding agents. `project-executor` agents route into
  the project-scoped deployment configurator using a public `project_uid` from the detail payload
  or linked runtime lookup, while `astro-orchestrator` agents route directly into the Astro
  deployment configurator. Session
  launch actions are grouped under one `Session` menu, including handle-bound session creation,
  which posts the shared handle-session contract through `agent-sessions-api.ts` and uses the
  shared run-config resolver to prepopulate provider, model, and thinking fields from the agent
  defaults plus the registered model catalog. The sessions tab owns selection state and bulk
  deletion for recent AgentSession rows, and the capabilities tab owns bound-resource listing,
  bind/unbind actions, and shared prompt/skill editor access.
- `extensions/main_sequence_ai/agent-search.ts`
  Shared agent list, semantic search, agent detail, and quick-search clients used by the AI
  surfaces and pickers.
- `extensions/main_sequence_ai/features/agent-capabilities/`
  Shared capability resource clients, save orchestration, reusable capability editor, and the
  agent-binding tab implementation used by agent detail.
- `extensions/main_sequence_ai/assistant-ui/ChatProvider.tsx`
  Supplies the `startAgentSession(...)` action used by the row-level session launcher.

## Dependencies

- `extensions/main_sequence_ai/app.ts`
  Registers the surface, marks it as full-bleed, and attaches the robot icon used in the app
  surface navigation.
- `extensions/main_sequence/common/components/registryTable.ts`
  Supplies the shared Foundry table cell styling used to keep this list visually aligned with the
  Main Sequence registry pages.

## Maintenance Notes

- Keep this surface focused on agent discovery and session launch. It should not revert to an empty
  shell or canvas-first layout.
- Prefer the existing Foundry list/table conventions over custom card stacks so the page behaves
  like the rest of the Main Sequence registry surfaces.
- Keep semantic agent discovery routed through the dedicated `/semantic-search/` endpoint and keep
  the plain registry filter local to the loaded `/agents/` page results. They solve different
  problems and should not be collapsed back into one search box.
- Keep detail state encoded in URL params so list/detail navigation behaves like the other Main
  Sequence entity pages.
- Keep agent list/detail/session launch lookups UID-first. Do not use synthesized numeric `0`
  values as row keys, visible identifiers, or backend lookup values.
- Agent list deletion is a bulk action routed through
  `POST /orm/api/agents/v1/agents/bulk-delete/` with `agent_uids: string[]`. Keep deletion
  UID-only and do not add per-row delete buttons or numeric-ID fallbacks.
- Keep AgentSession deletion in the detail Sessions tab routed through the shared
  `deleteAgentSessionRequest(...)` client so the DELETE contract stays centralized.
- Keep the `Agent Card` tab wired directly to the `agent_card` field from the agent detail
  serializer so it reflects the backend-authored card payload without local reshaping.
- Keep capability resource writes separate from capability content writes. The capabilities tab must
  continue to use the dedicated `/content/` endpoint instead of inventing a flattened save route.
- Keep image-drift status sourced from the agent detail serializer and rendered through the shared
  summary header contract instead of a custom one-off header block.
- Keep coding-agent deployment editing routed by agent type. `project-executor` still requires a
  public project UID from the agent detail serializer or linked runtime lookup, while
  `astro-orchestrator` opens the user-scoped Astro deployment configurator directly. Do not derive
  project context from numeric project IDs.
- Keep the header summary query bound to the agent `/summary/` endpoint. Do not synthesize a local
  fallback summary when that contract fails.
- Keep session-launch behavior delegated to `ChatProvider` so this page does not grow its own
  session creation contract.
- Keep handle-bound session creation routed through `getOrCreateAgentSessionRequest(...)` and
  `resolveRunConfigSelection(...)`. Do not add local provider/model/thinking merge logic or pass
  frontend user identity fields in the handle session payload.
- Keep the capabilities tab binding-scoped. Resource registry browsing and capability creation now
  live on the top-level `Capabilities` surface, while this tab keeps bind/unbind and shared-editor
  access for already relevant resources.
- Keep the capabilities tab limited to supported `prompt` and `skill` kinds in this phase. Do not
  expose `extension` authoring until the backend accepts it.
- Keep the `Runtime` action routed through the dedicated `runtime-ref` lookup helper using the
  agent UID and the Foundry `scalable-services` detail surface instead of hardcoding runtime URLs
  directly in the AI app.
- The actual canvas workflow still lives on the sibling `Agents Monitor` surface.
