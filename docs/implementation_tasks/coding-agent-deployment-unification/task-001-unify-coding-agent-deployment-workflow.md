# Task 001: Unify Coding Agent Deployment Workflow

## Goal

Unify the Astro and project-coder deployment configurators into one shared coding-agent deployment
workflow.

After this refactor, the only differences between the two flows should be configuration:

- agent type
- deployment scope
- resource fields
- optional extra panels
- post-submit polling strategy
- copy and labels

The load, hydrate, validate, confirm, and submit workflow should be shared.

## Problem Statement

Both deployment flows submit to the same backend deploy endpoint:

- `POST /orm/api/agents/v1/coding-agent-services/deploy/`

But the frontend still owns two different orchestration paths:

- `ProjectAgentConfigurator.tsx`
- `AstroAgentDeploymentConfigurator.tsx`

That causes divergence in:

- current configuration source of truth
- model-catalog loading
- picker rendering
- validation rules
- confirmation behavior
- payload construction
- post-submit lifecycle

The current structure is not DRY. Shared transport exists, but shared workflow does not.

## Current Entry Points

- `extensions/main_sequence_ai/features/project-agents/ProjectAgentConfigurator.tsx`
- `extensions/main_sequence_ai/features/project-agents/AstroAgentDeploymentConfigurator.tsx`
- `extensions/main_sequence_ai/features/project-agents/AgentDeploymentConfigurationForm.tsx`
- `extensions/main_sequence_ai/components/RunConfigFields.tsx`
- `extensions/main_sequence_ai/runtime/run-config-selection.ts`
- `extensions/main_sequence_ai/runtime/available-models-api.ts`
- `extensions/main_sequence/common/api/index.ts`

## Shared Backend Contract

Both flows ultimately call:

- `deployCodingAgentService(...)`
- `POST /orm/api/agents/v1/coding-agent-services/deploy/`

Current specializations are:

- project coder uses `agent_type: "project-executor"` and `scope.kind: "project"`
- Astro uses `agent_type: "astro-orchestrator"` and `scope.kind: "user"`

This confirms that the frontend should share one workflow and vary only by configuration.

## Side-By-Side Workflow

