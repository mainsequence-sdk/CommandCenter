# Project Agents Feature

## Purpose

This feature owns the reusable coding-agent deployment forms used by `Main Sequence AI` modal entry
points.

It is the AI-owned implementation of the project-agent workflow:

- configure compute
- configure LLM provider and model
- deploy or delete the project-agent runtime
- configure automatic deployment for the next project-agent deploy

## Entry Points

- `ProjectAgentConfigurator.tsx`
  Thin project-scoped wrapper around the shared coding-agent deployment controller. It accepts
  explicit `projectUid` and `hasAgentCapabilities` inputs, adds project-only warning panels and
  automation controls, and renders nothing when the selected project is not agent-capable.
- `AgentDeploymentConfigurationForm.tsx`
  Shared deployment form shell used by both project-agent and Astro deployment modals.
- `AstroAgentDeploymentConfigurator.tsx`
  Thin user-scoped wrapper around the shared coding-agent deployment controller used by Command
  Center chat. It adds the Astro deployment-state panel and GPU-enabled resource fields.
- `useCodingAgentDeploymentController.ts`
  Shared load, hydrate, validate, confirm, and submit workflow for coding-agent deployments. Both
  project-executor and Astro wrappers use this controller and vary only by configuration.
- `CodingAgentDeploymentSharedSections.tsx`
  Shared LLM picker, resource section, deployment result panel, and deploy confirmation dialog used
  by both wrappers.

## Ownership Notes

- This feature is intentionally owned by `Main Sequence AI`, not by the workbench project-detail
  tabs.
- Workbench may still import the shared configurator through a temporary compatibility wrapper
  during the refactor, but new project-agent workflow changes should be authored here first.
- The configurator is modal-only. Do not add a routed `Project Agents` page back to the AI app.
- The form depends on the shared Main Sequence project APIs.
- The Astro configurator is also modal-only. Chat surfaces open deployment configuration through
  `ChatProvider.openDeploymentConfigurator`; the provider routes Astro command-center sessions to
  `AstroAgentDeploymentConfigurator` and project-executor sessions with a project UID to
  `ProjectAgentConfigurator`.
- Existing Astro service rows are the source of truth for visible deployed LLM and resource
  configuration. The generic `coding-agent-services/` serializer must include linked Agent
  `llm_provider`, `llm_model`, and `llm_thinking`, plus backing job CPU, memory, GPU, and
  `spot` fields so the modal can prepopulate the actual deployment.
- The deployment flow lets the backend resolve the runtime image. The frontend must not send
  `runtime_image_uid`, legacy `runtime_image`, or legacy `project` in the deploy request.
- The deploy request must send the public `project_uid` field.
- The deploy response is asynchronous status state, not runtime access. The frontend must not
  require `runtime_access` from `POST /project-executor-agent-services/deploy/`.
- Both wrappers load current state from `GET /orm/api/agents/v1/coding-agent-services/` using
  filtered query params. Project-executor uses
  `?agent_type=project-executor&scope_kind=project&project_uid=<project_uid>`. Astro uses
  `?agent_type=astro-orchestrator&scope_kind=user&user_uid=<user_uid>`.
- When no current service exists, the controller may optionally fall back to
  `GET /orm/api/agents/v1/coding-agent-deployment-defaults/`. Astro enables that fallback.
  Project-executor intentionally does not.
- The authoritative deployed LLM and resource configuration comes from the coding-agent-service
  serializer itself. The project deployment modal no longer performs an extra
  `GET /orm/api/agents/v1/agents/{agent_uid}/` read to hydrate provider, model, or thinking.
- Both wrappers always load the selectable provider/model/thinking catalog from
  `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` through the shared
  available-run-config API. They use the same `RunConfigFields` picker, the same confirmation
  dialog, and the same `POST /orm/api/agents/v1/coding-agent-services/deploy/` mutation path.
- `waiting_sdk_update`, `waiting_project_image`, `waiting_executor_image`, `running`, and
  `pending` show a progress panel and poll
  `/orm/api/agents/v1/project-executor-automatic-deployment-runs/?ordering=-created_at&limit=20`.
- Starting a deploy must not eagerly invalidate the selected project summary or immediately refetch
  the project-agent service. The configurator already has local deploy status plus deployment-run
  polling for in-progress feedback.
- The project wrapper also does not auto-refetch the project-scoped coding-agent-service record
  after deploy finishes. It keeps the local deploy result as the source of truth for that session
  instead of issuing follow-up reads while the deployment-run poller is active.
- The screen keeps a persistent warning that project agents are one-per-project runtimes and
  should be deployed from images updated to the latest Main Sequence SDK.
- LLM selection for project-agent deployment is sourced from the Command Center
  `astro-orchestrator` model catalog only.
- The configurator loads that catalog through the shared Astro operational runtime-access path.
- It must not query the project-agent runtime for model options, and it must not depend on the
  assistant rail being open or on unrelated chat-session state.
- When the current project agent already exists, the form hydrates provider, model, thinking,
  resource values, and automation state directly from the project-scoped coding-agent-service
  serializer response.
- The Command Center model catalog supplies selectable provider, model, and reasoning options only;
  it is not the source of truth for the current project-agent configuration when an existing
  project-scoped coding-agent-service record is present.
- When the current project-scoped coding-agent-service serializer reports image drift, the
  deployment section shows a warning that the deployed runtime image has drifted from the latest
  Astro update, plus any backend-authored drift detail and auto-heal guidance.
- GPU controls are intentionally omitted from this screen. Project-agent deployment here only edits
  CPU, memory, spot/standard capacity, and LLM settings. The CPU, memory, and capacity controls
  use the shared Main Sequence resource-requirements section so this screen matches the project job
  and resource-release creation flows, including the shared billing estimate action.
- Resource controls are edit fields. They must wait for the project-executor service lookup before
  rendering, hydrate from backend `cpu_request`, `cpu_limit`, `memory_request`, `memory_limit`, and
  `spot` when those fields are present, and remain blank/unselected when the serializer omits them.
  Do not populate visible defaults for existing services. The deploy endpoint requires
  `cpu_request`, `cpu_limit`, `memory_request`, and `memory_limit`, so deploy stays disabled until
  those four fields are filled.
- Deployment automation is an on/off toggle inside the agent configuration, not a deploy-level
  action. The switch sits on the left side of a static automation row. When enabled, the parent
  modal header animates, the deploy request includes `automatic_deployment: true`, and the form
  shows the automatic release behavior inline instead of opening a separate confirmation modal.
- The deployment automation toggle must wait for the project-executor service lookup to finish
  before rendering. Do not show a default off/on state and then flip it after
  `automatic_deployment` arrives from the backend.
