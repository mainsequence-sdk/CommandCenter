# Main Sequence Workbench

This nested extension owns the administrative and operational Main Sequence surfaces.

## Entry Points

- `index.ts`: registers the Workbench extension with the shell registry.
- `app.ts`: declares the `AppDefinition` for `main_sequence_workbench`.
- `features/`: page surfaces and feature-owned workflows.
- `widgets/`: widget definitions and widget-specific rendering code.

## Dependencies

- Shared Main Sequence transport, UI, and hooks come from `../../common/`.
- Shell-level primitives continue to come from the `@/` alias.

## Rules

- Keep Workbench-only pages, routes, and widgets here.
- Move code into `../../common/` only when it is meant to be reused by another Main Sequence extension.
- `index.ts` currently registers both `main-sequence-data-node-visualizer` and
  `data-node-table-visualizer` in the live widget catalog.
