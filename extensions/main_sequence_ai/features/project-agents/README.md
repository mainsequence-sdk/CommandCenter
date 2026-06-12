# Project Agents Feature

## Purpose

This feature owns the reusable project-agent authoring form used by `Main Sequence AI`.

It is the AI-owned implementation of the project-agent workflow:

- configure compute
- configure LLM provider and model
- deploy or delete the project-agent runtime
- configure automatic deployment for the next project-agent deploy

## Entry Points

- `ProjectAgentConfigurator.tsx`
  The shared form component. It accepts explicit `projectUid` and `hasAgentCapabilities` inputs and
  renders nothing when the selected project is not agent-capable.

## Ownership Notes

- This feature is intentionally owned by `Main Sequence AI`, not by the workbench project-detail
  tabs.
- Workbench may still import the shared configurator through a temporary compatibility wrapper
  during the refactor, but new project-agent workflow changes should be authored here first.
- The form depends on the shared Main Sequence project APIs.
- The deployment flow lets the backend resolve the runtime image. The frontend must not send
  `runtime_image_uid`, legacy `runtime_image`, or legacy `project` in the deploy request.
- The deploy request must send the public `project_uid` field.
- The deploy response is asynchronous status state, not runtime access. The frontend must not
  require `runtime_access` from `POST /project-executor-agent-services/deploy/`.
- `waiting_sdk_update`, `waiting_project_image`, `waiting_executor_image`, `running`, and
  `pending` show a progress panel and poll
  `/orm/api/agents/v1/project-executor-automatic-deployment-runs/?ordering=-created_at&limit=20`.
- `deployed` and `no_action` refresh project-agent service state so the existing service/session
  runtime-access flow can resolve access separately.
- The screen keeps a persistent warning that project agents are one-per-project runtimes and
  should be deployed from images updated to the latest Main Sequence SDK.
- LLM selection for project-agent deployment is sourced from the Command Center
  `astro-orchestrator` model catalog only.
- The configurator loads that catalog through the shared Astro operational runtime-access path.
- It must not query the project-agent runtime for model options, and it must not depend on the
  assistant rail being open or on unrelated chat-session state.
- When the current project agent already exists, the form reads the linked `agent_uid` from the
  project-executor service, loads the agent detail, and hydrates `llm_provider`, `llm_model`, and
  `llm_thinking` from that agent so existing deployment values remain visible even if the runtime
  catalog is temporarily unavailable.
- The Command Center model catalog supplies selectable provider, model, and reasoning options only;
  it is not the source of truth for the current project-agent configuration when linked agent
  details exist.
- When `GET /orm/api/agents/v1/project-executor-agent-services/by-project/<project_uid>/` reports
  `executor_bundle_image_has_drift=true`, the deployment section shows a warning that the deployed
  runtime image has drifted from the latest Astro update, plus any backend-authored drift detail
  and auto-heal guidance.
- GPU controls are intentionally omitted from this screen. Project-agent deployment here only edits
  CPU, memory, spot/standard capacity, and LLM settings. The CPU, memory, and capacity controls
  use the shared Main Sequence resource-requirements section so this screen matches the project job
  and resource-release creation flows, including the shared billing estimate action.
- Deployment automation is an on/off toggle inside the agent configuration, not a deploy-level
  action. The switch sits on the left side of the automation row; when enabled, the row becomes
  animated, the deploy request includes `automatic_deployment: true`, and the form shows the
  automatic release behavior inline instead of opening a separate confirmation modal.
