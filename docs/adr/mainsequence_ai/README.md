---
id: adr-main-sequence-ai-index
title: Main Sequence AI Architecture Decision Records
slug: /adr/mainsequence_ai
---

This section is the decision log for `Main Sequence AI` application architecture.

## Read This Section First

- Start here when you are changing assistant-runtime transport, AgentSession lifecycle, or
  project-agent UI ownership.
- Read the session/bootstrap ADRs first before changing rail launch behavior or runtime endpoint
  resolution.
- Read the newest project-agent ADR before extending the project-agent workflow again.

## ADRs

- [ADR 078: Capability Registry Surface and Agent Capability Editor Widget](./adr-078-capability-registry-surface-and-editor-widget.md)
- [ADR 077: Unified Astro Coding-Agent Bootstrap](./adr-077-unified-astro-coding-agent-bootstrap.md)
- [ADR 076: Agent Detail Capabilities Tab](./adr-076-agent-detail-capabilities-tab.md)
- [ADR 063: Project Agent Configuration Source of Truth](./adr-063-project-agent-configuration-source-of-truth.md)
- [ADR 062: Remove Unused Agent Capability and Session Resource Models](./adr-062-remove-unused-agent-resource-models.md)
- [ADR 060: Main Sequence AI Session-Backed Chat Request Contract](./adr-060-session-backed-chat-request-contract.md)
- [ADR 058: Refactor Project Agent Creation](./adr-058-refactor-project-agent-creation.md)
- [ADR: AgentSession Interaction Readiness Gate](./adr-agent-session-interaction-readiness-gate.md)
- [ADR: Agent Terminal Managed Session Creation and Agent Allowlist](./adr-agent-terminal-managed-session-creation.md)
- [ADR: Main Sequence AI Workspace Reference Widget](./adr-agent-monitor-workspace-reference-widget.md)

## Guidelines

- Keep `Main Sequence AI` ADRs in this folder instead of mixing them into the broader Command
  Center ADR catalog.
- Use the shared repository ADR sequence for new documents so chronology remains global across the
  codebase.
- Link back to `Command Center` ADRs when AI behavior depends on a shared shell, widget, or
  workspace contract.
