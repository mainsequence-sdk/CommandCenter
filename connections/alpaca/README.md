# Alpaca Market Data Connection

This module registers the Command Center frontend definition for the backend-owned Alpaca Market Data adapter across both request/response and WebSocket stream authoring.

## Purpose

The connection exposes Alpaca equity and crypto market-data queries through the generic Command Center connection routes. It includes HTTP query models for historical/latest data and stream-only query models for live trades, quotes, and minute bars. It is not a trading or account-management integration; it only describes configuration, query models, icons, and Explore/query editor UI for `finance.alpaca-market-data`.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config types, query types, query models, examples, and agent-facing `usageGuidance`.
- `AlpacaConnectionConfigEditor.tsx`: renders stable public configuration fields, including REST endpoints, live-stream endpoint defaults, asset classes, feed/location defaults, timeout, cache, dedupe, and WebSocket controls.
- `AlpacaConnectionQueryEditor.tsx`: renders query payload controls for supported Alpaca equity and crypto query kinds in both HTTP and stream authoring flows.
- `alpacaAuthoring.ts`: defines the shared `authoringContract` used by both Data Sources Explore and widget-managed/standalone `connection-query` and `connection-stream-query` settings for query-model filtering, draft seeding, and Explore copy.
- `src/connections/assets/alpaca-symbol.png`: official standalone Alpaca symbol from Alpaca's Newsroom brand kit, used because catalog connection icons render in a square slot.

## Backend Adapter Contract

- Type id: `finance.alpaca-market-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/alpaca_market_data.py`
- Routes: generic `/test/`, `/query/`, `/resources/assets/`, and `/stream-query/` for the streamable live query models.
- Provider access: backend uses `requests` and sends `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`; no provider SDK or browser-side credential use.
- Output contract: all HTTP and live stream query models advertise `core.tabular_frame@v1`.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by the backend adapter for REST endpoints, WebSocket endpoints, enabled markets, stream defaults, timeout, cache, metadata-cache, and dedupe behavior. `apiKeyId` and `apiSecretKey` are write-only secure config fields. The frontend only reads `secureFields` to indicate whether credentials are already present.

## Query And Resource Ownership

Supported query kinds are:

- `alpaca-equity-ohlc`
- `alpaca-equity-latest-bars`
- `alpaca-equity-historical-trades`
- `alpaca-equity-latest-trades`
- `alpaca-equity-latest-quotes`
- `alpaca-equity-live-trades`
- `alpaca-equity-live-quotes`
- `alpaca-equity-live-bars`
- `alpaca-crypto-ohlc`
- `alpaca-crypto-latest-bars`
- `alpaca-crypto-historical-trades`
- `alpaca-crypto-latest-trades`
- `alpaca-crypto-live-trades`
- `alpaca-crypto-live-quotes`
- `alpaca-crypto-live-bars`

The backend owns symbol normalization, asset-class authorization, provider pagination, provider WebSocket session ownership, response normalization, cache-key dimensions, in-flight dedupe, and rejection of unsafe or unsupported requests. The `assets` resource is available for provider asset metadata and future symbol selection UIs.

HTTP authoring and stream authoring intentionally expose different path lists through the shared authoring contract. Stream-only Alpaca live query kinds are available only in WebSocket authoring mode and do not appear on the HTTP request surface.

## Maintenance Constraints

- Keep query models aligned with the backend ADR and adapter implementation.
- Keep connection-specific authoring behavior inside `alpacaAuthoring.ts`. Do not reintroduce an Alpaca-only Explore wrapper that can drift from widget settings or from the shared `connection-stream-query` path.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- Keep stream-only query kinds stream-only. Do not let them appear on the HTTP request surface or execute through `/query/`.
- If the public config, secure config, query payload, resource payload, health result, response frame shape, or stream lifecycle semantics change, assess the backend contract before treating the change as frontend-only.
