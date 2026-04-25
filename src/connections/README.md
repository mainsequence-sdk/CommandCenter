# Connections

This directory owns the shared Command Center connection model introduced by the first-class
connection ADR. Connections are platform data-access resources, not widgets.

## Entry Points

- `types.ts`: extension-facing connection type metadata, backend-owned connection instance shapes,
  query/resource contracts, and health results.
- `api.ts`: authenticated frontend client for connection type, instance, health, query, resource,
  and stream endpoints. Instance list reads are backend-authoritative and do not inject local
  fallback records.
- `hooks.ts`: React Query wrappers for connection catalogs, instances, queries, and resources.
- `components/ConnectionPicker.tsx`: reusable widget/settings picker for selecting a configured
  connection instance by stable `ConnectionRef`.
- `assets/`: shared connector logo assets used by connection type definitions and generic
  connection UI.

## Maintenance Constraints

- Connection type definitions are extension-owned metadata and must not contain organization
  secrets, tokens, or mutable instance state.
- Connection instances are backend-owned. The frontend may send secret values when creating or
  updating an instance, but it must only read `secureFields` indicators back.
- Connection authorization is enforced through the existing platform and Main Sequence permission
  systems. This package does not define a separate connection-permission model.
- Widgets and workspaces should store stable `ConnectionRef` values: `{ uid, typeId }`.
- Workspace source widgets should query backend-owned connection instances through `ConnectionRef`.
  The core Connection Query widget is the generic workspace source for tabular connection data and
  publishes `core.tabular_frame@v1`; downstream table, chart, statistic, and transform widgets
  should bind to that output rather than storing connection ids or query endpoints themselves.
- System fallback helpers are limited to explicit legacy runtime defaults. They must not appear in
  connection management, Explore, or any API response that represents backend-owned instances.
