# Alpaca Market Data Connection

This module registers the Command Center frontend definition for the backend-owned Alpaca Market Data adapter.

## Purpose

The connection exposes Alpaca equity and crypto market-data queries through the generic Command Center connection routes. It is not a trading or account-management integration; it only describes configuration, query models, icons, and Explore/query editor UI for `finance.alpaca-market-data`.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config types, query types, query models, examples, and agent-facing `usageGuidance`.
- `AlpacaConnectionConfigEditor.tsx`: renders stable public configuration fields, including endpoint defaults, asset classes, feed/location defaults, timeout, cache, and dedupe controls.
- `AlpacaConnectionQueryEditor.tsx`: renders query payload controls for supported Alpaca equity and crypto query kinds.
- `alpacaAuthoring.ts`: defines the shared `authoringContract` used by both Data Sources Explore and widget-managed/standalone `connection-query` settings for draft seeding and Explore copy.
- `src/connections/assets/alpaca-symbol.png`: official standalone Alpaca symbol from Alpaca's Newsroom brand kit, used because catalog connection icons render in a square slot.

## Backend Adapter Contract

- Type id: `finance.alpaca-market-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/alpaca_market_data.py`
- Routes: generic `/test/`, `/query/`, and `/resources/assets/` connection routes only.
- Provider access: backend uses `requests` and sends `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`; no provider SDK or browser-side credential use.
- Output contract: all query models advertise `core.tabular_frame@v1`.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by the backend adapter for endpoint, market, timeout, cache, metadata-cache, and dedupe behavior. `apiKeyId` and `apiSecretKey` are write-only secure config fields. The frontend only reads `secureFields` to indicate whether credentials are already present.

## Query And Resource Ownership

Supported query kinds are:

- `alpaca-equity-ohlc`
- `alpaca-equity-latest-bars`
- `alpaca-equity-historical-trades`
- `alpaca-equity-latest-trades`
- `alpaca-equity-latest-quotes`
- `alpaca-crypto-ohlc`
- `alpaca-crypto-latest-bars`
- `alpaca-crypto-historical-trades`
- `alpaca-crypto-latest-trades`

The backend owns symbol normalization, asset-class authorization, provider pagination, response normalization, cache-key dimensions, in-flight dedupe, and rejection of unsafe or unsupported requests. The `assets` resource is available for provider asset metadata and future symbol selection UIs.

## Maintenance Constraints

- Keep query models aligned with the backend ADR and adapter implementation.
- Keep connection-specific authoring behavior inside `alpacaAuthoring.ts`. Do not reintroduce an Alpaca-only Explore wrapper that can drift from widget settings.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- If the public config, secure config, query payload, resource payload, health result, or response frame shape changes, assess the backend contract before treating the change as frontend-only.
