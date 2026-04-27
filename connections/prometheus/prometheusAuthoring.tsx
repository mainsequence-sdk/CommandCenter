import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import type {
  ConnectionAuthoringContract,
  ConnectionAuthoringSummaryProps,
  ConnectionConfigSchema,
  ConnectionInstance,
  ConnectionQueryDraftDefaults,
  ConnectionQueryDraftDefaultsResolverInput,
  ConnectionTypeDefinition,
} from "@/connections/types";

import type { PrometheusConnectionQuery, PrometheusPublicConfig } from "./index";

export interface ResolvedPrometheusConfig {
  endpointMode: string;
  authType: string;
  projectId: string;
  location: string;
  scrapeInterval: string;
  queryTimeout: string;
  defaultExploreLookback: string;
  defaultEditor: string;
  httpMethod: string;
  seriesLimit: number;
  useSeriesEndpoint: boolean;
  maxDataPoints: number;
  prometheusType: string;
  cacheLevel: string;
  disableMetricsLookup: boolean;
  customQueryParameters: string;
}

export const DEFAULT_PROMQL_RANGE_STEP_MS = 5 * 60 * 1000;

function isBlank(value: unknown) {
  return typeof value === "string" ? value.trim() === "" : value === undefined || value === null;
}

function getSchemaDefault(schema: ConnectionConfigSchema | undefined, fieldId: string) {
  return schema?.fields.find((field) => field.id === fieldId)?.defaultValue;
}

function readConfigValue(
  input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
  },
  fieldId: keyof PrometheusPublicConfig,
) {
  const instanceValue = input.connectionInstance.publicConfig[fieldId];

  if (!isBlank(instanceValue)) {
    return instanceValue;
  }

  return getSchemaDefault(input.connectionType.publicConfigSchema, fieldId);
}

function readConfigString(
  input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
  },
  fieldId: keyof PrometheusPublicConfig,
) {
  const value = readConfigValue(input, fieldId);
  return typeof value === "string" ? value.trim() : value === undefined ? "" : String(value);
}

