# MS Markets API Binding Tasks

Implementation tasks for [ADR 075: MS Markets API Binding](../../adr/main_sequence/adr-075-ms-markets-api-binding.md).

## Task Order

1. [Task 001: Bind Main Sequence Markets To Adapter From API Connection](./task-001-bind-main-sequence-markets-to-adapter-from-api.md)

## Current Status

Planning documentation only. Implementation has not started.

## Non-Goals

- Do not create a new connection type.
- Do not create a `mainsequence.markets` wrapper adapter.
- Do not introduce a separate app-configuration table for the binding.
- Do not make the binding user-persisted.
- Do not migrate workspace widget `connectionRef` storage.
- Do not change existing Main Sequence Markets API response shapes.