| Step | Project Coder Today | Astro Today | Unified Target |
|---|---|---|---|
| Open configurator | Frontend-only modal open. No backend endpoint. | Frontend-only modal open. No backend endpoint. | Frontend-only modal open. No backend endpoint. |
| Load current service | `GET /orm/api/agents/v1/project-executor-agent-services/by-project/{project_uid}/` | `GET /orm/api/agents/v1/coding-agent-services/?agent_type=astro-orchestrator&scope_kind=user&user_uid=<user_uid>` | `GET /orm/api/agents/v1/coding-agent-services/` for both, with config-driven filters. Project coder should use `?agent_type=project-executor&scope_kind=project&project_uid=<project_uid>`. Astro should use `?agent_type=astro-orchestrator&scope_kind=user&user_uid=<user_uid>`. |
| Load defaults fallback | No backend endpoint. Project flow does not read global defaults today. | `GET /orm/api/agents/v1/coding-agent-deployment-defaults/` is read eagerly today. | Read `GET /orm/api/agents/v1/coding-agent-deployment-defaults/` only if the current-service read returns no service to hydrate from. Defaults are fallback-only, not a first read. |
| Load authoritative current LLM config | Today project coder does an extra `GET /orm/api/agents/v1/agents/{agent_uid}/` read when a linked agent exists. | Astro already uses `llm_provider`, `llm_model`, and `llm_thinking` from the service serializer. No extra endpoint. | No extra backend endpoint. Treat the current-service serializer from `GET /orm/api/agents/v1/coding-agent-services/?...` as the authoritative source for `llm_provider`, `llm_model`, `llm_thinking`, and deployed resource values. If no service exists, hydrate from `GET /orm/api/agents/v1/coding-agent-deployment-defaults/` when defaults are enabled. |
| Load model catalog | `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` via shared available-run-config API | Must use the same `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` via shared available-run-config API | Always use `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` via the shared available-run-config API, regardless of whether a current service exists. If the model-catalog request errors, stay in the same unified workflow and show one shared error/gated state instead of branching into a separate implementation path. |
| Resolve provider/model/thinking | Frontend-only selection resolution after service and model-catalog reads. No backend endpoint. | Frontend-only state hydration after service/defaults and model-catalog reads. No backend endpoint. | Frontend-only shared `resolveRunConfigSelection(...)` using the current-service serializer values first and defaults only when no service exists. No backend endpoint. |
| Render LLM controls | Frontend-only `RunConfigFields` render. No backend endpoint. | Frontend-owned separate LLM render path. No backend endpoint. | Frontend-only shared `RunConfigFields` render. No backend endpoint. |
| Render resource controls | Frontend-only resource form render after service reads. No backend endpoint. | Frontend-only resource form render after service/defaults reads. No backend endpoint. | Frontend-only shared resource section. No backend endpoint. |
| Validation | Frontend-only validation before deploy confirmation. No backend endpoint. | Frontend-only validation before direct submit. No backend endpoint. | Frontend-only shared validation pipeline. No backend endpoint. |
| Confirmation | Frontend-only `ActionConfirmationDialog` before submit. No backend endpoint. | No confirmation step today. No backend endpoint. | Frontend-only shared confirmation step. No backend endpoint. |
| Build payload | Frontend-only payload assembly for `POST /orm/api/agents/v1/coding-agent-services/deploy/` | Frontend-only payload assembly for `POST /orm/api/agents/v1/coding-agent-services/deploy/` | Frontend-only shared payload builder targeting `POST /orm/api/agents/v1/coding-agent-services/deploy/`. |
| Submit | `POST /orm/api/agents/v1/coding-agent-services/deploy/` with `agent_type=project-executor`, project scope, resolved LLM values, resources, and `automatic_deployment` | `POST /orm/api/agents/v1/coding-agent-services/deploy/` with `agent_type=astro-orchestrator`, user scope, resolved LLM values, and resources | Same shared submit hook to `POST /orm/api/agents/v1/coding-agent-services/deploy/`, with differences only in config-driven scope and supported fields. |
| Post-submit lifecycle | Frontend stores result and polls `GET /orm/api/agents/v1/project-executor-automatic-deployment-runs/?ordering=-created_at&limit=20` for progress | Frontend stores result and refreshes current service, currently without the same deployment-run polling endpoint | Shared lifecycle. Config decides whether to poll `GET /orm/api/agents/v1/project-executor-automatic-deployment-runs/?ordering=-created_at&limit=20`, refetch `GET /orm/api/agents/v1/coding-agent-services/...`, or use another strategy. |

## Design Principle

The correct abstraction is not:

- one Astro deployment flow
- one project-coder deployment flow

The correct abstraction is:

- one coding-agent deployment workflow
- multiple deployment configurations

## Target Architecture

Introduce a shared deployment feature made of three layers.

### 1. Shared Controller

Create a shared controller hook, for example:

- `useCodingAgentDeploymentController(config)`

It should own:

- current service loading
- conditional defaults loading only when current service is missing
- model-catalog loading through `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` in all cases
- run-config resolution
- form hydration
- validation
- confirmation state
- deploy mutation
- post-submit refresh or polling

### 2. Shared Presentation

Keep one presentational shell, with shared sections:

- deployment status
- LLM section
- resource section
- optional automation section
- optional warning panels
- confirmation dialog
- result panel

The LLM section must always use `RunConfigFields`.

### 3. Configuration Layer

Each deployment type supplies a configuration object only.

Expected config shape:

- `agentType`
- `scopeKind`
- `loadCurrentService`
- `loadDefaultsFallback`
- `resourceFieldSchema`
- `showGpuFields`
- `showAutomationSection`
- `showImageDriftPanel`
- `confirmationCopy`
- `postSubmitStrategy`
- `labels`