function readConfigNumber(
  input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
  },
  fieldId: keyof PrometheusPublicConfig,
  fallback: number,
) {
  const value = readConfigValue(input, fieldId);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readConfigBoolean(
  input: {
    connectionInstance: ConnectionInstance;
    connectionType: ConnectionTypeDefinition<any, any>;
  },
  fieldId: keyof PrometheusPublicConfig,
) {
  const value = readConfigValue(input, fieldId);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return false;
}

export function parsePrometheusDurationMs(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return Math.max(1, Math.round(amount * multipliers[unit]!));
}

export function buildPrometheusDefaultFixedRange(lookbackValue: string) {
  const fixedEndMs = Date.now();
  const lookbackMs = parsePrometheusDurationMs(lookbackValue) ?? 60 * 60 * 1000;
  const fixedStartMs = fixedEndMs - lookbackMs;

  return { fixedStartMs, fixedEndMs };
}

export function readPrometheusPublicConfig(value: unknown): PrometheusPublicConfig {
  return value && typeof value === "object" ? (value as PrometheusPublicConfig) : {};
}

export function readPrometheusPublicConfigString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readPrometheusPublicConfigNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getInitialPromql(connectionType: ConnectionTypeDefinition<any, any>) {
  const exampleQuery = connectionType.examples?.find((example) => {
    const query = example.query as { query?: unknown } | undefined;
    return typeof query?.query === "string";
  })?.query as { query?: string } | undefined;

  return exampleQuery?.query ?? "";
}

export function resolvePrometheusConfig(input: {
  connectionInstance: ConnectionInstance;
  connectionType: ConnectionTypeDefinition<any, any>;
}): ResolvedPrometheusConfig {
  return {
    endpointMode: readConfigString(input, "endpointMode"),
    authType: readConfigString(input, "authType"),
    projectId: readConfigString(input, "projectId"),
    location: readConfigString(input, "location"),
    scrapeInterval: readConfigString(input, "scrapeInterval"),
    queryTimeout: readConfigString(input, "queryTimeout"),
    defaultExploreLookback: readConfigString(input, "defaultExploreLookback"),
    defaultEditor: readConfigString(input, "defaultEditor"),
    httpMethod: readConfigString(input, "httpMethod"),
    seriesLimit: readConfigNumber(input, "seriesLimit", Number.MAX_SAFE_INTEGER),
    useSeriesEndpoint: readConfigBoolean(input, "useSeriesEndpoint"),
    maxDataPoints: readConfigNumber(input, "maxDataPoints", 1),
    prometheusType: readConfigString(input, "prometheusType"),
    cacheLevel: readConfigString(input, "cacheLevel"),
    disableMetricsLookup: readConfigBoolean(input, "disableMetricsLookup"),
    customQueryParameters: readConfigString(input, "customQueryParameters"),
  };
}

function buildDefaultPrometheusQuery(input: {
  initialPromql: string;
  maxDataPoints: number;
  queryModelId: string | undefined;
}): PrometheusConnectionQuery {
  if (input.queryModelId === "promql-instant") {
    return {
      kind: "promql-instant",
      query: input.initialPromql,
    };
  }

  return {
    kind: "promql-range",
    query: input.initialPromql,
    stepMs: DEFAULT_PROMQL_RANGE_STEP_MS,
    maxDataPoints: input.maxDataPoints,
  };
}

export function resolvePrometheusDraftDefaults(
  input: ConnectionQueryDraftDefaultsResolverInput,
): ConnectionQueryDraftDefaults {
  const config = resolvePrometheusConfig({
    connectionInstance: input.connectionInstance,
    connectionType: input.connectionType,
  });
  const selectedQueryModel =
    input.selectedQueryModel ??
    input.queryModels.find((model) => model.id === "promql-range") ??
    input.queryModels[0];

  if (!selectedQueryModel) {
    return {};
  }

  const initialPromql = getInitialPromql(input.connectionType);
  const defaultRange = buildPrometheusDefaultFixedRange(config.defaultExploreLookback);

  return {
    queryModelId: selectedQueryModel.id,
    query: buildDefaultPrometheusQuery({
      initialPromql,
      maxDataPoints: config.maxDataPoints,
      queryModelId: selectedQueryModel.id,
    }),
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
  };
}

export function PrometheusConnectionSourceSummary({
  connectionInstance,
  connectionType,
}: ConnectionAuthoringSummaryProps) {
  const config = useMemo(
    () => resolvePrometheusConfig({ connectionInstance, connectionType }),
    [connectionInstance, connectionType],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">Data source</div>
        <div className="mt-1 truncate text-sm font-semibold text-foreground">
          {connectionInstance.name}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {connectionInstance.id}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
        <Badge variant="neutral">scrape {config.scrapeInterval}</Badge>
        <Badge variant="neutral">timeout {config.queryTimeout}</Badge>
        <Badge variant="neutral">{config.httpMethod}</Badge>
        <Badge variant="neutral">series {config.seriesLimit.toLocaleString()}</Badge>
        <Badge variant="neutral">{config.endpointMode || "prometheus-compatible"}</Badge>
        <Badge variant="neutral">auth {config.authType || "none"}</Badge>
        {config.endpointMode === "google-managed-prometheus" ? (
          <>
            <Badge variant="neutral">project {config.projectId || "not set"}</Badge>
            <Badge variant="neutral">location {config.location || "global"}</Badge>
          </>
        ) : null}
        <Badge variant="neutral">{config.prometheusType}</Badge>
        <Badge variant="neutral">cache {config.cacheLevel}</Badge>
        {config.useSeriesEndpoint ? <Badge variant="neutral">series endpoint</Badge> : null}
        {config.disableMetricsLookup ? <Badge variant="neutral">metrics lookup off</Badge> : null}
        {config.customQueryParameters ? <Badge variant="neutral">custom params</Badge> : null}
      </div>
    </div>
  );
}

export const prometheusConnectionAuthoringContract: ConnectionAuthoringContract = {
  resolveDraftDefaults: resolvePrometheusDraftDefaults,
  SummaryComponent: PrometheusConnectionSourceSummary,
  exploreTitle: "Prometheus Explore",
  exploreDescription:
    "Runs the same generated connection query request and PromQL authoring surface used by workspace connection-query widgets and managed widget-owned sources.",
  exploreRunButtonLabel: "Run query",
  exploreResultDescription: "Preview of the normalized connection runtime frame.",
};
