# Main Sequence Foundry

This nested extension owns the administrative and operational Main Sequence Foundry surfaces.

## Entry Points

- `index.ts`: registers the Foundry extension with the shell registry.
- `app.ts`: declares the `AppDefinition` for `main_sequence_workbench`.
- `features/`: page surfaces and feature-owned workflows.
- `connections/`: extension-owned connection type definitions and compatibility helpers for
  backend Data Node and Simple Table access.
- `widget-contracts/`: shared versioned data contracts used for widget-to-widget composition inside
  Workbench.
- `widgets/`: widget definitions and widget-specific rendering code.

## Dependencies

- Shared Main Sequence transport, UI, and hooks come from `../../common/`.
- Shell-level primitives continue to come from the `@/` alias.

## Rules

- Keep Foundry-only pages, routes, and widgets here.
- Move code into `../../common/` only when it is meant to be reused by another Main Sequence extension.
- Foundry surfaces in `app.ts` now also carry assistant-facing summaries and action lists through
  `assistantContext`; keep those descriptions aligned with the actual page capabilities.
- `index.ts` currently registers `main-sequence-dependency-graph` and
  `main-sequence-project-infra-graph` in the live widget catalog, plus Main Sequence connection
  types in the connection catalog. The former Data Node source, table, graph, and statistic widgets
  are no longer registered from Workbench; source querying, reshaping, and generic tabular
  consumption now live in core widgets.

## Naming note

- The folder and internal ids still use `workbench` for compatibility, but the user-facing application name is now `Main Sequence Foundry`.
