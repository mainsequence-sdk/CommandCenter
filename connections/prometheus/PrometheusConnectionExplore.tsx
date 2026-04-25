import { useEffect, useMemo, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Play, Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryConnection } from "@/connections/api";
import type {
  ConnectionConfigSchema,
  ConnectionExploreProps,
  ConnectionQueryResponse,
} from "@/connections/types";

import type { PrometheusConnectionQuery, PrometheusPublicConfig } from "./index";

type PrometheusQueryType =
  | "range"
  | "instant"
  | "label-values"
  | "label-names"
  | "series";

type StepMode = "auto" | "manual";

interface ResolvedPrometheusConfig {
  scrapeInterval: string;
  scrapeIntervalMs: number;
  queryTimeout: string;
  defaultExploreLookback: string;
  httpMethod: string;
  seriesLimit: number;
  useSeriesEndpoint: boolean;
  maxDataPoints: number;
  prometheusType: string;
  cacheLevel: string;
  disableMetricsLookup: boolean;
  customQueryParameters: string;
}

function isBlank(value: unknown) {
  return typeof value === "string" ? value.trim() === "" : value === undefined || value === null;
}

function getSchemaDefault(schema: ConnectionConfigSchema | undefined, fieldId: string) {
  return schema?.fields.find((field) => field.id === fieldId)?.defaultValue;
}

function readConfigValue(
  { connectionInstance, connectionType }: ConnectionExploreProps,
  fieldId: keyof PrometheusPublicConfig,
) {
  const instanceValue = connectionInstance.publicConfig[fieldId];

  if (!isBlank(instanceValue)) {
    return instanceValue;
  }

  return getSchemaDefault(connectionType.publicConfigSchema, fieldId);
}

function readConfigString(
  props: ConnectionExploreProps,
  fieldId: keyof PrometheusPublicConfig,
) {
  const value = readConfigValue(props, fieldId);
  return typeof value === "string" ? value.trim() : value === undefined ? "" : String(value);
}

