---
id: adr-main-sequence-index
title: Main Sequence Architecture Decision Records
slug: /adr/main_sequence
---

This section is the decision log for `Main Sequence` application architecture inside Command
Center.

## Read This Section First

- Start here when you are changing shared Main Sequence API helpers, identifier contracts, or
  cross-feature entity navigation.
- Read the UID migration ADR before changing Workbench, Markets, or shared Main Sequence widget and
  connection contracts that reference backend entities.
- Keep Main Sequence domain ADRs here instead of mixing them into broader Command Center runtime
  ADRs.

## ADRs

- [ADR 074: UID-Only Main Sequence Backend Identifier Contracts](./adr-074-uid-only-main-sequence-backend-identifier-contracts.md)

## Guidelines

- Keep `Main Sequence` ADRs in this folder instead of mixing them into the broader Command Center
  ADR catalog.
- Use the shared repository ADR sequence for new documents so chronology remains global across the
  codebase.
- Link back to `Command Center` ADRs when Main Sequence behavior depends on shared shell, widget,
  or workspace contracts.
