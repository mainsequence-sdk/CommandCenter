---
id: workspaces-index
title: Workspaces
slug: /workspaces
---

This section covers the workspace builder, its persistence model, and the runtime behavior that
keeps workspace editing and execution coherent.

## Read This Section First

1. [Workspace Overview](./overview.md)
2. [Dashboard Layouts](./dashboard-layouts.md)
3. [Workspace Backend Model](./backend-model.md)
4. [Workspace Runtime Performance Remediation](./runtime-performance-remediation.md)
5. [Workspace Settings Headless Runtime Investigation](./settings-headless-runtime-investigation.md)

## How To Extend Workspaces

- Put workspace-wide behavior here when it changes the shared authoring or runtime contract.
- Put widget-specific workspace behavior in the owning widget `README.md` and link to it from the
  widget docs index.
- If the change is architectural, add or update an ADR in [`../adr/`](../adr/README.md).

## Guidelines

- Separate user-visible authoring behavior from backend persistence proposals.
- Keep performance investigations and remediation plans close to the workspace section instead of
  scattering them under ADRs or generic platform docs.
- When a new workspace capability depends on one widget family, document both the workspace contract
  here and the widget contract in the local widget `README.md`.