## Recommended Refactor Steps

1. Extract shared read models.
   Normalize current-service, defaults, and deploy-result inputs into one internal shape.

2. Standardize current-service reads on the generic coding-agent-services endpoint.
   Project coder should stop using a project-specific read helper and move to the same filtered
   `coding-agent-services/` query shape already used by Astro.

3. Make defaults a fallback-only branch.
   After the shared current-service read:
   - if service exists, do not query `GET /orm/api/agents/v1/coding-agent-deployment-defaults/`
   - if service does not exist, query `GET /orm/api/agents/v1/coding-agent-deployment-defaults/`
     only when that deployment type allows defaults-based hydration

4. Extract shared LLM selection logic.
   Move all provider/model/thinking hydration and fallback rules behind one controller path.

5. Standardize model-catalog loading.
   Always call `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` via the
   shared available-run-config API, even when a current service already exists.
   If the catalog request fails, keep the user inside the same shared configurator with one shared
   error state and one shared deploy gating rule.

6. Standardize current-config source of truth.
   When a current service exists, use the fields already returned by
   `GET /orm/api/agents/v1/coding-agent-services/?...` as the source of truth for
   `llm_provider`, `llm_model`, `llm_thinking`, and deployed resource values.
   Use defaults only when no current service exists and configuration allows defaults-based hydration.

7. Standardize validation.
   Both flows should use the same validation contract for:
   - model availability
   - model usability
   - required resource fields
   - optional sections

8. Standardize submit.
   Both flows should pass through one confirmation step and one payload builder.

9. Move specialized behavior into config.
   Project-only and Astro-only concerns should be opt-in panels or field groups, not separate workflow codepaths.

10. Collapse the two top-level configurators.
    Keep thin wrappers only if needed for routing or modal integration.
    They should provide config and nothing more.

## What Should Remain Different

These are valid configuration-level differences:

- `project-executor` vs `astro-orchestrator`
- project scope vs user scope
- project automation toggle vs none
- image-drift warnings vs none
- GPU fields enabled vs disabled
- deployment-state messaging
- post-submit polling strategy

These are not valid differences:

- separate picker logic
- separate hydration rules
- separate validation logic
- separate confirmation behavior
- separate payload assembly rules for shared fields

## Acceptance Criteria

- Both Astro and project coder use the same shared LLM picker component.
- Both Astro and project coder use the same selection resolution logic.
- Both Astro and project coder use the same confirmation workflow.
- Both Astro and project coder use the same deploy mutation path.
- The only remaining differences are config-driven.
- Removing one deployment type should not require editing the shared workflow internals.
- Adding a third coding-agent deployment type should require only a new config object and optional specialized panels.

## Migration Notes

- Preserve existing API helpers during the refactor, then simplify thin wrappers after the shared controller is in place.
- Avoid changing backend contracts during this pass.
- Prefer introducing the shared controller first, then migrating one surface at a time.
- Use the project-coder flow as the baseline because it already contains the richer validation and confirmation path.
- Do not eagerly query `GET /orm/api/agents/v1/coding-agent-deployment-defaults/` in the shared flow.
  Defaults should only be fetched when the current-service query returns no deployable service.
- Always query `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` through the
  shared available-run-config API.
- Model-catalog failure should not create a separate Astro or project-only fallback workflow.
  It should produce one shared error state in the unified configurator.

## Recommended Implementation Order

1. Build the shared controller and shared confirmation flow.
2. Move project-coder current-service loading onto filtered `coding-agent-services/`.
3. Implement conditional defaults loading only after the unified current-service read returns no service.
4. Standardize model-catalog loading on `GET /api/chat/get_available_models?created_by_user_uid=<user_uid>` via the shared available-run-config API for both flows.
5. Migrate project coder to the controller without changing behavior beyond the unified service read.
6. Migrate Astro to the same controller and shared `RunConfigFields`.
7. Delete duplicated Astro workflow logic.
8. Reduce any leftover specialized wrappers to configuration-only adapters.
