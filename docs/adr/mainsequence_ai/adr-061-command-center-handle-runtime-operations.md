# ADR 061: Reintroduce Astro Command Center Handle for Non-Chat Runtime Operations

- Status: Proposed
- Date: 2026-05-07
- Related:
  - [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
  - [ADR 059: Main Sequence AI Global Settings Runtime Resolution](./adr-059-global-settings-runtime-resolution.md)
  - [ADR 058: Refactor Project Agent Creation](./adr-058-refactor-project-agent-creation.md)
  - [ADR: Main Sequence AI Command Center Base Session](./adr-main-sequence-ai-command-center-base-session.md)
  - [ADR: Main Sequence AI Runtime Endpoint Resolution](./adr-main-sequence-ai-runtime-endpoint-resolution.md)

## Context

`Main Sequence AI` currently has a bad dependency inversion in two non-chat surfaces:

1. `Project Agents` deployment model selection
2. `User Settings` model availability / provider settings

Those surfaces need a valid Command Center runtime in order to call operational assistant-runtime
endpoints such as:

- `/health`
- model-provider discovery
- model catalog discovery

However, they are not themselves chat surfaces, and they should not require the user to open the
Command Center rail with `Cmd+J` just to populate a model cache. That requirement is a product
failure: it forces an unrelated user action to satisfy a form dependency.

At the same time, direct project-agent chat launch must stay separate from this workflow. When the
user clicks the project-agent robot icon, the system should use the concrete project-agent session
path and should not bootstrap unrelated Command Center base-session behavior, history hydration, or
insight loading.

The backend already exposes the canonical handle bootstrap for the Astro Command Center runtime:

- `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`

The intended operational workflow is:

1. get or create the Command Center session handle
2. resolve runtime access / RPC token for that handle
3. use that runtime access for lightweight operational calls

What is missing is a frontend architecture that uses that flow for operational runtime access
without mixing it into transcript/session UX.

## Decision

`Main Sequence AI` will reintroduce the Astro Command Center handle bootstrap as a dedicated
non-chat runtime-access path.

This path is for operations on the Command Center runtime, not for transcript hydration.

### 1. Operational bootstrap is explicit and separate from chat bootstrap

The frontend will introduce a shared operational runtime bootstrap for `astro-orchestrator`:

1. call
   `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`
2. resolve a usable runtime identity from that result
3. obtain `runtime_access.rpc_url` and a runtime token for assistant-runtime calls
4. perform operational runtime requests such as health and model-catalog discovery

This flow must not be treated as a chat-session hydration step.

### 2. Project Agents will use the operational Astro handle path for provider/model selection

`ProjectAgentConfigurator` must stop depending on:

- the live Command Center chat store
- incidental cached model catalogs populated by unrelated chat activity
- the project-agent runtime itself for initial model discovery

Instead it should use the shared operational Astro handle path to load:

- available providers
- available models

That means project-agent deployment can resolve its own model catalog without requiring `Cmd+J`.

### 3. User Settings will use the same operational Astro handle path

Settings surfaces that need global assistant-runtime model/provider data should use the same
shared operational handle workflow.

This keeps `Project Agents` and `User Settings` aligned on one source of truth for global
Command Center model discovery.

### 4. Operational runtime access must not block on chat data

This workflow must not load or wait for:

- session history
- session insights
- tools history
- chat transcript readiness

The only readiness requirement for operational usage is that the runtime is reachable enough to
serve the target operational endpoint. A lightweight health check may be used where needed.

### 5. Direct project-agent chat launch remains session-bound

Project-agent chat launch from the robot icon remains a different workflow:

- it is session-bound
- it is allowed to start or reuse a concrete project-agent session
- it must not use the Astro operational handle path as its bootstrap transport

This preserves the separation between:

- `Command Center runtime operations`
- `chat-session interaction`

## Scope

This ADR covers:

- Command Center operational runtime bootstrap for non-chat surfaces
- model catalog discovery for `Project Agents`
- model/provider discovery for `User Settings`
- health-check usage for operational readiness
- separation between operational handle bootstrap and chat-session bootstrap

This ADR does not cover:

- project-agent chat send payloads
- transcript hydration
- session insights UX
- direct project-agent session launch rules
- semantic agent search or agent-detail routing

## Design

### 1. Introduce a shared operational runtime-access layer

The frontend should expose a shared helper/hook for `astro-orchestrator` operational access with a
contract like:

- get or create Command Center handle
- resolve runtime access
- cache operational runtime access for a bounded period
- expose retry + refresh behavior

This layer should live with the existing assistant runtime transport helpers, not inside
`ProjectAgentConfigurator` or settings UI components.

### 2. Runtime access must be normalized before consumers call assistant-runtime endpoints

Consumers should not manually stitch together:

- handle bootstrap
- token exchange
- RPC URL selection

Those details belong in the shared runtime-access layer. Callers should receive a normalized
runtime-access result and then use the standard runtime request wrapper.

### 3. Operational readiness is endpoint-focused, not transcript-focused

Operational consumers only need enough runtime readiness to call:

- `/health`
- provider discovery
- model catalog discovery

They should not wait for or derive readiness from:

- a visible chat thread
- a selected session detail serializer
- history hydration
- insights availability

### 4. Caching should be explicit and local to operational model discovery

Model catalog caching for this path should be keyed to the `astro-orchestrator` operational
runtime, not to arbitrary currently-open chat sessions.

The cache should be reusable by:

- `Project Agents`
- `User Settings`

without requiring the assistant rail to be open.

### 5. Failure states must be actionable inside the surface

If operational runtime resolution fails:

- show an inline error in `Project Agents` or `User Settings`
- offer retry
- do not tell the user to open `Cmd+J` as a prerequisite

That instruction is explicitly rejected by this ADR.

## Consequences

### Positive

- removes the `Cmd+J` prerequisite for deployment model selection
- gives `Project Agents` and `User Settings` one canonical operational runtime bootstrap path
- keeps direct project-agent chat separate from global runtime model discovery
- reduces accidental coupling between the assistant rail store and unrelated AI forms

### Negative

- adds another explicit runtime-access path that must be kept distinct from session-bound chat
- requires careful caching rules so operational runtime access does not drift from backend reality
- increases the responsibility of the shared runtime transport layer

## Current Gap This ADR Is Fixing

The current frontend state is transitional and wrong:

- `Project Agents` has been pushed toward `astro-orchestrator` as the model source
- but it still depends on incidental assistant-store/cache population
- that is why the UI can currently instruct the user to open the Command Center rail first

This ADR replaces that dependency with a direct operational Astro handle bootstrap.

## Implementation Tasks

- [ ] Add a shared `astro-orchestrator` operational runtime bootstrap helper in the assistant
      runtime layer.
- [ ] Bootstrap that helper from
      `POST /orm/api/agents/v1/user-orchestrator-agent-services/session-handles/get_or_create_astro_command_center/`.
- [ ] Normalize runtime access so consumers receive `rpc_url` + runtime token without manually
      composing the flow.
- [ ] Add a lightweight operational health probe where needed, without loading transcript or
      insights data.
- [ ] Build a shared model-catalog loader on top of that operational runtime helper.
- [ ] Switch `ProjectAgentConfigurator` to that shared model-catalog loader.
- [ ] Switch `User Settings` model/provider discovery to that shared model-catalog loader.
- [ ] Remove UI copy that tells the user to open `Cmd+J` in order to populate model options.
- [ ] Ensure direct project-agent robot launch does not reuse this operational bootstrap for chat
      hydration.
- [ ] Add focused tests for:
      - handle bootstrap success
      - runtime-access failure
      - model catalog load
      - no history/insights fetch on the operational path

## Acceptance Criteria

- A user can open `Project Agents` with no assistant rail open and still get provider/model
  options.
- A user can open `User Settings` with no assistant rail open and still get provider/model
  options.
- Neither surface tells the user to open `Cmd+J` as a prerequisite.
- Direct project-agent chat launch still uses the project-agent session path and does not pull in
  Astro operational transcript bootstrap.
