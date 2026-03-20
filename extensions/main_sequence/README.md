# Main Sequence Namespace

This directory is a namespace for multiple Main Sequence extensions plus the shared domain code they reuse.

## Structure

- `common/`: shared Main Sequence API helpers, reusable UI, hooks, and shared assets.
- `extensions/workbench/`: the Main Sequence Workbench app extension.
- `extensions/markets/`: the Main Sequence Markets app extension.
- `extensions/`: nested extension entrypoints loaded by the shell registry.

## Maintenance Notes

- Keep reusable pieces in `common/` only when they are used by more than one nested extension.
- Keep feature-specific components inside the owning nested extension, even if they are large.
- Do not import from one nested extension into another nested extension.
- When adding a new folder here, include a `README.md` for that folder.
