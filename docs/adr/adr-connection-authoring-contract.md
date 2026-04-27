# ADR: Shared Connection Authoring Contract

- Status: Accepted
- Date: 2026-04-27
- Related:
  - [ADR: First-Class Connection Model](./adr-first-class-connection-model.md)
  - [ADR: Standardized Connection Result Contracts](./adr-standardized-connection-result-contracts.md)
  - [ADR: Managed Connection Query Sources for Consumer Widgets](./adr-managed-connection-query-widget-sources.md)

## Context

Command Center had one shared connection runtime, one shared connection-query widget, and one
shared `ConnectionQueryWorkbench`, but connection authoring still drifted because Explore behavior
was allowed to live in per-connection wrapper components.

That wrapper pattern created two paths for the same connection:

- Data Sources Explore
- widget-managed or standalone `connection-query` authoring

Both paths eventually hit the same backend adapter, but they were allowed to disagree on default
query model selection, seeded query payloads, request-level `maxRows`, fixed date defaults,
datasource summary affordances, and even which query models were valid for a configured
connection.

The drift was already visible:

- **Prometheus**: Explore had the correct PromQL authoring defaults and exploration behavior while
  widget-managed connection settings had fallen back to a different initialization path. This has
  already been fixed.
- **Massive**: Explore filtered query models by configured asset classes, beta gating, and
  deprecated gating. Widget settings used the raw catalog and could expose invalid paths for the
  selected connection instance.
- **Main Sequence Simple Table**: Explore seeded real SQL
  `select * from {{simple_table}} limit 100`, seeded request-level `maxRows` from connection
  config, and showed configured-table metadata and columns. Widget settings did not.
- **Main Sequence Data Node**: Explore seeded request-level `maxRows` from `defaultLimit`. Widget
  settings only exposed payload-level `limit`.
- **Alpaca / Binance / FRED**: Explore owned initial draft defaults such as preferred query model,
  lookback range, and request-level `maxRows`, while widget settings depended on generic fallback
  seeding.
- **PostgreSQL**: drift risk was lower, but source summary cards existed only in the Explore shell.

This architecture makes drift possible by design. As long as a connection can implement a custom
Explore wrapper, the shared widget path is only conventionally aligned instead of structurally
aligned.

## Decision

Connection authoring will be expressed through one shared `ConnectionAuthoringContract`.

`ConnectionTypeDefinition` now exposes optional `authoringContract` metadata. That contract is the
only place where a connection type may customize normal query authoring behavior shared across
Explore and widget settings.

The contract owns:

- query-model resolution and filtering
- draft default resolution
- optional source summary UI
- Explore title/description/run-label/result-copy

The shared surfaces are:

- `ConnectionExploreSurface.tsx` for Data Sources Explore
- `ConnectionQueryWorkbench.tsx` for standard query authoring, request generation, preview
  execution, and normalized response preview
- `ConnectionQuerySettingsSurface.tsx` for dashboard-aware widget settings

Explore must use the same workbench and typed `queryEditor` path as widget settings. Connection
types may still provide typed `queryEditor` components for query-payload fields, but they may not
provide separate normal-query Explore wrapper components.

## Contract Shape

```ts
export interface ConnectionAuthoringContract {
  resolveQueryModels?: (input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
    queryModels: ConnectionQueryModel[];
  }) => ConnectionQueryModel[];
  resolveDraftDefaults?: (input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
    queryModels: ConnectionQueryModel[];
    selectedQueryModel?: ConnectionQueryModel;
  }) => ConnectionQueryDraftDefaults;
  SummaryComponent?: ComponentType<ConnectionAuthoringSummaryProps>;
  exploreTitle?: string;
  exploreDescription?: string;
  exploreRunButtonLabel?: string;
  exploreResultTitle?: string;
  exploreResultDescription?: string;
}
```

`ConnectionTypeDefinition.exploreComponent` is removed from the main app path. The old
wrapper-based flow is not part of the supported architecture anymore.