function readConfigNumber(
  props: ConnectionExploreProps,
  fieldId: keyof PrometheusPublicConfig,
  fallback: number,
) {
  const value = readConfigValue(props, fieldId);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readConfigBoolean(
  props: ConnectionExploreProps,
  fieldId: keyof PrometheusPublicConfig,
) {
  const value = readConfigValue(props, fieldId);

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return false;
}

function parseDurationMs(value: string, label: string) {
  const normalized = value.trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);

  if (!match) {
    throw new Error(`${label} must be a duration like 500ms, 15s, 5m, 1h, or 1d.`);
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

function formatDuration(ms: number) {
  if (ms % 86_400_000 === 0) return `${ms / 86_400_000}d`;
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
  if (ms % 60_000 === 0) return `${ms / 60_000}m`;
  if (ms % 1_000 === 0) return `${ms / 1_000}s`;
  return `${ms}ms`;
}

function computeAutoStepMs({
  fromMs,
  toMs,
  scrapeIntervalMs,
  maxDataPoints,
}: {
  fromMs: number;
  toMs: number;
  scrapeIntervalMs: number;
  maxDataPoints: number;
}) {
  const rangeMs = Math.max(1, toMs - fromMs);
  const rawStepMs = Math.ceil(rangeMs / Math.max(1, maxDataPoints));
  const interval = Math.max(1, scrapeIntervalMs);
  return Math.ceil(Math.max(rawStepMs, interval) / interval) * interval;
}

function interpolatePrometheusQuery(
  query: string,
  context: {
    fromMs: number;
    toMs: number;
    intervalMs: number;
    scrapeIntervalMs: number;
  },
) {
  const rangeMs = Math.max(1, context.toMs - context.fromMs);
  const rangeSeconds = Math.max(1, Math.round(rangeMs / 1000));
  const intervalSeconds = Math.max(1, Math.round(context.intervalMs / 1000));
  const scrapeSeconds = Math.max(1, Math.round(context.scrapeIntervalMs / 1000));
  const rateIntervalSeconds = Math.max(intervalSeconds + scrapeSeconds, 4 * scrapeSeconds);

  return query
    .replaceAll("$__range_ms", String(rangeMs))
    .replaceAll("$__range_s", String(rangeSeconds))
    .replaceAll("$__range", `${rangeSeconds}s`)
    .replaceAll("$__interval_ms", String(context.intervalMs))
    .replaceAll("$__interval", `${intervalSeconds}s`)
    .replaceAll("$__rate_interval", `${rateIntervalSeconds}s`);
}

function parseMatchers(value: string) {
  return value
    .split(/[\n,]+/)
    .map((matcher) => matcher.trim())
    .filter(Boolean);
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function summarizeResponse(response: ConnectionQueryResponse) {
  return [
    `${response.frames?.length ?? 0} frames`,
    response.warnings?.length ? `${response.warnings.length} warnings` : undefined,
    response.traceId ? `trace ${response.traceId}` : undefined,
  ].filter((entry): entry is string => Boolean(entry));
}

function getInitialPromql(connectionType: ConnectionExploreProps["connectionType"]) {
  const exampleQuery = connectionType.examples?.find((example) => {
    const query = example.query as { query?: unknown } | undefined;
    return typeof query?.query === "string";
  })?.query as { query?: string } | undefined;

  return exampleQuery?.query ?? "";
}

function resolvePrometheusConfig(props: ConnectionExploreProps): ResolvedPrometheusConfig {
  const scrapeInterval = readConfigString(props, "scrapeInterval");
  const queryTimeout = readConfigString(props, "queryTimeout");
  const defaultExploreLookback = readConfigString(props, "defaultExploreLookback");

  return {
    scrapeInterval,
    scrapeIntervalMs: parseDurationMs(scrapeInterval, "Scrape interval"),
    queryTimeout,
    defaultExploreLookback,
    httpMethod: readConfigString(props, "httpMethod"),
    seriesLimit: readConfigNumber(props, "seriesLimit", Number.MAX_SAFE_INTEGER),
    useSeriesEndpoint: readConfigBoolean(props, "useSeriesEndpoint"),
    maxDataPoints: readConfigNumber(props, "maxDataPoints", 1),
    prometheusType: readConfigString(props, "prometheusType"),
    cacheLevel: readConfigString(props, "cacheLevel"),
    disableMetricsLookup: readConfigBoolean(props, "disableMetricsLookup"),
    customQueryParameters: readConfigString(props, "customQueryParameters"),
  };
}

function buildQueryPayload({
  queryType,
  query,
  labelName,
  matchersText,
  lookbackValue,
  stepMode,
  stepValue,
  config,
}: {
  queryType: PrometheusQueryType;
  query: string;
  labelName: string;
  matchersText: string;
  lookbackValue: string;
  stepMode: StepMode;
  stepValue: string;
  config: ResolvedPrometheusConfig;
}) {
  const toMs = Date.now();
  const fromMs = toMs - parseDurationMs(lookbackValue, "Explore lookback");
  const matchers = parseMatchers(matchersText);

  if (queryType === "label-values") {
    if (!labelName.trim()) {
      throw new Error("Label name is required.");
    }

    return {
      kind: "label-values",
      label: labelName.trim(),
      matchers,
      startMs: fromMs,
      endMs: toMs,
    } satisfies PrometheusConnectionQuery;
  }

  if (queryType === "label-names") {
    return {
      kind: "label-names",
      matchers,
      startMs: fromMs,
      endMs: toMs,
    } satisfies PrometheusConnectionQuery;
  }

  if (queryType === "series") {
    if (matchers.length === 0) {
      throw new Error("At least one series matcher is required.");
    }

    return {
      kind: "series",
      matchers,
      startMs: fromMs,
      endMs: toMs,
    } satisfies PrometheusConnectionQuery;
  }

  if (!query.trim()) {
    throw new Error("PromQL query is required.");
  }

  const stepMs =
    stepMode === "manual"
      ? parseDurationMs(stepValue, "Manual step")
      : computeAutoStepMs({
          fromMs,
          toMs,
          scrapeIntervalMs: config.scrapeIntervalMs,
          maxDataPoints: config.maxDataPoints,
        });
  const expandedQuery = interpolatePrometheusQuery(query, {
    fromMs,
    toMs,
    intervalMs: stepMs,
    scrapeIntervalMs: config.scrapeIntervalMs,
  });

  if (queryType === "instant") {
    return {
      kind: "promql-instant",
      query: expandedQuery,
      timeMs: toMs,
    } satisfies PrometheusConnectionQuery;
  }

  return {
    kind: "promql-range",
    query: expandedQuery,
    startMs: fromMs,
    endMs: toMs,
    stepMs,
    maxDataPoints: config.maxDataPoints,
  } satisfies PrometheusConnectionQuery;
}

export function PrometheusConnectionExplore(props: ConnectionExploreProps) {
  const { connectionInstance, connectionType } = props;
  const configResult = useMemo(() => {
    try {
      return { config: resolvePrometheusConfig(props), error: "" };
    } catch (error) {
      return {
        config: undefined,
        error: error instanceof Error ? error.message : "Invalid Prometheus connection config.",
      };
    }
  }, [props]);
  const config = configResult.config;
  const initialPromql = useMemo(() => getInitialPromql(connectionType), [connectionType]);
  const [query, setQuery] = useState(initialPromql);
  const [queryType, setQueryType] = useState<PrometheusQueryType>("range");
  const [labelName, setLabelName] = useState("__name__");
  const [matchersText, setMatchersText] = useState("");
  const [lookbackValue, setLookbackValue] = useState(config?.defaultExploreLookback ?? "");
  const [stepMode, setStepMode] = useState<StepMode>("auto");
  const [stepValue, setStepValue] = useState(config?.scrapeInterval ?? "");

  useEffect(() => {
    if (!config) {
      return;
    }

    setQuery(initialPromql);
    setLookbackValue(config.defaultExploreLookback);
    setStepValue(config.scrapeInterval);
  }, [
    connectionInstance.uid,
    config?.defaultExploreLookback,
    config?.scrapeInterval,
    initialPromql,
  ]);

  const queryMutation = useMutation({
    mutationFn: async () => {
      if (!config) {
        throw new Error(configResult.error || "Invalid Prometheus connection config.");
      }

      const queryPayload = buildQueryPayload({
        queryType,
        query,
        labelName,
        matchersText,
        lookbackValue,
        stepMode,
        stepValue,
        config,
      });

      const response = await queryConnection<PrometheusConnectionQuery>({
        connectionUid: connectionInstance.uid,
        query: queryPayload,
      });

      return {
        queryPayload,
        response,
      };
    },
  });

  const summaryBadges = useMemo(
    () => queryMutation.data ? summarizeResponse(queryMutation.data.response) : [],
    [queryMutation.data],
  );
  const showPromqlEditor = queryType === "range" || queryType === "instant";
  const showLabelName = queryType === "label-values";
  const showMatchers = queryType === "label-values" || queryType === "label-names" || queryType === "series";
  const resultStepMs =
    queryMutation.data?.queryPayload.kind === "promql-range"
      ? queryMutation.data.queryPayload.stepMs
      : undefined;

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid Prometheus configuration</CardTitle>
          <CardDescription>{configResult.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle>Prometheus Explore</CardTitle>
          </div>
          <CardDescription>
            Run Prometheus queries through the selected backend-managed data source.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_150px_150px]">
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Data source</div>
              <div className="mt-1 truncate text-sm font-semibold text-foreground">
                {connectionInstance.name}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">
                {connectionInstance.uid}
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Query type</span>
              <Select
                value={queryType}
                onChange={(event) => setQueryType(event.target.value as PrometheusQueryType)}
              >
                <option value="range">Range</option>
                <option value="instant">Instant</option>
                <option value="label-values">Label values</option>
                <option value="label-names">Label names</option>
                <option value="series">Series</option>
              </Select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Lookback</span>
              <Input
                value={lookbackValue}
                onChange={(event) => setLookbackValue(event.target.value)}
                placeholder={config.defaultExploreLookback}
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full"
                disabled={queryMutation.isPending}
                onClick={() => queryMutation.mutate()}
              >
                {queryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run query
              </Button>
            </div>
          </div>

          {queryType === "range" ? (
            <div className="grid gap-4 md:grid-cols-[180px_180px_minmax(0,1fr)]">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Step</span>
                <Select
                  value={stepMode}
                  onChange={(event) => setStepMode(event.target.value as StepMode)}
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Manual step</span>
                <Input
                  value={stepValue}
                  disabled={stepMode === "auto"}
                  onChange={(event) => setStepValue(event.target.value)}
                  placeholder={config.scrapeInterval}
                />
              </label>
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Auto step uses the configured scrape interval and max data points for this data source.
              </div>
            </div>
          ) : null}

          {showPromqlEditor ? (
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">PromQL</span>
              <Textarea
                className="min-h-36 font-mono text-xs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Enter PromQL"
              />
            </label>
          ) : null}

          {showLabelName ? (
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">Label name</span>
              <Input value={labelName} onChange={(event) => setLabelName(event.target.value)} />
            </label>
          ) : null}

          {showMatchers ? (
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">Matchers</span>
              <Textarea
                className="min-h-24 font-mono text-xs"
                value={matchersText}
                onChange={(event) => setMatchersText(event.target.value)}
                placeholder='{job="api"}'
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">scrape {config.scrapeInterval}</Badge>
            <Badge variant="neutral">timeout {config.queryTimeout}</Badge>
            <Badge variant="neutral">{config.httpMethod}</Badge>
            <Badge variant="neutral">series {config.seriesLimit.toLocaleString()}</Badge>
            <Badge variant="neutral">{config.prometheusType}</Badge>
            <Badge variant="neutral">cache {config.cacheLevel}</Badge>
            {config.useSeriesEndpoint ? <Badge variant="neutral">series endpoint</Badge> : null}
            {config.disableMetricsLookup ? <Badge variant="neutral">metrics lookup off</Badge> : null}
            {config.customQueryParameters ? <Badge variant="neutral">custom params</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {queryMutation.error ? (
        <Card>
          <CardContent className="flex items-start gap-3 py-5 text-sm text-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {queryMutation.error instanceof Error
                ? queryMutation.error.message
                : "Prometheus query failed."}
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Query Result</CardTitle>
          <CardDescription>
            Normalized response returned by the connection query endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryBadges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summaryBadges.map((badge) => (
                <Badge key={badge} variant="neutral">
                  {badge}
                </Badge>
              ))}
              {resultStepMs ? (
                <Badge variant="neutral">step {formatDuration(resultStepMs)}</Badge>
              ) : null}
            </div>
          ) : null}
          {queryMutation.data ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/40 p-3">
              <div className="text-xs font-medium text-muted-foreground">Request payload</div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                {formatJson(queryMutation.data.queryPayload)}
              </pre>
            </div>
          ) : null}
          <pre className="max-h-[620px] overflow-auto rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/50 p-4 font-mono text-xs leading-6 text-foreground">
            <code>
              {queryMutation.data
                ? formatJson(queryMutation.data.response)
                : "Run a query to see the response."}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
