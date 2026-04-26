import type { ConnectionTypeDefinition } from "@/connections/types";
import prometheusLogoUrl from "@/connections/assets/prometheus-logo.svg";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { PrometheusConnectionExplore } from "./PrometheusConnectionExplore";
import { PrometheusConnectionQueryEditor } from "./PrometheusConnectionQueryEditor";

export const PROMETHEUS_CONNECTION_TYPE_ID = "prometheus.remote";

export type PrometheusHttpMethod = "GET" | "POST";
export type PrometheusEndpointMode = "prometheus-compatible" | "google-managed-prometheus";
export type PrometheusAuthType =
  | "none"
  | "basic"
  | "bearer"
  | "forward-oauth"
  | "google-service-account";
export type PrometheusBackendType = "prometheus" | "mimir" | "cortex" | "thanos";
export type PrometheusCacheLevel = "none" | "low" | "medium" | "high";
export type PrometheusEditorMode = "builder" | "code";

export interface PrometheusPublicConfig {
  endpointMode?: PrometheusEndpointMode;
  baseUrl?: string;
  authType?: PrometheusAuthType;
  basicUser?: string;
  projectId?: string;
  location?: string;
  tlsServerName?: string;
  tlsSkipVerify?: boolean;
  allowedCookies?: string;
  timeoutSeconds?: number;
  manageAlerts?: boolean;
  allowAsRecordingRulesTarget?: boolean;
  scrapeInterval?: string;
  queryTimeout?: string;
  defaultEditor?: PrometheusEditorMode;
  disableMetricsLookup?: boolean;
  prometheusType?: PrometheusBackendType;
  cacheLevel?: PrometheusCacheLevel;
  incrementalQuerying?: boolean;
  incrementalQueryOverlapWindow?: string;
  disableRecordingRules?: boolean;
  customQueryParameters?: string;
  httpMethod?: PrometheusHttpMethod;
  seriesLimit?: number;
  useSeriesEndpoint?: boolean;
  defaultExploreLookback?: string;
  maxDataPoints?: number;
}

export type PrometheusConnectionQuery =
  | {
      kind: "promql-instant";
      query: string;
      timeMs?: number;
    }
  | {
      kind: "promql-range";
      query: string;
      startMs?: number;
      endMs?: number;
      stepMs?: number;
      maxDataPoints?: number;
    };

