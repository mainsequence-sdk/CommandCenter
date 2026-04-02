# Workspace Instructions

## Documentation Requirements

- Every extension, widget, and other major feature module must include a `README.md` in its directory.
- The README should describe the purpose of the module, its main entry points, important dependencies, and any notable behavior or maintenance constraints.
- When adding a new directory under `extensions/`, `src/widgets/`, or a similar feature area, add the README in the same change.
- When changing architecture or ownership of a module, update the local README so it stays accurate.

## Main Sequence Extension

- Keep `extensions/main_sequence/` documented at the directory level.
- Shared APIs, reusable UI building blocks, and feature-specific screens should each be documented in the nearest directory README.

## Storage Contract Changes

- If a frontend change modifies the persisted workspace, widget, binding, runtime-state, or other storage model, explicitly assess whether it changes the backend contract too.
- If the storage shape, serialization, or persistence semantics change in a way the backend may need to understand, call that out clearly in the change and notify the backend side instead of treating it as a frontend-only detail.
