# Prometheus Connection

This directory owns the Prometheus custom connection implementation. It is not a Command Center app
extension and must not register sidebar surfaces, widgets, or shell menu entries.

## Entry Points

- `index.ts`: exports the `prometheus.remote` connection type definition consumed by the app
  registry's root-level connection loader.
- `PrometheusQueryBuilder.tsx`: click-driven metric, label, and label-value selector builder.
  Metadata lookups are never issued on load; users must click `Load metrics`, `Load labels`, or
  `Values` for a specific label row.
- `promqlBuilder.ts`: pure PromQL selector/query helpers used by the builder and unit tests.
- `prometheusAuthoring.tsx`: defines the shared `authoringContract`, Prometheus datasource summary,
  query-default resolver, and default fixed-range helpers used by both Data Sources Explore and
  widget connection authoring.
- `PrometheusConnectionQueryEditor.tsx`: typed Connection Query widget editor for PromQL instant
  and PromQL range payloads. It is the shared source of truth for both Explore and widget-managed
  connection authoring, including the Builder/Code toggle, persisted editor-mode restore, and
  metadata-driven PromQL exploration.

## Behavior

- The connection type exposes datasource configuration for endpoint mode, authentication mode,
  Google Managed Service for Prometheus project/location, TLS, advanced HTTP behavior, alerting
  flags, interval behavior, editor defaults, performance controls, query transport, series limits,
  metadata endpoint selection, and Explore defaults.
- The connection type uses `src/connections/assets/prometheus-logo.svg`, downloaded from the
  official Prometheus docs repository asset
  `static/prometheus_logo_orange_circle.svg` under the Prometheus docs Apache 2.0 license.
- Connection instances remain backend-owned data sources. This implementation contributes type
  metadata and frontend Explore UX only.
- The generic Explore surface reads runtime behavior from the selected connection instance and its
  synced connection type defaults. It uses the same `ConnectionQueryWorkbench`, `queryModels`,
  `prometheusAuthoring.tsx`, and `PrometheusConnectionQueryEditor.tsx` path as the workspace
  Connection Query widget and managed widget-owned connection settings for query execution,
  parameter editing, builder mode, response preview, shared datasource summary, and default query/range
  seeding. Do not reintroduce a second Prometheus authoring path for standard queries.
- The PromQL builder performs metadata discovery through the backend-routed connection resource
  endpoint only after explicit user actions. `Load metrics` calls resource `label-values` for
  `__name__`, `Load labels` calls resource `labels` scoped to the selected metric, and each row's
  `Values` button calls resource `label-values` scoped to the selected metric and other completed
  filters. These requests must not go through the normal `/query/` execution path.
- The shared workbench exposes only PromQL query models that normalize to runtime frames.
  Metadata-only option-list paths such as label names and label values are connection resources,
  not widget source outputs.
- The builder generates standard bare metric selectors when possible and falls back to
  `{__name__="..."}` selectors for Google Managed Prometheus metric names containing `/` or other
  characters that cannot be used as bare PromQL metric identifiers.
- The Connection Query widget uses the Prometheus `queryEditor` to render PromQL, range step, and
  max data points. PromQL authoring must stay on the CodeMirror-backed PromQL editor instead of a
  generic textarea. These fields remain Prometheus-specific payload kwargs instead of becoming
  static fields on the generic widget.
- Builder vs Code selection is persisted in the surrounding `ConnectionQueryWidgetProps` authoring
  state, not guessed from the backend query payload. If no persisted mode exists yet and a saved
  query already has custom PromQL text, the editor should reopen in Code mode instead of silently
  dropping the user back into Builder.
- `promql-range` must publish a canonical `core.tabular_frame@v1` for widget/runtime flows. When
  the backend can identify chart semantics, preserve them in the normalized tabular frame while
  keeping Prometheus labels available as series metadata.
- `promql-instant` remains tabular for widget/runtime flows.

## Maintenance Constraints

- Keep Prometheus out of `extensions/`; it should appear to users only through the shared
  Connections app.
- Keep datasource summaries, default query seeding, and Explore copy in
  `prometheusAuthoring.tsx`. The typed PromQL editor remains the only connection-specific query
  authoring path.
- Do not render or persist returned secret values. Bearer tokens, basic passwords, Google service
  account JSON keys, and TLS material are write-only secure config fields on backend-owned
  connection instances. The UI may show only `secureFields` indicators for already configured
  secrets.
- The configuration schema uses field visibility rules. Google Managed Service for Prometheus
  project/location fields are shown only when `endpointMode = "google-managed-prometheus"`;
  auth secrets are shown only for the selected `authType`; direct endpoint/TLS/proxy fields are
  shown only for `endpointMode = "prometheus-compatible"`.
- For Google Managed Service for Prometheus, the frontend contract is:
  `publicConfig.endpointMode = "google-managed-prometheus"`,
  `publicConfig.authType = "google-service-account"`, `publicConfig.projectId`,
  `publicConfig.location` defaulting to `global`, and write-only
  `secureConfig.serviceAccountJson`.
- The backend adapter owns the service-account OAuth exchange. It must use the JSON key only to
  sign and exchange a JWT with Google's OAuth server, cache the short-lived access token in memory,
  refresh it before expiry, and inject `Authorization: Bearer <access_token>` into Managed Service
  for Prometheus requests. The frontend never sends the service-account JSON to the Prometheus API.
- Google Managed Service for Prometheus should resolve the Prometheus API prefix as
  `https://monitoring.googleapis.com/v1/projects/<project>/location/<location>/prometheus/api/v1/`
  unless the backend intentionally supports an explicit override.
- If the config schema or query model changes, update the connection type sync payload expectations
  and backend adapter contract together.