## Implementation

### Shared platform

- Added `authoringContract` to `ConnectionTypeDefinition`.
- Added `src/connections/connectionAuthoringContract.tsx` for shared contract helpers.
- Added `src/connections/ConnectionExploreSurface.tsx` as the generic Explore surface.
- Updated `ConnectionQueryWorkbench.tsx` to resolve:
  - filtered query models
  - draft defaults
  - summary UI
  from the shared contract.
- Updated the Connections app to render `ConnectionExploreSurface.tsx` instead of per-connection
  Explore wrappers.

### Connection migrations

- **Prometheus**: uses `prometheusAuthoring.tsx` for datasource summary and PromQL draft defaults.
- **Massive**: uses `massiveAuthoring.tsx` for config-aware query-model filtering and draft
  seeding.
- **Simple Table**: uses `simpleTableAuthoring.tsx` for seeded SQL, request-level default rows,
  configured-table metadata, and column badges.
- **Data Node**: uses `dataNodeAuthoring.ts` for request-level default rows and shared Explore
  copy.
- **Alpaca / Binance / FRED**: use authoring contracts for draft seeding and Explore copy; FRED
  also shares summary badges.
- **PostgreSQL**: uses `postgreSqlAuthoring.tsx` for shared source summary cards and Explore copy.

The old per-connection Explore wrapper components were removed after the shared contract took over
their remaining responsibilities.

## Consequences

Positive:

- Explore and widget connection authoring now share one source of truth.
- Query-model filtering can no longer diverge between the two surfaces.
- Request-level defaults such as `maxRows`, fixed ranges, and seeded SQL/PromQL now come from the
  same contract everywhere.
- Connection-specific source summaries are shared instead of hand-copied into an Explore-only
  shell.
- Widget settings now inherit the same connection-defined primary action labels as Explore instead
  of overriding them with generic `Test` copy.
- Managed widget-owned connection sources and standalone `connection-query` widgets now inherit the
  exact same authoring behavior as the Connections app.

Negative:

- Connection types must move any normal-query Explore customization into the shared contract before
  it can ship.
- The contract must stay focused on shared authoring behavior. Connection-specific resource
  exploration such as Prometheus metadata lookups still belongs in the typed `queryEditor` or
  backend resources, not in a second Explore shell.

## Guardrails

- Do not add a new per-connection Explore wrapper for standard query authoring.
- Do not seed widget defaults from ad hoc widget code when the value belongs to a connection type.
- Do not filter connection query models in one surface and not the other.
- Do not duplicate source-summary cards between Explore and widget settings.
- Do not fabricate or surface placeholder connection instances in Explore, widget settings, or
  widget runtime resolution. Real execution must use backend-owned instance ids only.
- Do not treat a frontend-local connection-instance cache as authoritative for runtime ref repair.
  When runtime resolution is allowed to fetch, it must reload the backend connection catalog.
- Keep typed query editors as the only connection-specific query-payload authoring path.

## Backend And Storage Impact

This refactor does **not** change:

- persisted workspace shape
- persisted connection instance shape
- backend query payload shape
- backend resource payload shape
- normalized response frame contracts

The change is frontend-only architecture and authoring behavior. Backend adapters do not need new
support as long as they already satisfy the existing connection type contracts.

## Rollout Tasks

- [x] Add `authoringContract` to connection type definitions.
- [x] Add shared helpers for authoring contract resolution and draft seeding.
- [x] Route the Connections app through one generic Explore surface.
- [x] Update `ConnectionQueryWorkbench` to consume shared contract query models, defaults, and
  summaries.
- [x] Migrate Prometheus, Massive, Data Node, Simple Table, Alpaca, Binance, FRED, and PostgreSQL
  to authoring contracts.
- [x] Remove per-connection normal-query Explore wrappers from the main app path.
- [x] Add focused tests for shared contract behavior.
- [x] Update README and widget/connection authoring docs to describe the new architecture.
