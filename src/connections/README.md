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
- `ConnectionQueryResponsePreview.tsx`: shared renderer for normalized connection query responses.
  It renders one canonical tabular frame as a table or, when `meta.timeSeries` hints are present,
  as a graph/table preview using the core graph renderer.
- `ConnectionQueryWorkbench.tsx`: shared query authoring, generated request preview, test
  execution, and normalized response preview surface used by workspace Connection Query widget
  settings and Data Sources Explore.
- `components/ConnectionPicker.tsx`: reusable widget/settings picker for selecting a configured
  connection instance by stable `ConnectionRef`.
- `components/ConnectionQueryEditorFields.tsx`: reusable controls for connection-specific
  `queryEditor` components rendered by the Connection Query widget.
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
  The core Connection Query widget is the generic workspace source for connection data and
  publishes one normalized `core.tabular_frame@v1` frame; downstream table, chart, statistic, and
  transform widgets should bind to that output rather than storing connection ids or query
  endpoints themselves. Chartable datasets can still carry `meta.timeSeries` hints inside that
  frame.
- Data Sources Explore and workspace Connection Query settings must use
  `ConnectionQueryWorkbench.tsx` so they generate the same `ConnectionQueryRequest`, use the same
  typed connection editors, and preview the same normalized runtime frame. Do not add another
  direct Explore-only `queryConnection(...)` path for standard query-capable connections.
- Connection type `queryEditor` components receive the selected connection instance and selected
  query model. Use them for per-connection query kwargs such as Data Node columns, SQL parameters,
  PromQL matchers, or PostgreSQL time-series field mapping instead of forcing users through a
  generic JSON object.
- Explore surfaces and widget test previews should use `ConnectionQueryResponsePreview.tsx` for
  response rendering so frame contracts are interpreted consistently across adapters.
- System fallback helpers are limited to explicit legacy runtime defaults. They must not appear in
  connection management, Explore, or any API response that represents backend-owned instances.
