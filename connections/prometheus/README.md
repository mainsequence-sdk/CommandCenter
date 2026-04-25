# Prometheus Connection

This directory owns the Prometheus custom connection implementation. It is not a Command Center app
extension and must not register sidebar surfaces, widgets, or shell menu entries.

## Entry Points

- `index.ts`: exports the `prometheus.remote` connection type definition consumed by the app
  registry's root-level connection loader.
- `PrometheusConnectionExplore.tsx`: custom Explore shell rendered by `Connections > Explore` when
  the selected data source uses the Prometheus connection type.

## Behavior

- The connection type exposes datasource configuration for endpoint, authentication mode, TLS,
  advanced HTTP behavior, alerting flags, interval behavior, editor defaults, performance controls,
  query transport, series limits, metadata endpoint selection, and Explore defaults.
- The connection type uses `src/connections/assets/prometheus-logo.svg`, downloaded from the
  official Prometheus docs repository asset
  `static/prometheus_logo_orange_circle.svg` under the Prometheus docs Apache 2.0 license.
- Connection instances remain backend-owned data sources. This implementation contributes type
  metadata and frontend Explore UX only.
- The Explore shell reads runtime behavior from the selected connection instance and its synced
  connection type defaults. It calls the shared `queryConnection` API with PromQL, label, or series
  query payloads. Backend adapters are responsible for executing requests, applying datasource
  settings, enforcing authorization, and returning normalized connection frames.
- `promql-range` advertises `core.time_series_frame@v1`; the backend should normalize Prometheus
  matrix responses into long-shape time-series frames with labels preserved as series metadata.
- `promql-instant` remains tabular by default unless a request explicitly asks for time-series
  output.

## Maintenance Constraints

- Keep Prometheus out of `extensions/`; it should appear to users only through the shared
  Connections app.
- Do not render or persist secret values. Bearer tokens are write-only secure config fields on
  backend-owned connection instances.
- If the config schema or query model changes, update the connection type sync payload expectations
  and backend adapter contract together.
