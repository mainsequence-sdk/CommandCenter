# Massive Market Data Connection

This module registers the Command Center frontend definition for the backend-owned Massive Market Data adapter.

## Purpose

The connection exposes Massive REST market data, reference data, news, filings, fundamentals, macroeconomic data, partner datasets, alternative data, and beta futures endpoints through generic Command Center connection routes. It is not a WebSocket, flat-file, arbitrary URL, or provider SDK integration.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config and query types, generated query models, examples, and agent-facing `usageGuidance`.
- `src/connections/assets/massive-icon-logo.svg`: Massive icon used by the connection picker and adapter cards.
- `massiveShared.ts`: owns the frontend endpoint catalog, query-model generation, config field help text, and query-model filtering helpers.
- `MassiveConnectionConfigEditor.tsx`: renders public configuration fields for endpoint host, enabled asset classes, beta/deprecated gates, timeout, cache, row limits, and dedupe controls.
- `MassiveConnectionQueryEditor.tsx`: renders catalog-aware query payload controls for `pathParams`, allowlisted provider `params`, and safe pagination behavior.
- `MassiveConnectionExplore.tsx`: wraps the shared `ConnectionQueryWorkbench` and filters query models by the configured asset classes, beta flag, and deprecated flag.

## Backend Adapter Contract

- Type id: `finance.massive-market-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/massive_market_data.py`
- Routes: generic `/test/`, `/query/`, and `/resources/<resource>/` connection routes only.
- Provider access: backend uses `requests.Session.get`; no Massive, Polygon, `httpx`, `aiohttp`, pandas, or provider SDK dependency.
- Output contract: every widget-bound query returns exactly one `core.tabular_frame@v1`; the adapter must not set `meta.timeSeries`.
- Secure config: `apiKey`, sent by the backend as `Authorization: Bearer <apiKey>` and never returned to the frontend.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by both frontend catalog filtering and backend adapter validation where applicable:

- `baseUrl`
- `enabledAssetClasses`
- `enableBetaEndpoints`
- `enableDeprecatedEndpoints`
- `defaultLimit`
- `maxRows`
- `requestTimeoutMs`
- `queryCachePolicy`
- `queryCacheTtlMs`
- `metadataCacheTtlMs`
- `dedupeInFlight`

Changing these fields changes the persisted connection public config and must be assessed as a backend contract change. This module only renders and syncs the manifest; provider execution and enforcement remain backend-owned.

## Query And Resource Ownership

The frontend catalog mirrors ADR 013 with one query model per `massive-*` query kind. Query payloads use:

- `kind`: cataloged Massive query kind.
- `pathParams`: values substituted into the catalog provider path.
- `params`: provider query parameters that the backend catalog allowlist validates.
- `followPages`: optional backend pagination request for safe Massive `next_url` handling.

Resources are selector and metadata resources only: `endpoint-catalog`, `query-models`, `asset-classes`, and `auth-status`. The adapter must not expose an arbitrary `url` resource.

## Maintenance Constraints

- Keep `massiveShared.ts` aligned with ADR 013 and the backend endpoint catalog.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- Keep beta futures endpoints hidden unless `enableBetaEndpoints` is true and deprecated endpoints hidden unless `enableDeprecatedEndpoints` is true.
- Keep API keys out of public config, examples, query payloads, resource payloads, cache keys, logs, and response metadata.
- If public config, secure config, query payload, resource payload, health result, or response frame shape changes, assess and document the backend contract impact before treating the change as frontend-only.
