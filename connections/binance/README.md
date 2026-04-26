# Binance Market Data Connection

This module registers the Command Center frontend definition for the backend-owned Binance Market Data adapter.

## Purpose

The connection exposes Binance spot and USD-M futures market-data queries through generic Command Center connection routes. It is not an authenticated account, order-management, wallet, or user-data integration.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config types, query types, query models, examples, and agent-facing `usageGuidance`.
- `BinanceConnectionConfigEditor.tsx`: renders stable public configuration fields for endpoints, enabled market types, defaults, timeout, cache, and dedupe controls.
- `BinanceConnectionQueryEditor.tsx`: renders query payload controls for supported Binance spot and USD-M futures query kinds.
- `BinanceConnectionExplore.tsx`: wraps the shared `ConnectionQueryWorkbench` for live backend-routed query testing.
- `src/connections/assets/binance-logo.svg`: square Binance logo used in connection catalogs and pickers.

## Backend Adapter Contract

- Type id: `finance.binance-market-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/binance_market_data.py`
- Routes: generic `/test/`, `/query/`, and `/resources/symbols/` connection routes only.
- Provider access: backend uses `requests`; no Binance SDK, `ccxt`, async HTTP client, or provider-specific dependency.
- Output contract: all query models advertise `core.tabular_frame@v1`; the adapter must not set `meta.timeSeries`.
- Secure config: none. Public market-data endpoints do not require stored secrets.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by the backend adapter for endpoint, market-type, symbol metadata, timeout, cache, and dedupe behavior. This frontend module only renders and syncs the manifest; provider execution remains backend-owned.

## Query And Resource Ownership

Supported query kinds are:

- `binance-spot-prices`
- `binance-spot-ohlc`
- `binance-spot-recent-trades`
- `binance-spot-aggregate-trades`
- `binance-usdm-futures-prices`
- `binance-usdm-futures-ohlc`
- `binance-usdm-futures-recent-trades`
- `binance-usdm-futures-aggregate-trades`

The backend owns symbol normalization, exchange-info validation, market-type authorization, provider timestamp handling, endpoint-specific limit caps, response normalization, cache-key dimensions, in-flight dedupe, and rejection of unsupported requests. The query editor uses local symbol token entry; the `symbols` resource remains available for backend validation and optional metadata tooling but is not called before every query.

## Maintenance Constraints

- Keep query models aligned with the backend ADR and adapter implementation.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- If public config, query payload, resource payload, health result, or response frame shape changes, assess the backend contract before treating the change as frontend-only.
