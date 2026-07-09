---
id: access-control-index
title: Access Control
slug: /access-control
---

This section covers reusable RBAC primitives and the dedicated access-control application.

Command Center Access & RBAC now treats shell access as a read-only visualization contract:
backend-owned shell-access resolution returns applications and submenus that the frontend can show
or hide. This does not replace backend resource authorization, Teams, team membership, workspace
sharing, object sharing, or resource sharing.

## Read This Section First

1. [RBAC Assignment Matrix](./rbac-assignment-matrix.md)
2. [Access & RBAC App](./access-rbac-app.md)
3. [ADR 080: Resolved Shell Access As Visualization Gates](../adr/command_center/adr-080-resolved-shell-access-as-visualization-gates.md)

## How To Extend Access Control

- Document reusable permission primitives here.
- Keep extension- or app-specific permission workflows in the owning extension `README.md`, then
  link back here if they rely on shared RBAC contracts.

## Guidelines

- Distinguish reusable access-control components from one app's governance workflow.
- Keep permission semantics and UI surfaces documented together when they are tightly coupled.
- Do not model shell-access assignment as a frontend policy editor. Use the inspector to explain
  resolved access; keep authoring in backend or platform-only tooling.