const prometheusUsageGuidance = `
## purpose

Connects Command Center widgets and Explore flows to a backend-owned Prometheus-compatible datasource, including Google Cloud Managed Service for Prometheus when configured with service-account OAuth.

## whenToUse

- Use for PromQL instant and range queries routed through the backend connection adapter.
- Use backend Prometheus resources for label metadata, metric names, target status, and metric metadata.
- Use Google Managed Service for Prometheus mode when querying Cloud Monitoring's Prometheus API with a Google service account JSON key stored as a write-only backend secret.
- Use direct Prometheus-compatible endpoint mode for Prometheus, Mimir, Cortex, Thanos, or compatible APIs that expose a standard Prometheus HTTP API root.

## whenNotToUse

- Do not paste endpoint URLs, bearer tokens, service-account JSON, or TLS material into widget props.
- Do not use a manually generated Google OAuth access token as a long-lived bearer token; the backend must exchange the service-account JSON for short-lived access tokens.
- Do not use this connection for non-Prometheus Cloud Monitoring APIs.

## configurationFields

The frontend must hide fields that do not apply to the current endpoint/auth selection. Google Managed Service for Prometheus project/location fields are visible only when endpointMode is google-managed-prometheus. Direct endpoint/TLS/proxy fields are visible only when endpointMode is prometheus-compatible. Bearer, basic, and service-account secrets are visible only for their matching authType.

### publicConfig

| Key | Label | Type | Required | Default | Example | Used by | UI help |
| --- | --- | --- | --- | --- | --- | --- | --- |
| endpointMode | Endpoint mode | select | yes | prometheus-compatible | google-managed-prometheus | frontend and backend adapter | Select Prometheus-compatible endpoint for a direct API root, or Google Managed Service for Prometheus so the backend builds the Cloud Monitoring Prometheus API URL from the Google Cloud project and location. |
| baseUrl | Base URL | string | conditional | none | https://prometheus.example.com/api/v1 | backend adapter | Prometheus-compatible HTTP API root. Required for Prometheus-compatible endpoint mode. For Google Managed Service for Prometheus, the backend may derive the URL from project and location unless it supports an explicit override. |
| authType | Authentication | select | yes | none | google-service-account | frontend and backend adapter | Authentication strategy the backend adapter uses before proxying Prometheus API requests. Select Google service account JSON for Managed Service for Prometheus OAuth token exchange. |
| basicUser | Basic auth username | string | no | none | prometheus_reader | backend adapter | Username sent with the secure basic auth password when Authentication is Basic authentication. |
| projectId | Google Cloud project ID | string | conditional | none | my-metrics-scope-project | backend adapter | Scoping Google Cloud project id or number used by the backend to query Managed Service for Prometheus through Cloud Monitoring. |
| location | Google Cloud location | string | no | global | global | backend adapter | Managed Service for Prometheus API location. Google currently requires global for Prometheus query APIs. |
| tlsServerName | TLS server name | string | no | none | prometheus.internal.example.com | backend adapter | Optional TLS server name override used by the backend when verifying the upstream Prometheus certificate. |
| tlsSkipVerify | Skip TLS verification | boolean | no | false | false | backend adapter | Only use for controlled internal endpoints where certificate validation is handled elsewhere. |
| allowedCookies | Allowed cookies | string | no | none | grafana_session | backend adapter | Comma-separated cookie names that the backend proxy may forward. |
| timeoutSeconds | HTTP timeout seconds | number | no | 60 | 30 | backend adapter | Backend HTTP timeout, in seconds, for Prometheus API requests before the adapter fails the query. |
| manageAlerts | Manage alerts | boolean | no | true | true | frontend and backend adapter | Datasource flag indicating whether alert-management workflows may use this Prometheus connection. |
| allowAsRecordingRulesTarget | Allow as recording rules target | boolean | no | true | true | frontend and backend adapter | Datasource flag indicating whether recording-rule workflows may target this Prometheus connection. |
| scrapeInterval | Scrape interval | string | yes | 15s | 30s | frontend and backend adapter | Duration string such as 15s, 1m, or 5m. |
| queryTimeout | Query timeout | string | yes | 60s | 30s | backend adapter | Duration string passed to the backend query adapter. |
| defaultEditor | Default editor | select | yes | builder | code | frontend | Initial Explore/query editor mode for PromQL authoring when the UI offers builder and code views. |
| disableMetricsLookup | Disable metrics lookup | boolean | no | false | false | frontend and backend adapter | Disables metadata lookups used to populate metric suggestions in Prometheus Explore and query editors. |
| prometheusType | Prometheus type | select | yes | prometheus | thanos | frontend and backend adapter | Prometheus-compatible backend family used by the adapter for capability hints and request behavior. |
| cacheLevel | Cache level | select | yes | low | medium | backend adapter | Backend cache profile for Prometheus query and metadata requests. |
| incrementalQuerying | Incremental querying | boolean | no | false | true | frontend and backend adapter | Datasource-level flag indicating whether compatible clients may prefer incremental range-query behavior. |
| incrementalQueryOverlapWindow | Incremental query overlap window | string | no | 10m | 120s | backend adapter | Duration string such as 10m, 120s, or 0s. |
| disableRecordingRules | Disable recording rules | boolean | no | false | false | frontend and backend adapter | Disables recording-rule discovery or workflows for this datasource. |
| customQueryParameters | Custom query parameters | string | no | none | max_source_resolution=5m&timeout=10 | backend adapter | Example: max_source_resolution=5m&timeout=10. |
| httpMethod | HTTP method | select | yes | POST | GET | backend adapter | HTTP method the backend should use for Prometheus-compatible query requests when the endpoint supports a choice. |
| seriesLimit | Series limit | number | no | 40000 | 10000 | backend adapter | Maximum series count used by backend metadata and series discovery requests. |
| useSeriesEndpoint | Use series endpoint | boolean | no | false | true | backend adapter | Allows metadata discovery through the Prometheus series endpoint when the backend adapter supports it. |
| defaultExploreLookback | Default lookback | string | yes | 1h | 6h | frontend | Duration string used to initialize Explore when no dashboard time range is present. |
| maxDataPoints | Max data points | number | yes | 1100 | 2000 | frontend | Default maximum number of points used by Explore range queries and generated query payloads. |

### secureConfig

| Key | Label | Type | Required | Default | Example | Used by | UI help |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bearerToken | Bearer token | secret | conditional | none | <redacted> | backend adapter | Write-only bearer token used when Authentication is Bearer token. The frontend sends it only when saving and only reads secureFields afterward. |
| basicPassword | Basic auth password | secret | conditional | none | <redacted> | backend adapter | Write-only password paired with Basic auth username when Authentication is Basic authentication. |
| serviceAccountJson | Service account JSON | secret | conditional | none | {"type":"service_account","project_id":"..."} | backend adapter | Write-only Google service account key JSON used by the backend to sign an OAuth JWT, exchange it at oauth2.googleapis.com, cache the short-lived access token in memory, and send that token to Managed Service for Prometheus. |
| caCertificate | CA certificate | secret | no | none | -----BEGIN CERTIFICATE----- | backend adapter | Write-only PEM CA certificate material used by the backend for upstream TLS verification. |
| clientCertificate | Client certificate | secret | no | none | -----BEGIN CERTIFICATE----- | backend adapter | Write-only PEM client certificate used by the backend for mutual TLS when required by the Prometheus endpoint. |
| clientKey | Client key | secret | no | none | -----BEGIN PRIVATE KEY----- | backend adapter | Write-only PEM private key paired with the client certificate for mutual TLS. |

## googleManagedPrometheusAuth

- Set endpointMode to google-managed-prometheus.
- Set authType to google-service-account.
- Set projectId to the scoping project or metrics-scope project.
- Leave location as global unless Google adds another supported location.
- Paste the full service account key JSON into secureConfig.serviceAccountJson.
- The frontend never sends the JSON key to Prometheus. It sends the key only to the backend connection instance secret write path.
- The backend adapter must use the private key to sign the OAuth JWT, call oauth2.googleapis.com, keep the returned access token in memory, refresh before expiry, and inject Authorization: Bearer <access_token> into Managed Service for Prometheus API requests.
- The service account needs Cloud Monitoring read permission, such as roles/monitoring.viewer or equivalent monitoring time-series read permissions.

## exploreBuilder

- Prometheus Explore includes a Builder/Code authoring toggle.
- Builder mode generates PromQL from a selected metric, label filters, optional rate/increase functions, and optional aggregations.
- Metadata requests are user-triggered only. The frontend must not load metric names, label names, or label values when the Explore screen mounts.
- Load metrics calls the connection resource endpoint with resource "label-values", label "__name__", and Prometheus params including match[], start, end, and limit when available.
- Load labels calls the connection resource endpoint with resource "labels" scoped to the selected metric.
- Load values calls the connection resource endpoint with resource "label-values" scoped to the selected metric and completed filters from the other rows.
- The generated PromQL is written back into the normal promql-range query payload and executed through the shared Connection Query workbench.
- Google Managed Prometheus metric names that are not legal bare PromQL identifiers must be emitted as __name__ matchers, for example {__name__="actions.googleapis.com/smarthome_action/request_count"}.

## queryModels

### promql-instant

- Payload: { "kind": "promql-instant", "query": "up" }
- Returns: prometheus.vector@v1, core.tabular_frame@v1, or core.statistic_frame@v1.

### promql-range

- Payload: { "kind": "promql-range", "query": "rate(http_requests_total[5m])", "maxDataPoints": 1100 }
- Returns: prometheus.matrix@v1 or core.tabular_frame@v1.
- Time-range-aware: yes.

## resources

Prometheus metadata discovery is resource-routed, not query-routed:

- labels: payload { "params": { "match[]": ["{job=\\"api\\"}"], "start": 1760000000, "end": 1760003600, "limit": 40000 } }.
- label-values: payload { "label": "__name__", "params": { "match[]": [], "start": 1760000000, "end": 1760003600, "limit": 40000 } }.
- targets: payload { "params": {} }.
- metadata: payload { "params": { "metric": "up" } }.

## backendOwnership

- type_id: prometheus.remote
- Backend owns connection instance persistence, secure config storage, service-account OAuth exchange, short-lived token caching, token refresh, Authorization header injection, upstream Prometheus request construction, cache policy, in-flight dedupe, health checks, permission checks, provider errors, and response normalization.
- For Google Managed Service for Prometheus, backend should build the API prefix as https://monitoring.googleapis.com/v1/projects/<projectId>/location/<location>/prometheus/api/v1/ unless it intentionally honors a baseUrl override.
- Provider request failures must not cache.
`.trim();

