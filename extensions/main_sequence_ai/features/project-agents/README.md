# Project Agents Feature

## Purpose

This feature owns the reusable project-agent authoring form used by `Main Sequence AI`.

It is the AI-owned implementation of the project-agent workflow:

- build executor runtime images from project images
- select deployable runtime images
- configure compute
- configure LLM provider and model
- deploy or delete the project-agent runtime

## Entry Points

- `ProjectAgentConfigurator.tsx`
  The shared form component. It accepts explicit `projectId` and `hasAgentCapabilities` inputs and
  renders nothing when the selected project is not agent-capable.

## Ownership Notes

- This feature is intentionally owned by `Main Sequence AI`, not by the workbench project-detail
  tabs.
- Workbench may still import the shared configurator through a temporary compatibility wrapper
  during the refactor, but new project-agent workflow changes should be authored here first.
- The form depends on the shared Main Sequence project APIs.
- The build-source image picker is intentionally scoped to the Main Sequence `base_pod_images`
  slice by requesting `fetchProjectImages(projectId, { catalogImagePrefixStartswith:
  "base_pod_images" })`.
- Project-agent image pickers should expose the project repo hash in the visible option copy, not
  only in search keywords, so they stay aligned with the other project-image pickers in Main
  Sequence.
- LLM selection for project-agent deployment is sourced from the Command Center
  `astro-orchestrator` model catalog only.
- The configurator loads that catalog through the shared Astro operational runtime-access path.
- It must not query the project-agent runtime for model options, and it must not depend on the
  assistant rail being open or on unrelated chat-session state.
- When the current project agent already exists, the form also hydrates `llm_provider` and
  `llm_model` from that agent's exposed `agent_id` so existing deployment values remain visible
  even if the runtime catalog is temporarily unavailable.
- When `GET /orm/api/agents/v1/project-executor-agent-services/by-project/<project_id>/` reports
  `executor_bundle_image_has_drift=true`, the deployment section shows a warning that the deployed
  runtime image has drifted from the latest Astro update and can either wait for the nightly
  redeploy or be redeployed immediately from the UI.
- GPU controls are intentionally omitted from this screen. Project-agent deployment here only edits
  CPU, memory, spot/standard capacity, and LLM settings.
