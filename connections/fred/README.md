# FRED Economic Data Connection

This module registers the Command Center frontend definition for the backend-owned FRED Economic Data adapter.

## Purpose

The connection exposes Federal Reserve Economic Data series observations and selector resources through generic Command Center connection routes. It is designed for macroeconomic and regional economic time series, not trading, account, execution, or FRED bulk release-download workflows.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config types, query types, query model, examples, and agent-facing `usageGuidance`.
- `FredConnectionConfigEditor.tsx`: renders stable public configuration fields for the FRED endpoint, default series observation parameters, timeout, cache, and dedupe controls.
- `FredConnectionQueryEditor.tsx`: renders query payload controls for `fred-series-observations`.
- `FredConnectionExplore.tsx`: wraps the shared `ConnectionQueryWorkbench` for live backend-routed query testing.
- `src/connections/assets/fred-economic-data-logo.svg`: FRED-style economic data icon used in connection catalogs and pickers.

## Backend Adapter Contract

- Type id: `finance.fred-economic-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/fred_economic_data.py`
- Routes: generic `/test/`, `/query/`, and `/resources/<resource>/` connection routes only.
- Provider access: backend uses `requests`; no `fredapi`, `pandas_datareader`, async HTTP client, or provider-specific dependency.
- Output contract: `fred-series-observations` returns exactly one `core.tabular_frame@v1` frame. The adapter must not set `meta.timeSeries`.
- Secure config: `apiKey` is write-only and must never be serialized back to the frontend.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by the backend adapter for endpoint, default query values, timeout, cache, and dedupe behavior. The secure `apiKey` field is stored through backend secure config and sent to FRED only by the backend as the `api_key` parameter.

## Query And Resource Ownership

Supported query kind:

- `fred-series-observations`

The query returns observation rows with `date`, `seriesId`, `value`, `valueRaw`, `realtimeStart`, and `realtimeEnd`. `date` is normalized to UTC epoch milliseconds, `value` is numeric or `null` when FRED returns `.`, and `valueRaw` preserves the provider string.

Supported resources:

- `series-search`
- `series-detail`
- `series-vintage-dates`
- `releases`
- `release-dates`

The backend owns series id validation, time-range mapping to `observation_start` and `observation_end`, realtime and vintage parameters, provider limit clamping, pagination metadata, cache-key dimensions, in-flight dedupe, provider error translation, and response normalization.

## Maintenance Constraints

- Keep query models aligned with ADR 012 and the backend adapter implementation.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- If public config, secure config, query payload, resource payload, health result, or response frame shape changes, assess the backend contract before treating the change as frontend-only.
- Backend contract impact for this change: this frontend module depends on the ADR 012 backend adapter contract. It does not add type-specific routes or change persisted connection instance shape outside the new FRED connection type manifest.
