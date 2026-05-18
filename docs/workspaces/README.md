---
id: workspaces-index
title: Workspaces
slug: /workspaces
---

This section covers the workspace builder, its persistence model, and the runtime behavior that
keeps workspace editing and execution coherent.

## Read This Section First

1. [Workspace Overview](./overview.md)
2. [Reference Variables](./reference-variables.md)
3. [Dashboard Layouts](./dashboard-layouts.md)
4. [Workspace Backend Model](./backend-model.md)
5. [Workspace Runtime Performance Remediation](./runtime-performance-remediation.md)
6. [Workspace Settings Headless Runtime Investigation](./settings-headless-runtime-investigation.md)

## How To Extend Workspaces

- Put workspace-wide behavior here when it changes the shared authoring or runtime contract.
- Put widget-specific workspace behavior in the owning widget `README.md` and link to it from the
  widget docs index.
- If the change is architectural, add or update an ADR in [`../adr/`](../adr/README.md).

## Workspace ADRs

- [ADR 059: User-Instance Canonical Workspace Controls](../adr/command_center/adr-059-user-instance-canonical-workspace-controls.md)

## Guidelines

- Separate user-visible authoring behavior from backend persistence proposals.
- Keep performance investigations and remediation plans close to the workspace section instead of
  scattering them under ADRs or generic platform docs.
- When a new workspace capability depends on one widget family, document both the workspace contract
  here and the widget contract in the local widget `README.md`.
- Reference-variable changes must document both the persisted binding contract and the runtime
  refresh path, because a valid saved graph can still fail if the coordinator is not mounted in the
  active workspace host.
