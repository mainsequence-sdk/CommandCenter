# Project Agents Surface

## Purpose

This surface exposes the AI-owned `Project Agents` tool.

It is the routed entry point for project-agent authoring after the workflow is moved out of the
workbench project-detail tabs.

## Files

- `ProjectAgentsPage.tsx`
  The page shell. It owns project selection, capability gating, and the handoff into the shared
  `ProjectAgentConfigurator`.

## Behavior Notes

- The page starts with explicit project selection instead of assuming project context from a
  workbench route.
- After selection, it fetches project summary/capability state and only reveals the configurator
  when the selected project advertises agent capabilities.
- The page deep-links back into the workbench `Images` tab when the configurator asks to inspect
  built images.
