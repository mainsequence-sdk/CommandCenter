---
id: adr-index
title: Architecture Decision Records
slug: /adr
---

This section is the architectural decision log for the repository, split by application ownership.

## Applications

- [Command Center](./command_center/README.md): workspace runtime, widgets, connections, shell,
  AppComponent, and other platform ADRs for the main application.
- [Main Sequence AI](./mainsequence_ai/README.md): assistant runtime, AgentSession, agent-facing
  UI, and project-agent ADRs for the AI application surface.

## Guidelines

- Keep ADRs under `docs/adr/<application>/`. Do not add new ADR markdown files directly under
  `docs/adr/`.
- Use the app-level README as the local ADR index for that application.
- Write an ADR when the choice changes a shared contract, not for every implementation detail.
- New ADRs should use the next available sequential number in both the filename and title so
  chronology stays visible across the repository, for example `adr-058-short-name.md` and
  `# ADR 058: Title`.
- Update the nearest implementation `README.md` when an accepted ADR changes authoring or runtime
  expectations.
