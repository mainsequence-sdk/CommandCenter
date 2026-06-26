# Main Sequence AI Settings Features

## Purpose

This directory owns `Main Sequence AI` settings sections contributed into the shared routed
Settings app.

The shared Settings app owns navigation chrome; this directory owns only the extension-specific
content.

## Entry Points

- `AgentSettingsSection.tsx`
  User-facing global Agents settings section that shows the `Automate All Agents` toggle and
  deployment-defaults form, exposes the user-triggered Astro deploy action, resolves the assistant
  runtime, and probes the assistant runtime `GET /health` endpoint for diagnostics.
- `ModelProviderSettingsSection.tsx`
  User-facing global provider-auth section that loads provider cards from `/api/model-providers`,
  loads the full model catalog from `/api/models/catalog`, groups models by provider, and drives a
  generic sign-in attempt modal from the backend attempt state machine.
- `useAssistantRuntimeAccess.ts`
  Shared settings hook that resolves backend Command Center operational runtime access before
  settings panels call assistant-runtime endpoints.

## Dependencies

- `extensions/main_sequence_ai/app.ts`
  Registers these sections through `shellMenuContributions`.
- `src/features/settings/SettingsPage.tsx`
  Adapts extension shell settings contributions into routed Settings application pages.
- `src/app/layout/SettingsDialog.tsx`
  Provides the reusable account/platform settings renderer used by the routed Settings page.
- `extensions/main_sequence_ai/runtime/model-catalog-api.ts`
  Supplies the global model catalog used only by the settings screen.
- `extensions/main_sequence_ai/runtime/model-provider-auth-api.ts`
  Supplies global provider auth state, sign-in/sign-off transport, and sign-in attempt polling /
  manual-input / cancel flows.
- `extensions/main_sequence_ai/runtime/assistant-health-api.ts`
  Supplies the assistant-runtime health probe shown in the Agents settings section.
- `extensions/main_sequence_ai/runtime/assistant-endpoint.ts`
  Resolves the configured proxy endpoint or the backend Astro Command Center operational runtime
  access used by settings requests.
## Maintenance Notes

- Keep this directory focused on extension-owned settings content only. Do not add app-shell chrome
  or duplicate Settings navigation here.
- The health panel intentionally shows the raw `/health` response so backend changes are visible
  without adding a frontend-specific status contract.
- The `Automate All Agents` control is a toggle. When enabled, it expands the same deployment
  default shape used by project-agent configuration: provider, model, reasoning, CPU, memory, and
  optional GPU settings.
- The explanatory callout for global automation must remain visible before activation so users can
  understand that enabling it automatically deploys every agent-capable project on each new
  version while still allowing per-project resource edits afterward.
- Opening the Agents settings section always reads
  `/orm/api/agents/v1/coding-agent-deployment-defaults/`. The backend get-or-creates the
  authenticated user's singleton defaults record, so the UI must hydrate from that response before
  treating the toggle or resource fields as current state.
- Confirming `Automate All Agents` posts to
  `/orm/api/agents/v1/coding-agent-deployment-defaults/` with `global_active: true` plus the
  selected LLM and resource defaults. Turning the toggle off posts the same singleton upsert with
  `global_active: false`.
- Settings sections cache Astro service identity and the canonical Command Center handle
  `AgentSession` separately from short-lived runtime credentials. Runtime credentials are resolved
  through `resolve_runtime_access/` and refreshed through the shared assistant endpoint helper.
- Astro service identity is read through
  `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid=<signed-in-user-uid>`;
  an empty result means the user must deploy Astro.
- When runtime access resolves but the runtime is not ready yet, the Agents settings section shows
  "Astro runtime is starting" separately from health, model-catalog, or provider-auth failures.
- In production they should resolve assistant-runtime access through the Astro Command Center
  operational session path instead of depending on `assistant_ui.endpoint` being populated.
- `assistant_ui.endpoint` / `VITE_ASSISTANT_UI_ENDPOINT` remains a debug / proxy concern, not the
  required production bootstrap for settings.
- The Astro deploy action is explicitly user-triggered. It posts
  `agent_type: "astro-orchestrator"` with `scope.kind: "user"` to
  `/orm/api/agents/v1/coding-agent-services/deploy/`, including model fields only when deployment
  defaults are already available.
- Provider auth state is the source of truth for sign-in/sign-off controls. Do not infer provider
  authentication only from model presence.
- Model-provider settings requests require `session.user.uid` and pass it as
  `created_by_user_uid`; they must not pass legacy numeric `created_by_user` values, and numeric
  legacy ids must be rejected before any provider-settings request is sent.
- If the model catalog returns providers that are missing from `/api/model-providers`, surface that
  mismatch as a warning. Do not synthesize auth-state cards only from catalog providers.
- Provider cards should follow backend workflow flags directly: `authenticated` controls `Sign off`,
  `signInAvailable` controls `Sign in`, and `authSource` stays diagnostic only.
- The model list in this section is informational. It should not mutate chat model selection.
- Per-provider model lists should stay collapsed by default so provider status remains the primary
  view and large catalogs do not dominate the dialog.
- This screen must not use `/api/chat/get_available_models`; that endpoint is for chat runtime
  availability, not global provider setup.
- The sign-in modal must preserve and display `attempt.authUrl` whenever the backend provides it,
  even after the attempt moves into manual-input states.
