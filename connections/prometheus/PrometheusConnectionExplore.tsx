import { useCallback, useEffect, useMemo, useState } from "react";

import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionQueryWorkbench } from "@/connections/ConnectionQueryWorkbench";
import type {
  ConnectionConfigSchema,
  ConnectionExploreProps,
  ConnectionQueryModel,
} from "@/connections/types";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";

import type { PrometheusPublicConfig } from "./index";
import { PrometheusQueryBuilder } from "./PrometheusQueryBuilder";

interface ResolvedPrometheusConfig {
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

function parseDurationMs(value: string) {
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

function buildDefaultFixedRange(lookbackValue: string) {
  const fixedEndMs = Date.now();
  const lookbackMs = parseDurationMs(lookbackValue) ?? 60 * 60 * 1000;
  const fixedStartMs = fixedEndMs - lookbackMs;

  return { fixedStartMs, fixedEndMs };
}

function getInitialPromql(connectionType: ConnectionExploreProps["connectionType"]) {
  const exampleQuery = connectionType.examples?.find((example) => {
    const query = example.query as { query?: unknown } | undefined;
    return typeof query?.query === "string";
  })?.query as { query?: string } | undefined;

  return exampleQuery?.query ?? "";
}

function resolvePrometheusConfig(props: ConnectionExploreProps): ResolvedPrometheusConfig {
  return {
    endpointMode: readConfigString(props, "endpointMode"),
    authType: readConfigString(props, "authType"),
    projectId: readConfigString(props, "projectId"),
    location: readConfigString(props, "location"),
    scrapeInterval: readConfigString(props, "scrapeInterval"),
    queryTimeout: readConfigString(props, "queryTimeout"),
    defaultExploreLookback: readConfigString(props, "defaultExploreLookback"),
    defaultEditor: readConfigString(props, "defaultEditor"),
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

function buildDefaultQueryForModel(input: {
  initialPromql: string;
  maxDataPoints: number;
  queryModelId: string | undefined;
}): Record<string, unknown> {
  const { initialPromql, maxDataPoints, queryModelId } = input;

  if (queryModelId === "promql-instant") {
    return {
      kind: "promql-instant",
      query: initialPromql,
    };
  }

  return {
    kind: "promql-range",
    query: initialPromql,
    maxDataPoints,
  };
}

function buildDefaultQueryProps(input: {
  connectionInstance: ConnectionExploreProps["connectionInstance"];
  defaultQueryModel: ConnectionQueryModel | undefined;
  defaultRange: ReturnType<typeof buildDefaultFixedRange>;
  initialPromql: string;
  maxDataPoints: number;
}): ConnectionQueryWidgetProps {
  const { connectionInstance, defaultQueryModel, defaultRange, initialPromql, maxDataPoints } =
    input;

  return {
    connectionRef: {
      id: connectionInstance.id,
      typeId: connectionInstance.typeId,
    },
    queryModelId: defaultQueryModel?.id,
    query: buildDefaultQueryForModel({
      initialPromql,
      maxDataPoints,
      queryModelId: defaultQueryModel?.id,
    }),
    timeRangeMode: defaultQueryModel?.timeRangeAware ? "fixed" : "none",
    fixedStartMs: defaultRange.fixedStartMs,
    fixedEndMs: defaultRange.fixedEndMs,
  };
}

export function PrometheusConnectionExplore(props: ConnectionExploreProps) {
  const { connectionInstance, connectionType } = props;
  const config = useMemo(
    () => resolvePrometheusConfig(props),
    [connectionInstance.publicConfig, connectionType.publicConfigSchema],
  );
  const initialPromql = useMemo(() => getInitialPromql(connectionType), [connectionType]);
  const queryModels = useMemo(() => connectionType.queryModels ?? [], [connectionType.queryModels]);
  const defaultQueryModel =
    queryModels.find((model) => model.id === "promql-range") ?? queryModels[0];
  const defaultRange = useMemo(
    () => buildDefaultFixedRange(config.defaultExploreLookback),
    [connectionInstance.id, config.defaultExploreLookback],
  );
  const [queryProps, setQueryProps] = useState<ConnectionQueryWidgetProps>(() =>
    buildDefaultQueryProps({
      connectionInstance,
      defaultQueryModel,
      defaultRange,
      initialPromql,
      maxDataPoints: config.maxDataPoints,
    }),
  );
  const [editorMode, setEditorMode] = useState<"builder" | "code">(
    config.defaultEditor === "code" ? "code" : "builder",
  );

  useEffect(() => {
    setQueryProps(
      buildDefaultQueryProps({
        connectionInstance,
        defaultQueryModel,
        defaultRange,
        initialPromql,
        maxDataPoints: config.maxDataPoints,
      }),
    );
    setEditorMode(config.defaultEditor === "code" ? "code" : "builder");
  }, [
    config.defaultEditor,
    config.maxDataPoints,
    connectionInstance.typeId,
    connectionInstance.id,
    defaultQueryModel?.id,
    defaultQueryModel?.timeRangeAware,
    defaultRange.fixedEndMs,
    defaultRange.fixedStartMs,
    initialPromql,
  ]);
  const handleBuilderQueryChange = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return;
      }

      setQueryProps((current) => {
        const currentQuery =
          current.query && typeof current.query === "object" && !Array.isArray(current.query)
            ? current.query
            : {};

        return {
          ...current,
          queryModelId: "promql-range",
          query: {
            ...currentQuery,
            kind: "promql-range",
            query: normalizedQuery,
            maxDataPoints:
              typeof currentQuery.maxDataPoints === "number"
                ? currentQuery.maxDataPoints
                : config.maxDataPoints,
          },
          timeRangeMode: "fixed",
          fixedStartMs: defaultRange.fixedStartMs,
          fixedEndMs: defaultRange.fixedEndMs,
        };
      });
    },
    [config.maxDataPoints, defaultRange.fixedEndMs, defaultRange.fixedStartMs],
  );
  const currentPromql =
    queryProps.query &&
    typeof queryProps.query === "object" &&
    !Array.isArray(queryProps.query) &&
    typeof queryProps.query.query === "string"
      ? queryProps.query.query
      : initialPromql;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <CardTitle>Prometheus Explore</CardTitle>
        </div>
        <CardDescription>
          Runs the same generated connection query request as the workspace Connection Query widget.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Query authoring</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Builder metadata loads only when you request metrics, labels, or values.
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/60 p-0.5">
            {(["builder", "code"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={editorMode === mode ? "default" : "ghost"}
                className="h-8 px-3"
                onClick={() => setEditorMode(mode)}
              >
                {mode === "builder" ? "Builder" : "Code"}
              </Button>
            ))}
          </div>
        </div>

        {editorMode === "builder" ? (
          <PrometheusQueryBuilder
            connectionId={connectionInstance.id}
            defaultRange={defaultRange}
            initialQuery={currentPromql}
            lookupDisabled={config.disableMetricsLookup}
            onQueryChange={handleBuilderQueryChange}
            seriesLimit={config.seriesLimit}
          />
        ) : null}

        <ConnectionQueryWorkbench
          value={queryProps}
          onChange={setQueryProps}
          editable
          connectionInstance={connectionInstance}
          connectionType={connectionType}
          fixedRangeFallback={{
            rangeStartMs: defaultRange.fixedStartMs,
            rangeEndMs: defaultRange.fixedEndMs,
          }}
          showConnectionPicker={false}
          showQueryEditor={editorMode === "code"}
          autoSelectFirstQueryModel
          runButtonLabel="Run query"
          resultDescription="Preview of the normalized connection runtime frame."
        />
      </CardContent>
    </Card>
  );
}
