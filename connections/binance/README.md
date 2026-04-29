# Binance Market Data Connection

This module registers the Command Center frontend definition for the backend-owned Binance Market Data adapter.

## Purpose

The connection exposes Binance spot and USD-M futures market-data queries through generic Command Center connection routes. Selected query kinds also expose query-shaped WebSocket streaming through the shared `connection-stream-query` widget path. It is not an authenticated account, order-management, wallet, or user-data integration.

## Entry Points

- `index.ts`: exports the `ConnectionTypeDefinition`, config types, query types, query models, examples, and agent-facing `usageGuidance`.
- `BinanceConnectionConfigEditor.tsx`: renders stable public configuration fields for REST endpoints, WebSocket endpoints, enabled market types, defaults, timeout, cache, stream guards, and dedupe controls.
- `BinanceConnectionQueryEditor.tsx`: renders shared query payload controls for supported Binance spot and USD-M futures query kinds in both request and stream authoring flows, with transport-specific labels and subscription copy when reused by the WebSocket stream widget.
- `binanceAuthoring.ts`: defines the shared `authoringContract` used by both Data Sources Explore and widget-managed/standalone `connection-query` settings for draft seeding and Explore copy. Stream authoring resolves against streamable paths only and seeds a stream-first default path instead of the HTTP price query default.
- `src/connections/assets/binance-logo.svg`: square Binance logo used in connection catalogs and pickers.

## Backend Adapter Contract

- Type id: `finance.binance-market-data`
- Type version: `1`
- Backend implementation: `timeseries_orm/command_center/adapters/connections/binance_market_data.py`
- Routes: generic `/test/`, `/query/`, `/resources/symbols/`, and `/stream-query/` for the streamable query models.
- Provider access: backend uses `requests` for REST calls and a backend-owned WebSocket client for live public market-data streams. No Binance SDK or `ccxt`.
- Output contract: all query models advertise `core.tabular_frame@v1`.
- Secure config: none. Public market-data endpoints do not require stored secrets.
- Stream capability: the frontend manifest advertises `stream` only on the backend-approved query kinds listed below.
- Stream preview hints: streamed query models also carry frontend-only `preview.graph` metadata so
  the shared WebSocket preview can chart Binance rows with explicit `x/y/group` field mappings.
  This does not change backend query payloads or stream envelopes.
- Stream row identity: streamed Binance query models also publish frontend runtime
  `stream.defaultMergeKeyFields` so the generic `connection-stream-query` source can retain live
  history for downstream widgets even when the backend bridge emits one-row snapshot updates.

## Configuration Ownership

Public config fields are serialized with the connection instance and are used by the backend adapter for REST endpoints, WebSocket endpoints, market-type authorization, symbol metadata, timeout, cache, reconnect windows, provider stream limits, and dedupe behavior. This frontend module only renders and syncs the manifest; provider execution remains backend-owned.

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

Backend-approved streamable query kinds are:

- `binance-spot-ohlc`
- `binance-spot-recent-trades`
- `binance-spot-aggregate-trades`
- `binance-usdm-futures-ohlc`
- `binance-usdm-futures-aggregate-trades`

The backend owns symbol normalization, exchange-info validation, market-type authorization, provider timestamp handling, endpoint-specific limit caps, response normalization, WebSocket provider channel mapping, reconnect behavior, cache-key dimensions, in-flight dedupe, and rejection of unsupported requests. The query editor uses local symbol token entry; the `symbols` resource remains available for backend validation and optional metadata tooling but is not called before every query.

## Maintenance Constraints

- Keep query models and `queryModels[].stream` metadata aligned with backend ADR 016 and the adapter implementation.
- Keep streamed query-model `preview.graph` hints aligned with the backend-normalized Binance row
  keys (`openTime`, `time`, `close`, `price`, `tradeId`, `aggregateTradeId`, `symbol`,
  `marketType`, `interval`). These hints are frontend preview metadata only; if they are ever
  synced through the connection registry, treat that as a backend contract change.
- Keep `queryModels[].stream.defaultMergeKeyFields` aligned with the backend-normalized row
  identity fields for each streamed query kind. These keys drive canonical retained-row merging in
  the generic WebSocket source widget.
- Keep HTTP and stream authoring semantics separate even when they reuse the same typed query editor. Labels, default path selection, and field help must describe the active transport accurately.
- Keep connection-specific authoring behavior inside `binanceAuthoring.ts`. Do not reintroduce a Binance-only Explore wrapper that can drift from widget settings.
- Keep every config schema field description synchronized with the config editor help text and `usageGuidance`.
- If public config, query payload, resource payload, health result, or response frame shape changes, assess the backend contract before treating the change as frontend-only.
