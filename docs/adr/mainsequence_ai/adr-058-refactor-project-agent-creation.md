# ADR 058: Refactor Project Agent Creation

- Status: Proposed
- Date: 2026-05-05
- Related:
  - [ADR 077: Unified Astro Coding-Agent Bootstrap](./adr-077-unified-astro-coding-agent-bootstrap.md)
  - [ADR: AgentSession Interaction Readiness Gate](./adr-agent-session-interaction-readiness-gate.md)
  - [ADR: Extension-Contributed Shell Settings Menus](../command_center/adr-extension-contributed-shell-settings-menus.md)

## Context

`Project Agent` authoring currently lives inside the `Main Sequence` workbench project detail
surface:

- route: `/app/main-sequence-foundry/projects?msProjectUid=<uid>&msTab=project-agent`
- implementation:
  [MainSequenceProjectAgentTab.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/features/projects/MainSequenceProjectAgentTab.tsx)

That tab now owns several behaviors that are not project-registry concerns:

- build executor images
- deploy executor runtimes
- resolve LLM provider/model configuration from the assistant runtime catalog
- delete project-agent services
- expose the project-agent chat launch affordance in the project header

This is mixing two separate application concerns:

1. `Main Sequence` project/workbench management
2. `Main Sequence AI` agent/runtime authoring

The result is the wrong ownership model.

The project detail page is becoming a transport surface for AI-specific runtime behavior, while the
AI application is the place that already owns:

- assistant-runtime endpoint resolution
- AgentSession lifecycle
- agent-facing UI
- model/provider runtime catalog behavior
- project-agent chat session launch behavior

Keeping `Project Agent` inside the workbench project tabs makes the boundary harder to understand
and harder to evolve. It also makes the UI composition awkward: project CRUD and registry concerns
sit beside agent-runtime deployment concerns, even though the latter are really AI-application
operations.

## Decision

`Project Agent` creation and deployment should move out of the `Main Sequence` project tabs and
become an independent form tool owned by `Main Sequence AI`.

The new ownership model is:

- `Main Sequence` project detail may keep lightweight entrypoints such as:
  - launch project-agent chat
  - show a `Configure project agent` button in the project summary header when the project has
    agent capabilities
- `Main Sequence AI` owns the full project-agent authoring flow:
  - project selection
  - project capability validation
  - source image selection
  - runtime image build
  - deployment image selection
  - compute configuration
  - LLM provider/model configuration
  - deploy/delete lifecycle actions

The `Project Agent` tab should be removed from the `Main Sequence` project detail experience.
Instead, `Main Sequence AI` should expose a dedicated `Project Agents` form tool. That form must
start with an explicit project selector and only reveal the project-agent authoring form after the
selected project has been validated as agent-capable.

The project context should therefore become explicit application input to the AI-owned tool,
rather than an implementation detail embedded inside the workbench project tabs.

## Consequences

### Positive

- separates project-registry concerns from agent-runtime concerns
- aligns project-agent deployment with the application that already owns assistant runtime behavior
- makes LLM provider/model configuration live next to the rest of AI runtime configuration
- gives `Main Sequence AI` one clear surface for future project-agent enhancements
- reduces the amount of AI-specific backend transport embedded in the workbench project page

### Negative

- introduces a surface move, so existing routes and entrypoints need a migration plan
- project-detail users will take one extra navigation step for full project-agent authoring unless
  the AI-owned tool is opened as a dedicated drawer or routed surface

## Implementation Direction

1. Keep the project-header robot launch for chat.
2. Remove the full `Project Agent` deployment form from the workbench project tabs.
3. Restore the project-summary-header entrypoint as a button labeled `Configure project agent`
   instead of a dedicated `Project Agent` tab.
4. Add a `Main Sequence AI` surface/tool named `Project Agents`.
5. The `Project Agents` tool must own project selection explicitly instead of relying on the
   current project-detail route state.
6. Once a project is selected, fetch whether that project has agent capabilities and only show the
   existing project-agent build/deploy/delete form when the answer is true.
7. Let the project detail page deep-link into that AI-owned tool instead of hosting the workflow
   directly.
8. Keep backend contracts unchanged during the UI ownership move unless a later ADR says
   otherwise.

## Implementation Tasks

- [ ] Remove the `Project Agent` tab from the `Main Sequence` project detail tabs.
- [ ] Add a `Configure project agent` button to the project summary header.
- [ ] Only show that header button when the project has agent capabilities.
- [ ] Route the header button into a `Main Sequence AI` `Project Agents` surface instead of a
      workbench-local project tab.
- [ ] Add a `Project Agents` form tool to `Main Sequence AI`.
- [ ] Add a project selector as the first control in that tool.
- [ ] After project selection, fetch the selected project's capability summary.
- [ ] If the selected project does not have agent capabilities, do not show the project-agent
      authoring form.
- [ ] If the selected project has agent capabilities, show the existing project-agent authoring
      form currently implemented in
      [MainSequenceProjectAgentTab.tsx](/Users/jose/code/MainSequenceClientSide/CommandCenter/extensions/main_sequence/extensions/workbench/features/projects/MainSequenceProjectAgentTab.tsx).
- [ ] Move the build-image, deploy, delete, compute, and LLM configuration flows into that
      `Main Sequence AI` tool without changing their backend contract as part of this move.
