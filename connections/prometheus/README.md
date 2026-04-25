# Prometheus Connection

This directory owns the Prometheus custom connection implementation. It is not a Command Center app
extension and must not register sidebar surfaces, widgets, or shell menu entries.

## Entry Points

- `index.ts`: exports the `prometheus.remote` connection type definition consumed by the app
  registry's root-level connection loader.
- `PrometheusConnectionExplore.tsx`: Prometheus Explore wrapper rendered by
  `Connections > Explore`. It shows datasource/query-policy metadata and delegates query
  authoring, generated request preview, test execution, and response preview to the shared
  `ConnectionQueryWorkbench`.
- `PrometheusConnectionQueryEditor.tsx`: typed Connection Query widget editor for PromQL instant,
  PromQL range, label values, label names, and series metadata payloads.

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
  connection type defaults. It uses the same `ConnectionQueryWorkbench`, `queryModels`, and
  `queryEditor` path as the workspace Connection Query widget; do not reintroduce an Explore-only
  `queryConnection` mutation path for standard Prometheus queries.
- The shared workbench filters authorable source paths to query models that can normalize to
  runtime frames. Metadata-only option-list paths such as label names and label values remain
  connection query models for backend/editor use but should not become widget source outputs until
  a widget runtime contract consumes option lists.
- The Connection Query widget uses the Prometheus `queryEditor` to render PromQL, range step,
  max data points, label names, and matcher lists. These fields remain Prometheus-specific payload
  kwargs instead of becoming static fields on the generic widget.
- `promql-range` must publish a canonical `core.tabular_frame@v1` for widget/runtime flows. When
  the backend can identify chart semantics, preserve them in `meta.timeSeries` on that tabular
  frame while keeping Prometheus labels available as series metadata.
- `promql-instant` remains tabular for widget/runtime flows.

## Maintenance Constraints

- Keep Prometheus out of `extensions/`; it should appear to users only through the shared
  Connections app.
- Do not render or persist secret values. Bearer tokens are write-only secure config fields on
  backend-owned connection instances.
- If the config schema or query model changes, update the connection type sync payload expectations
  and backend adapter contract together.
