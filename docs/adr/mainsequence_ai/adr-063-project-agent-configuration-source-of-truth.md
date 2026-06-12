# ADR 063: Project Agent Configuration Source of Truth

- Status: Proposed
- Date: 2026-06-12
- Related:
  - [ADR 058: Refactor Project Agent Creation](./adr-058-refactor-project-agent-creation.md)
  - [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
  - [ADR 061: Reintroduce Astro Command Center Handle for Non-Chat Runtime Operations](./adr-061-command-center-handle-runtime-operations.md)
  - [ADR 074: UID-Only Main Sequence Backend Identifier Contracts](../main_sequence/adr-074-uid-only-main-sequence-backend-identifier-contracts.md)

## Context

The `Main Sequence AI` Project Agents page configures a project-executor agent runtime for a
selected Main Sequence project:

- `/app/main_sequence_ai/project-agents?msProjectUid=<project_uid>`

The page currently needs three different backend/runtime payloads:

1. project-executor service state
2. persisted agent configuration
3. available provider/model options

Those payloads are related but not equivalent.

The project-executor service payload answers service/runtime questions:

- whether a project-executor service exists for the project
- which agent the service is linked to
- whether the service is ready
- automatic deployment state
- runtime image drift state
- delete/deploy service metadata

The persisted model selection and reasoning configuration belong to the linked `Agent`, not to the
model catalog and not to a locally inferred default. The selected `llm_provider`, `llm_model`, and
`llm_thinking` must be loaded from the linked agent details when that agent exists.

The available-models endpoint answers a different question:

- which providers/models can be selected now

It is an options catalog. It must not be treated as the source of the existing project-agent
configuration.

Mixing these concerns creates bugs:

- the form can show the first available catalog model instead of the actual persisted agent model
- the form can omit the persisted reasoning/thinking setting owned by the linked agent
- deploy can accidentally resend a default model when the existing agent detail has not hydrated
- a catalog refresh can overwrite backend-owned configuration
- the UI can confuse "current selected model" with "selectable model options"

## Decision

The Project Agents page will use separate source-of-truth rules for current configuration and
available options.

### 1. Service lookup identifies the linked agent

The page first reads the project-executor service:

- `GET /orm/api/agents/v1/project-executor-agent-services/by-project/<project_uid>/`

That response is authoritative for service-level configuration and runtime state, including:

- `uid`
- `agent_uid`
- `automatic_deployment`
- readiness state
- runtime image drift state
- service delete/deploy metadata

The frontend must use the public agent identifier from this response to load the linked agent. The
preferred field is `agent_uid`.

The frontend must not introduce new dependencies on numeric `agent_id` values for this path.

### 2. Agent details are the source of the selected model configuration

If the service response has a linked agent, the Project Agents form must load agent detail:

- `GET /orm/api/agents/v1/agents/<agent_uid>/`

The returned agent detail is authoritative for the form's current selected model configuration:

- `llm_provider`
- `llm_model`
- `llm_thinking`

When agent detail exists, those values populate the Provider, Model, and reasoning/thinking
controls before any catalog default is applied.

The UI must preserve the agent-detail values even when the current available-models catalog does
not include that provider/model/reasoning combination. In that case, the UI should show the
backend-owned value as the current configuration and make any mismatch explicit instead of silently
selecting a different catalog option.

### 3. The available-models endpoint is only the options catalog

The existing available-models request remains the correct source for selectable options:

- `/api/chat/get_available_models?created_by_user_uid=<user_uid>`

That response provides the provider/model option set for the selector. It is not authoritative for
the current project-agent configuration.

The catalog may be used to:

- render provider options
- render model options
- render reasoning/thinking options when the selected model advertises them
- mark options unusable when provider auth is missing
- validate whether the current agent-detail model is selectable
- validate whether the current agent-detail thinking value is selectable for the current model
- provide choices when the user intentionally changes the model

The catalog must not:

- overwrite `llm_provider` / `llm_model` loaded from agent detail
- overwrite `llm_thinking` loaded from agent detail
- auto-select the first available provider/model after an existing agent detail has loaded
- be required to know the current persisted configuration when the agent detail already provides it

### 4. New-agent behavior is separate from existing-agent hydration

If no project-executor service or linked agent exists yet, there is no existing agent configuration
to hydrate. In that state, the UI may use the available-models catalog to offer an initial
selection for a new deploy.

Once a linked agent exists, agent detail wins.

### 5. Deploy sends the explicit form state

Deploy continues to call:

- `POST /orm/api/agents/v1/project-executor-agent-services/deploy/`

The request body sends the explicit form state:

- `project`
- `llm_provider`
- `llm_model`
- `llm_thinking`
- compute settings
- `automatic_deployment`

For an existing linked agent, the initial form state must come from agent detail. If the user
changes provider/model, the changed form state is sent in deploy. A deploy response may then update
the agent and service state; the page should invalidate and rehydrate both the service and linked
agent detail.

## Scope

This ADR covers:

- source-of-truth rules for the Project Agents configuration form
- ownership of `llm_provider`, `llm_model`, and `llm_thinking`
- the role of the available-models catalog
- frontend hydration order for existing project agents
- UID-only linked-agent lookup for this flow

This ADR does not cover:

- chat session model changes
- AgentSession detail hydration
- global model-provider settings
- automatic deployment execution semantics
- backend image build or runtime deployment internals

## Implementation Direction

1. Fetch the project-executor service by project UID.
2. Read `agent_uid` from that service when present.
3. Fetch agent detail by `agent_uid`.
4. Populate `selectedLlmProvider`, `selectedLlmModelId`, and selected reasoning/thinking state from
   `agent.llm_provider`, `agent.llm_model`, and `agent.llm_thinking` before applying catalog
   defaults.
5. Fetch the available-models catalog separately for the selector option set.
6. If the agent-detail model appears in the catalog, select the matching catalog option.
7. If that catalog model advertises reasoning/thinking options and the agent-detail
   `llm_thinking` value appears there, select that matching option.
8. If the agent-detail model or thinking value does not appear in the catalog, preserve the
   backend-owned provider/model/thinking values in the UI and do not silently replace them.
9. Only use catalog-first defaulting when no linked agent detail exists yet.
10. On deploy success, invalidate both:
   - `project-executor-agent-services/by-project/<project_uid>/`
   - `agents/<agent_uid>/`
11. Do not add new numeric `agent_id` dependencies. Use public UIDs for linked agent lookup.

## Consequences

### Positive

- existing project agents render the actual persisted provider/model
- existing project agents render the actual persisted reasoning/thinking setting
- the options catalog can change without overwriting backend-owned configuration
- deploy does not accidentally submit a catalog default for an existing agent
- frontend behavior matches the backend ownership model: model configuration belongs to the Agent
- UID-only identity rules stay intact for the project-agent path

### Negative

- the form has one more hydration dependency for existing agents
- the UI must handle a state where the current agent-detail model or thinking value is not present
  in the catalog
- backend must consistently expose `agent_uid` from the project-executor service response

## Required Fixes

- The Project Agents page must stop treating the available-models response as the current
  configuration source.
- The Project Agents page must hydrate current provider/model from linked agent detail when a
  linked agent exists.
- The Project Agents page must hydrate `llm_thinking` from linked agent detail when a linked agent
  exists.
- The Project Agents page must preserve loaded agent-detail provider/model/thinking values even
  when the catalog is missing that option.
- The project-executor service response must expose the linked public `agent_uid`.
- Frontend code must avoid new numeric `agent_id` dependencies in this flow.