export const prometheusConnection: ConnectionTypeDefinition<
  PrometheusPublicConfig,
  PrometheusConnectionQuery
> = {
  id: PROMETHEUS_CONNECTION_TYPE_ID,
  version: 3,
  title: "Prometheus",
  description:
    "Connects Command Center data sources to backend-managed Prometheus query and metadata APIs.",
  source: "prometheus",
  category: "Observability",
  iconUrl: prometheusLogoUrl,
  tags: ["metrics", "promql", "observability"],
  capabilities: ["query", "resource", "health-check"],
  accessMode: "proxy",
  publicConfigSchema: {
    version: 1,
    sections: [
      {
        id: "connection",
        title: "Connection",
        description: "Backend-routed Prometheus endpoint.",
      },
      {
        id: "authentication",
        title: "Authentication",
        description: "Authentication mode selected for the backend adapter.",
      },
      {
        id: "google-managed-prometheus",
        title: "Google Managed Prometheus",
        description:
          "Google Cloud fields used when endpoint mode is Google Managed Service for Prometheus.",
      },
      {
        id: "tls",
        title: "TLS",
        description: "TLS verification options for the backend adapter.",
      },
      {
        id: "http",
        title: "Advanced HTTP settings",
        description: "Proxy forwarding and request timeout behavior.",
      },
      {
        id: "alerting",
        title: "Alerting",
        description: "Datasource flags used by alerting and recording-rule workflows.",
      },
      {
        id: "interval",
        title: "Interval behavior",
        description: "Prometheus scrape/evaluation cadence and query timeout.",
      },
      {
        id: "query-editor",
        title: "Query editor",
        description: "Editor and metadata lookup defaults.",
      },
      {
        id: "performance",
        title: "Performance",
        description: "Backend type, caching, incremental querying, and rules lookup behavior.",
      },
      {
        id: "other",
        title: "Other",
        description: "Query transport, metadata endpoint, and series limits.",
      },
      {
        id: "explore",
        title: "Explore defaults",
        description: "Initial values used by the Prometheus Explore shell.",
      },
    ],
    fields: [
      {
        id: "endpointMode",
        sectionId: "connection",
        label: "Endpoint mode",
        description:
          "Select Prometheus-compatible endpoint for a direct API root, or Google Managed Service for Prometheus so the backend builds the Cloud Monitoring Prometheus API URL from the Google Cloud project and location.",
        type: "select",
        required: true,
        defaultValue: "prometheus-compatible",
        options: [
          { label: "Prometheus-compatible endpoint", value: "prometheus-compatible" },
          { label: "Google Managed Service for Prometheus", value: "google-managed-prometheus" },
        ],
      },
      {
        id: "baseUrl",
        sectionId: "connection",
        label: "Base URL",
        description:
          "Prometheus-compatible HTTP API root. Required for Prometheus-compatible endpoint mode. For Google Managed Service for Prometheus, the backend may derive the URL from project and location unless it supports an explicit override.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "authType",
        sectionId: "authentication",
        label: "Authentication",
        description:
          "Authentication strategy the backend adapter uses before proxying Prometheus API requests. Select Google service account JSON for Managed Service for Prometheus OAuth token exchange.",
        type: "select",
        required: true,
        defaultValue: "none",
        options: [
          { label: "No authentication", value: "none" },
          { label: "Basic authentication", value: "basic" },
          { label: "Bearer token", value: "bearer" },
          { label: "Forward user identity", value: "forward-oauth" },
          { label: "Google service account JSON", value: "google-service-account" },
        ],
      },
      {
        id: "basicUser",
        sectionId: "authentication",
        label: "Basic auth username",
        description:
          "Username sent with the secure basic auth password when Authentication is Basic authentication.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "authType", equals: "basic" },
      },
      {
        id: "projectId",
        sectionId: "google-managed-prometheus",
        label: "Google Cloud project ID",
        description:
          "Scoping Google Cloud project id or number used by the backend to query Managed Service for Prometheus through Cloud Monitoring.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "google-managed-prometheus" },
      },
      {
        id: "location",
        sectionId: "google-managed-prometheus",
        label: "Google Cloud location",
        description:
          "Managed Service for Prometheus API location. Google currently requires global for Prometheus query APIs.",
        type: "string",
        required: false,
        defaultValue: "global",
        visibleWhen: { fieldId: "endpointMode", equals: "google-managed-prometheus" },
      },
      {
        id: "tlsServerName",
        sectionId: "tls",
        label: "TLS server name",
        description:
          "Optional TLS server name override used by the backend when verifying the upstream Prometheus certificate.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "tlsSkipVerify",
        sectionId: "tls",
        label: "Skip TLS verification",
        description: "Only use for controlled internal endpoints where certificate validation is handled elsewhere.",
        type: "boolean",
        required: false,
        defaultValue: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "allowedCookies",
        sectionId: "http",
        label: "Allowed cookies",
        description: "Comma-separated cookie names that the backend proxy may forward.",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "timeoutSeconds",
        sectionId: "http",
        label: "HTTP timeout seconds",
        description:
          "Backend HTTP timeout, in seconds, for Prometheus API requests before the adapter fails the query.",
        type: "number",
        required: false,
        defaultValue: 60,
      },
      {
        id: "manageAlerts",
        sectionId: "alerting",
        label: "Manage alerts",
        description:
          "Datasource flag indicating whether alert-management workflows may use this Prometheus connection.",
        type: "boolean",
        required: false,
        defaultValue: true,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "allowAsRecordingRulesTarget",
        sectionId: "alerting",
        label: "Allow as recording rules target",
        description:
          "Datasource flag indicating whether recording-rule workflows may target this Prometheus connection.",
        type: "boolean",
        required: false,
        defaultValue: true,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "scrapeInterval",
        sectionId: "interval",
        label: "Scrape interval",
        description: "Duration string such as 15s, 1m, or 5m.",
        type: "string",
        required: true,
        defaultValue: "15s",
      },
      {
        id: "queryTimeout",
        sectionId: "interval",
        label: "Query timeout",
        description: "Duration string passed to the backend query adapter.",
        type: "string",
        required: true,
        defaultValue: "60s",
      },
      {
        id: "defaultEditor",
        sectionId: "query-editor",
        label: "Default editor",
        description:
          "Initial Explore/query editor mode for PromQL authoring when the UI offers builder and code views.",
        type: "select",
        required: true,
        defaultValue: "builder",
        options: [
          { label: "Builder", value: "builder" },
          { label: "Code", value: "code" },
        ],
      },
      {
        id: "disableMetricsLookup",
        sectionId: "query-editor",
        label: "Disable metrics lookup",
        description:
          "Disables metadata lookups used to populate metric suggestions in Prometheus Explore and query editors.",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "prometheusType",
        sectionId: "performance",
        label: "Prometheus type",
        description:
          "Prometheus-compatible backend family used by the adapter for capability hints and request behavior.",
        type: "select",
        required: true,
        defaultValue: "prometheus",
        options: [
          { label: "Prometheus", value: "prometheus" },
          { label: "Mimir", value: "mimir" },
          { label: "Cortex", value: "cortex" },
          { label: "Thanos", value: "thanos" },
        ],
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "cacheLevel",
        sectionId: "performance",
        label: "Cache level",
        description:
          "Backend cache profile for Prometheus query and metadata requests.",
        type: "select",
        required: true,
        defaultValue: "low",
        options: [
          { label: "None", value: "none" },
          { label: "Low", value: "low" },
          { label: "Medium", value: "medium" },
          { label: "High", value: "high" },
        ],
      },
      {
        id: "incrementalQuerying",
        sectionId: "performance",
        label: "Incremental querying",
        description:
          "Datasource-level flag indicating whether compatible clients may prefer incremental range-query behavior.",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "incrementalQueryOverlapWindow",
        sectionId: "performance",
        label: "Incremental query overlap window",
        description: "Duration string such as 10m, 120s, or 0s.",
        type: "string",
        required: false,
        defaultValue: "10m",
      },
      {
        id: "disableRecordingRules",
        sectionId: "performance",
        label: "Disable recording rules",
        description:
          "Disables recording-rule discovery or workflows for this datasource.",
        type: "boolean",
        required: false,
        defaultValue: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "customQueryParameters",
        sectionId: "other",
        label: "Custom query parameters",
        description: "Example: max_source_resolution=5m&timeout=10",
        type: "string",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "httpMethod",
        sectionId: "other",
        label: "HTTP method",
        description:
          "HTTP method the backend should use for Prometheus-compatible query requests when the endpoint supports a choice.",
        type: "select",
        required: true,
        defaultValue: "POST",
        options: [
          { label: "POST", value: "POST" },
          { label: "GET", value: "GET" },
        ],
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "seriesLimit",
        sectionId: "other",
        label: "Series limit",
        description:
          "Maximum series count used by backend metadata and series discovery requests.",
        type: "number",
        required: false,
        defaultValue: 40000,
      },
      {
        id: "useSeriesEndpoint",
        sectionId: "other",
        label: "Use series endpoint",
        description:
          "Allows metadata discovery through the Prometheus series endpoint when the backend adapter supports it.",
        type: "boolean",
        required: false,
        defaultValue: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "defaultExploreLookback",
        sectionId: "explore",
        label: "Default lookback",
        description: "Duration string used to initialize Explore when no dashboard time range is present.",
        type: "string",
        required: true,
        defaultValue: "1h",
      },
      {
        id: "maxDataPoints",
        sectionId: "explore",
        label: "Max data points",
        description:
          "Default maximum number of points used by Explore range queries and generated query payloads.",
        type: "number",
        required: true,
        defaultValue: 1100,
      },
    ],
  },
  secureConfigSchema: {
    version: 1,
    sections: [
      {
        id: "authentication",
        title: "Authentication secrets",
      },
      {
        id: "tls",
        title: "TLS material",
      },
    ],
    fields: [
      {
        id: "bearerToken",
        sectionId: "authentication",
        label: "Bearer token",
        description:
          "Write-only bearer token used when Authentication is Bearer token. The frontend sends it only when saving and only reads secureFields afterward.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "authType", equals: "bearer" },
      },
      {
        id: "basicPassword",
        sectionId: "authentication",
        label: "Basic auth password",
        description:
          "Write-only password paired with Basic auth username when Authentication is Basic authentication.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "authType", equals: "basic" },
      },
      {
        id: "serviceAccountJson",
        sectionId: "authentication",
        label: "Service account JSON",
        description:
          "Write-only Google service account key JSON used by the backend to sign an OAuth JWT, exchange it at oauth2.googleapis.com, cache the short-lived access token in memory, and send that token to Managed Service for Prometheus.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "authType", equals: "google-service-account" },
      },
      {
        id: "caCertificate",
        sectionId: "tls",
        label: "CA certificate",
        description:
          "Write-only PEM CA certificate material used by the backend for upstream TLS verification.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "clientCertificate",
        sectionId: "tls",
        label: "Client certificate",
        description:
          "Write-only PEM client certificate used by the backend for mutual TLS when required by the Prometheus endpoint.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
      {
        id: "clientKey",
        sectionId: "tls",
        label: "Client key",
        description:
          "Write-only PEM private key paired with the client certificate for mutual TLS.",
        type: "secret",
        required: false,
        visibleWhen: { fieldId: "endpointMode", equals: "prometheus-compatible" },
      },
    ],
  },
  queryModels: [
    {
      id: "promql-instant",
      label: "PromQL instant query",
      outputContracts: [
        "prometheus.vector@v1",
        CORE_TABULAR_FRAME_SOURCE_CONTRACT,
        "core.statistic_frame@v1",
      ],
      supportsVariables: true,
    },
    {
      id: "promql-range",
      label: "PromQL range query",
      outputContracts: [
        "prometheus.matrix@v1",
        CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      ],
      timeRangeAware: true,
      supportsVariables: true,
    },
  ],
  requiredPermissions: ["prometheus:query"],
  exploreComponent: PrometheusConnectionExplore,
  queryEditor: PrometheusConnectionQueryEditor,
  usageGuidance: prometheusUsageGuidance,
  examples: [
    {
      title: "PromQL range query",
      publicConfig: {
        endpointMode: "prometheus-compatible",
        baseUrl: "https://prometheus.example.com",
        authType: "bearer",
        scrapeInterval: "15s",
        queryTimeout: "60s",
        httpMethod: "POST",
        seriesLimit: 40000,
      },
      query: {
        kind: "promql-range",
        query: 'sum by (job) (rate(http_requests_total[$__rate_interval]))',
      },
    },
    {
      title: "Google Managed Service for Prometheus range query",
      publicConfig: {
        endpointMode: "google-managed-prometheus",
        authType: "google-service-account",
        projectId: "my-metrics-scope-project",
        location: "global",
        scrapeInterval: "30s",
        queryTimeout: "60s",
        seriesLimit: 40000,
      },
      query: {
        kind: "promql-range",
        query: 'sum by (cluster) (rate(kubernetes_io:container_cpu_core_usage_time[5m]))',
      },
    },
  ],
};

export default prometheusConnection;
