# Main Sequence Namespace

This directory is a namespace for multiple Main Sequence extensions plus the shared domain code they reuse.

## Structure

- `common/`: shared Main Sequence API helpers, reusable UI, hooks, and shared assets.
- `extensions/workbench/`: the Main Sequence Foundry app extension. It currently ships the
  composable `Dependency Graph`, `Data Node`, `Data Node Graph`, `Statistic`, and `Data Node Table`
  widgets.
- `extensions/markets/`: the Main Sequence Markets app extension.
- `extensions/`: nested extension entrypoints loaded by the shell registry.

## Shared Permissions Model

- Shareable Main Sequence entities use one common permission idea: a single object root plus a
  standard set of suffix-based endpoints for candidate users, `can-view`, `can-edit`, and add/remove
  mutations for both users and teams.
- Frontend surfaces should reuse the shared `MainSequencePermissionsTab` instead of duplicating
  per-feature permission UIs.
- The API layer builds these permission requests from `main_sequence.permissions` config suffixes,
  while each feature supplies only the target object root and object id.
- Most Foundry CRUD objects use pods-scoped roots such as `projects`, `secret`, `constant`, or
  `resource-release`, but some entities live under other API roots. For example, Data Nodes use the
  absolute `ts_manager/dynamic_table` root even though they still follow the same permission flow.
- Feature READMEs should only document object-specific deviations, such as a non-default object
  root, rather than restating the whole permission model.

## Maintenance Notes

- Keep reusable pieces in `common/` only when they are used by more than one nested extension.
- Keep feature-specific components inside the owning nested extension, even if they are large.
- Do not import from one nested extension into another nested extension.
- When adding a new folder here, include a `README.md` for that folder.
