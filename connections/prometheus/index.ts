import type { ConnectionTypeDefinition } from "@/connections/types";
import prometheusLogoUrl from "@/connections/assets/prometheus-logo.svg";
import { CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/timeseries-frame-source";
import { CORE_TABULAR_FRAME_SOURCE_CONTRACT } from "@/widgets/shared/tabular-frame-source";

import { PrometheusConnectionExplore } from "./PrometheusConnectionExplore";

export const PROMETHEUS_CONNECTION_TYPE_ID = "prometheus.remote";

export type PrometheusHttpMethod = "GET" | "POST";
export type PrometheusAuthType = "none" | "basic" | "bearer" | "forward-oauth";
export type PrometheusBackendType = "prometheus" | "mimir" | "cortex" | "thanos";
export type PrometheusCacheLevel = "none" | "low" | "medium" | "high";
export type PrometheusEditorMode = "builder" | "code";

export interface PrometheusPublicConfig {
  baseUrl?: string;
  authType?: PrometheusAuthType;
  basicUser?: string;
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
    }
  | {
      kind: "label-values";
      label: string;
      matchers?: string[];
      startMs?: number;
      endMs?: number;
    }
  | {
      kind: "label-names";
      matchers?: string[];
      startMs?: number;
      endMs?: number;
    }
  | {
      kind: "series";
      matchers: string[];
      startMs?: number;
      endMs?: number;
    };

export const prometheusConnection: ConnectionTypeDefinition<
  PrometheusPublicConfig,
  PrometheusConnectionQuery
> = {
  id: PROMETHEUS_CONNECTION_TYPE_ID,
  version: 2,
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
        id: "baseUrl",
        sectionId: "connection",
        label: "Base URL",
        description: "Prometheus-compatible HTTP API root.",
        type: "string",
        required: true,
      },
      {
        id: "authType",
        sectionId: "authentication",
        label: "Authentication",
        type: "select",
        required: true,
        defaultValue: "none",
        options: [
          { label: "No authentication", value: "none" },
          { label: "Basic authentication", value: "basic" },
          { label: "Bearer token", value: "bearer" },
          { label: "Forward user identity", value: "forward-oauth" },
        ],
      },
      {
        id: "basicUser",
        sectionId: "authentication",
        label: "Basic auth username",
        type: "string",
        required: false,
      },
      {
        id: "tlsServerName",
        sectionId: "tls",
        label: "TLS server name",
        type: "string",
        required: false,
      },
      {
        id: "tlsSkipVerify",
        sectionId: "tls",
        label: "Skip TLS verification",
        description: "Only use for controlled internal endpoints where certificate validation is handled elsewhere.",
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "allowedCookies",
        sectionId: "http",
        label: "Allowed cookies",
        description: "Comma-separated cookie names that the backend proxy may forward.",
        type: "string",
        required: false,
      },
      {
        id: "timeoutSeconds",
        sectionId: "http",
        label: "HTTP timeout seconds",
        type: "number",
        required: false,
        defaultValue: 60,
      },
      {
        id: "manageAlerts",
        sectionId: "alerting",
        label: "Manage alerts",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      {
        id: "allowAsRecordingRulesTarget",
        sectionId: "alerting",
        label: "Allow as recording rules target",
        type: "boolean",
        required: false,
        defaultValue: true,
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
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "prometheusType",
        sectionId: "performance",
        label: "Prometheus type",
        type: "select",
        required: true,
        defaultValue: "prometheus",
        options: [
          { label: "Prometheus", value: "prometheus" },
          { label: "Mimir", value: "mimir" },
          { label: "Cortex", value: "cortex" },
          { label: "Thanos", value: "thanos" },
        ],
      },
      {
        id: "cacheLevel",
        sectionId: "performance",
        label: "Cache level",
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
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      {
        id: "customQueryParameters",
        sectionId: "other",
        label: "Custom query parameters",
        description: "Example: max_source_resolution=5m&timeout=10",
        type: "string",
        required: false,
      },
      {
        id: "httpMethod",
        sectionId: "other",
        label: "HTTP method",
        type: "select",
        required: true,
        defaultValue: "POST",
        options: [
          { label: "POST", value: "POST" },
          { label: "GET", value: "GET" },
        ],
      },
      {
        id: "seriesLimit",
        sectionId: "other",
        label: "Series limit",
        type: "number",
        required: false,
        defaultValue: 40000,
      },
      {
        id: "useSeriesEndpoint",
        sectionId: "other",
        label: "Use series endpoint",
        type: "boolean",
        required: false,
        defaultValue: false,
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
        type: "secret",
        required: false,
      },
      {
        id: "basicPassword",
        sectionId: "authentication",
        label: "Basic auth password",
        type: "secret",
        required: false,
      },
      {
        id: "caCertificate",
        sectionId: "tls",
        label: "CA certificate",
        type: "secret",
        required: false,
      },
      {
        id: "clientCertificate",
        sectionId: "tls",
        label: "Client certificate",
        type: "secret",
        required: false,
      },
      {
        id: "clientKey",
        sectionId: "tls",
        label: "Client key",
        type: "secret",
        required: false,
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
        CORE_TIME_SERIES_FRAME_SOURCE_CONTRACT,
        CORE_TABULAR_FRAME_SOURCE_CONTRACT,
      ],
      timeRangeAware: true,
      supportsVariables: true,
    },
    {
      id: "label-values",
      label: "Label values",
      outputContracts: ["core.option_list@v1"],
      supportsVariables: true,
    },
    {
      id: "label-names",
      label: "Label names",
      outputContracts: ["core.option_list@v1"],
      supportsVariables: true,
    },
    {
      id: "series",
      label: "Series metadata",
      outputContracts: [CORE_TABULAR_FRAME_SOURCE_CONTRACT],
      timeRangeAware: true,
      supportsVariables: true,
    },
  ],
  requiredPermissions: ["prometheus:query"],
  exploreComponent: PrometheusConnectionExplore,
  usageGuidance:
    "Use this connection type for backend-managed Prometheus data sources. Configure a data source instance, then use Connections > Explore to validate PromQL before wiring widgets to the shared connection runtime.",
  examples: [
    {
      title: "PromQL range query",
      publicConfig: {
        baseUrl: "https://prometheus.example.com",
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
  ],
};

export default prometheusConnection;
