# Adapter From API Debug Direct Mode Tasks

Implementation tasks for [ADR 074: Adapter From API Debug Direct Mode](../../adr/command_center/adr-074-adapter-from-api-debug-direct-mode.md).

## Task Order

1. [Task 001: Backend Direct Mode Persistence Contract](./task-001-backend-direct-mode-persistence.md)
2. [Task 002: Frontend Config And Direct Discovery](./task-002-frontend-config-and-direct-discovery.md)
3. [Task 003: Direct Execution Runtime And Workspace Routing](./task-003-direct-execution-runtime-and-workspace-routing.md)

## Current Status

The initial implementation is complete for backend persistence, frontend direct discovery,
browser-direct query execution, widget/Explore routing, and direct health checks. Remaining
follow-up work is focused on browser UI tests, direct/backend response parity fixtures, and a
client-side discovery response-size limit.

## Non-Goals

- Do not create a new connection type.
- Do not create `mainsequence.markets`.
- Do not change widget `connectionRef` storage.
- Do not make backend private-network access the primary debug solution.
- Do not expose backend-stored secrets to browser direct mode.
- Do not add direct-mode auth headers, token fields, or browser session-storage auth.
