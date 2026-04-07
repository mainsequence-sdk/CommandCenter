# Main Sequence Foundry

This nested extension owns the administrative and operational Main Sequence Foundry surfaces.

## Entry Points

- `index.ts`: registers the Foundry extension with the shell registry.
- `app.ts`: declares the `AppDefinition` for `main_sequence_workbench`.
- `features/`: page surfaces and feature-owned workflows.
- `widget-contracts/`: shared versioned data contracts used for widget-to-widget composition inside
  Workbench.
- `widgets/`: widget definitions and widget-specific rendering code.

## Dependencies

- Shared Main Sequence transport, UI, and hooks come from `../../common/`.
- Shell-level primitives continue to come from the `@/` alias.

## Rules

- Keep Foundry-only pages, routes, and widgets here.
- Move code into `../../common/` only when it is meant to be reused by another Main Sequence extension.
- `index.ts` currently registers `main-sequence-dependency-graph`,
  `main-sequence-project-infra-graph`, `main-sequence-data-node-visualizer`,
  `main-sequence-data-node`, `main-sequence-data-node-statistic`, and
  `data-node-table-visualizer` in the live widget catalog.

## Naming note

- The folder and internal ids still use `workbench` for compatibility, but the user-facing application name is now `Main Sequence Foundry`.
