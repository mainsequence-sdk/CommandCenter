import { useEffect, useMemo, useState } from "react";

import { AlertTriangle, BarChart3, Table2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type {
  CommandCenterFrame,
  CommandCenterFrameFieldType,
  ConnectionQueryResponse,
} from "@/connections/types";
import { cn } from "@/lib/utils";
import { GraphChartErrorBoundary } from "@/widgets/core/graph/GraphChartErrorBoundary";
import {
  buildGraphChartSeries,
  buildGraphSeries,
  resolveGraphConfig,
  resolveGraphDatasetFrame,
  resolveGraphEffectiveTimeAxisMode,
  resolveGraphNormalizationTimeMs,
  resolveGraphSourceFieldDefaults,
  type GraphChartType,
  type GraphSeries,
} from "@/widgets/core/graph/graphModel";
import { EChartsSeriesChart } from "@/widgets/core/graph/EChartsSeriesChart";
import { TradingViewSeriesChart } from "@/widgets/core/graph/TradingViewSeriesChart";
import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT,
  hasTabularTimeSeriesSemantics,
  legacyTimeSeriesFrameToTabularFrameSource,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameFieldType,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import { TabularPreviewTable } from "@/widgets/shared/tabular-preview-table";
import { resolveTabularFieldOptionsFromDataset } from "@/widgets/shared/tabular-widget-source";

type PreviewFrame = CommandCenterFrame | TabularFrameSourceV1;
type ConnectionQueryResultView = "graph" | "table";
type GraphPreview = {
  chartSeries: GraphSeries[];
  chartType: GraphChartType;
  effectiveTimeAxisMode: "date" | "datetime";
  normalizationTimeMs: number | "series-start" | null;
  xAxisType: "time" | "value";
};

function formatConnectionQueryJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const entries = value.flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );

  return entries.length > 0 ? entries : undefined;
}

function mapFrameFieldType(type: CommandCenterFrameFieldType): TabularFrameFieldType {
  return type === "time" ? "datetime" : type;
}

function getFrameWarnings(
  frame: TabularFrameSourceV1,
  response: ConnectionQueryResponse | undefined,
) {
  const warnings = isPlainRecord(frame.source?.context)
    ? normalizeStringArray(frame.source.context.warnings)
    : undefined;

  return warnings ?? response?.warnings;
}

function getFrameTraceId(
  frame: TabularFrameSourceV1,
  response: ConnectionQueryResponse | undefined,
) {
  if (isPlainRecord(frame.source?.context)) {
    const traceId = frame.source.context.traceId;

    if (typeof traceId === "string" && traceId.trim()) {
      return traceId.trim();
    }
  }

  return response?.traceId;
}

function commandFrameToTabularFrameSource(
  frame: CommandCenterFrame,
  response: ConnectionQueryResponse | undefined,
): TabularFrameSourceV1 | null {
  if (frame.contract === LEGACY_TIME_SERIES_FRAME_SOURCE_CONTRACT) {
    return legacyTimeSeriesFrameToTabularFrameSource({
      ...frame,
      status: "ready",
      warnings: response?.warnings,
      traceId: response?.traceId,
    });
  }

  const columns = frame.fields.map((field) => field.name);
  const rows = Array.from(
    { length: Math.max(0, ...frame.fields.map((field) => field.values.length)) },
    (_entry, rowIndex) =>
      Object.fromEntries(
        frame.fields.map((field) => [field.name, field.values[rowIndex] ?? null]),
      ),
  );
  const fields = frame.fields.map<TabularFrameFieldSchema>((field) => ({
    key: field.name,
    label: field.config?.displayName ?? field.name,
    type: mapFrameFieldType(field.type),
    nullable: true,
    provenance: "backend",
    nativeType: field.type,
    reason: "Returned by the selected connection query frame.",
  }));
  const rawMeta = isPlainRecord(frame.meta) ? frame.meta : {};
  const normalizedMeta = normalizeTabularFrameSource({
    status: "ready",
    columns,
    rows: [],
    fields,
    meta: rawMeta,
  })?.meta;
  const meta = normalizedMeta ?? (Object.keys(rawMeta).length > 0 ? rawMeta : undefined);

  return {
    status: "ready",
    columns,
    rows,
    fields,
    meta,
    source: {
      kind: "connection-query",
      label: frame.name,
      context: {
        sourceContract: frame.contract,
        warnings: response?.warnings,
        traceId: response?.traceId,
      },
    },
  };
}

function coercePreviewFrame(
  frame: PreviewFrame | null | undefined,
  response: ConnectionQueryResponse | undefined,
) {
  if (!frame) {
    return null;
  }

  return (
    normalizeTabularFrameSource(frame) ??
    commandFrameToTabularFrameSource(frame as CommandCenterFrame, response)
  );
}

function pickPreviewFrame(response: ConnectionQueryResponse | null | undefined) {
  if (!response?.frames?.length) {
    return undefined;
  }

  const coerced = response.frames
    .map((frame) => coercePreviewFrame(frame, response ?? undefined))
    .filter((frame): frame is TabularFrameSourceV1 => frame !== null);

  return coerced.find((frame) => hasTabularTimeSeriesSemantics(frame)) ?? coerced[0];
}

function parseNumericPreviewValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveNumericGraphDefaults(sourceFrame: TabularFrameSourceV1) {
  const sourceDefaults = resolveGraphSourceFieldDefaults(sourceFrame);

  if (sourceDefaults.xField && sourceDefaults.yField) {
    return sourceDefaults;
  }

  const numericFieldKeys = (sourceFrame.fields ?? [])
    .filter((field) => field.type === "number")
    .map((field) => field.key);
  const fallbackXField = sourceDefaults.xField ?? numericFieldKeys[0];
  const fallbackYField =
    sourceDefaults.yField ?? numericFieldKeys.find((fieldKey) => fieldKey !== fallbackXField);

  return {
    xField: fallbackXField,
    yField: fallbackYField,
    groupField: sourceDefaults.groupField,
  };
}

function buildNumericGraphSeries(
  rows: Array<Record<string, unknown>>,
  config: {
    groupField?: string;
    xField?: string;
    yField?: string;
  },
  maxSeries = 12,
) {
  if (!config.xField || !config.yField) {
    return [] as GraphSeries[];
  }

  const groupedPoints = new Map<
    string,
    {
      id: string;
      label: string;
      pointMap: Map<number, number>;
    }
  >();

  rows.forEach((row) => {
    const xValue = parseNumericPreviewValue(row[config.xField!]);
    const yValue = parseNumericPreviewValue(row[config.yField!]);

    if (xValue === null || yValue === null) {
      return;
    }

    const groupLabel = config.groupField ? String(row[config.groupField] ?? "—") : config.yField!;
    const groupKey = config.groupField ? String(row[config.groupField] ?? "__empty__") : config.yField!;
    const current =
      groupedPoints.get(groupKey) ??
      {
        id: groupKey,
        label: groupLabel,
        pointMap: new Map<number, number>(),
      };

    current.pointMap.set(xValue, yValue);
    groupedPoints.set(groupKey, current);
  });

  return [...groupedPoints.values()]
    .map((series) => ({
      id: series.id,
      label: series.label,
      pointCount: series.pointMap.size,
      points: [...series.pointMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([time, value]) => ({ time, value })),
    }))
    .filter((series) => series.points.length > 0)
    .sort((left, right) => right.pointCount - left.pointCount)
    .slice(0, maxSeries);
}

function buildGraphPreview(
  frame: TabularFrameSourceV1 | null | undefined,
  chartType: GraphChartType,
): GraphPreview | null {
  const sourceFrame = resolveGraphDatasetFrame(frame);

  if (!sourceFrame) {
    return null;
  }

  const sourceDefaults = resolveGraphSourceFieldDefaults(sourceFrame);
  const fieldOptions = resolveTabularFieldOptionsFromDataset({
    columns: sourceFrame.columns,
    fields: sourceFrame.fields,
    rows: sourceFrame.rows,
  });
  const config = resolveGraphConfig(
    {
      sourceMode: "filter_widget",
      provider: "tradingview",
      chartType,
      dateRangeMode: "dashboard",
      minBarSpacingPx: 0.01,
      xField: sourceDefaults.xField,
      yField: sourceDefaults.yField,
      groupField: sourceDefaults.groupField,
    },
    null,
    fieldOptions,
  );

  if (hasTabularTimeSeriesSemantics(sourceFrame)) {
    const seriesResult = buildGraphSeries(sourceFrame.rows, config, 12);
    const effectiveTimeAxisMode = resolveGraphEffectiveTimeAxisMode(config, sourceFrame.rows);
    const chartSeriesResult = buildGraphChartSeries(seriesResult.series, effectiveTimeAxisMode);

    if (chartSeriesResult.series.length > 0) {
      return {
        chartSeries: chartSeriesResult.series,
        chartType: config.chartType,
        effectiveTimeAxisMode,
        normalizationTimeMs: resolveGraphNormalizationTimeMs(config),
        xAxisType: "time",
      };
    }
  }

  const numericDefaults = resolveNumericGraphDefaults(sourceFrame);
  const numericConfig = resolveGraphConfig(
    {
      sourceMode: "filter_widget",
      provider: "echarts",
      chartType,
      dateRangeMode: "dashboard",
      minBarSpacingPx: 0.01,
      xField: numericDefaults.xField,
      yField: numericDefaults.yField,
      groupField: numericDefaults.groupField,
    },
    null,
    fieldOptions,
  );
  const numericSeries = buildNumericGraphSeries(sourceFrame.rows, numericConfig, 12);

  if (numericSeries.length === 0) {
    return null;
  }

  return {
    chartSeries: numericSeries,
    chartType: numericConfig.chartType,
    effectiveTimeAxisMode: "datetime",
    normalizationTimeMs: null,
    xAxisType: "value",
  };
}

export function ConnectionQueryResponsePreview({
  className,
  description = "Preview of the normalized connection response.",
  emptyMessage = "Run a query to see the response.",
  frame,
  response,
  showRaw = true,
  title = "Query result",
}: {
  className?: string;
  description?: string;
  emptyMessage?: string;
  frame?: PreviewFrame | null;
  response?: ConnectionQueryResponse | null;
  showRaw?: boolean;
  title?: string;
}) {
  const [resultView, setResultView] = useState<ConnectionQueryResultView>("table");
  const [graphChartType, setGraphChartType] = useState<GraphChartType>("line");
  const previewFrame = useMemo(
    () => coercePreviewFrame(frame ?? pickPreviewFrame(response), response ?? undefined),
    [frame, response],
  );
  const graphPreview = useMemo(
    () => buildGraphPreview(previewFrame, graphChartType),
    [graphChartType, previewFrame],
  );
  const resultSupportsGraph = Boolean(graphPreview);

  useEffect(() => {
    if (!previewFrame) {
      return;
    }

    setResultView(resultSupportsGraph ? "graph" : "table");
  }, [previewFrame, resultSupportsGraph]);

  if (!previewFrame) {
    return (
      <div
        className={cn(
          "rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/55 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  const rawValue = response ?? frame ?? previewFrame;
  const warnings = getFrameWarnings(previewFrame, response ?? undefined);
  const traceId = getFrameTraceId(previewFrame, response ?? undefined);

  return (
    <div className={cn("rounded-[calc(var(--radius)-4px)] border border-border/70 bg-card/55", className)}>
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {resultSupportsGraph && resultView === "graph" ? (
                <BarChart3 className="h-5 w-5 text-primary" />
              ) : (
                <Table2 className="h-5 w-5 text-primary" />
              )}
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {response?.frames ? (
              <Badge variant="neutral">
                {response.frames.length.toLocaleString()} {response.frames.length === 1 ? "frame" : "frames"}
              </Badge>
            ) : null}
            <Badge variant="neutral">{CORE_TABULAR_FRAME_SOURCE_CONTRACT}</Badge>
            <Badge variant="neutral">
              {previewFrame.rows.length.toLocaleString()} rows
            </Badge>
            <Badge variant="neutral">
              {previewFrame.columns.length.toLocaleString()} columns
            </Badge>
            {traceId ? <Badge variant="neutral">trace {traceId}</Badge> : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {resultSupportsGraph ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 px-3 py-2">
            <div className="flex items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/60 p-0.5">
              {(["graph", "table"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  className={`rounded-[calc(var(--radius)-10px)] px-3 py-1 text-xs font-medium transition-colors ${
                    resultView === view
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                  }`}
                  onClick={() => {
                    setResultView(view);
                  }}
                >
                  {view === "graph" ? "Graph" : "Table"}
                </button>
              ))}
            </div>
            {resultView === "graph" ? (
              <div className="flex items-center gap-1 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/60 p-0.5">
                {(["line", "area", "bar"] as const).map((chartType) => (
                  <button
                    key={chartType}
                    type="button"
                    className={`rounded-[calc(var(--radius)-10px)] px-3 py-1 text-xs font-medium transition-colors ${
                      graphChartType === chartType
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setGraphChartType(chartType);
                    }}
                  >
                    {chartType === "line" ? "Lines" : chartType === "area" ? "Area" : "Bars"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {resultSupportsGraph && resultView === "graph" ? (
          <div className="h-[360px] min-h-0 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35 p-3">
            <GraphChartErrorBoundary
              fallback={(
                <div className="flex h-full items-center justify-center rounded-[calc(var(--radius)-6px)] border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
                  The chart could not be rendered. Inspect the normalized frame metadata and values.
                </div>
              )}
            >
              {graphPreview?.xAxisType === "value" ? (
                <EChartsSeriesChart
                  chartType={graphPreview.chartType}
                  emptyMessage="No chartable rows are available for this result."
                  normalizationTimeMs={graphPreview.normalizationTimeMs}
                  series={graphPreview.chartSeries}
                  timeAxisMode={graphPreview.effectiveTimeAxisMode}
                  xAxisType="value"
                />
              ) : (
                <TradingViewSeriesChart
                  chartType={graphPreview?.chartType ?? graphChartType}
                  emptyMessage="No chartable rows are available for this result."
                  minBarSpacingPx={0.01}
                  normalizationTimeMs={graphPreview?.normalizationTimeMs}
                  series={graphPreview?.chartSeries ?? []}
                  timeAxisMode={graphPreview?.effectiveTimeAxisMode ?? "datetime"}
                />
              )}
            </GraphChartErrorBoundary>
          </div>
        ) : (
          <TabularPreviewTable
            columns={previewFrame.columns}
            rows={previewFrame.rows}
            emptyMessage="No rows were returned by this connection query."
            maxRows={50}
          />
        )}

        {warnings?.length ? (
          <div className="flex gap-2 rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{warnings.join(" ")}</span>
          </div>
        ) : null}

        {showRaw ? (
          <details className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/35">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
              Raw response
            </summary>
            <pre className="max-h-[420px] overflow-auto border-t border-border/70 p-4 text-xs">
              {formatConnectionQueryJson(rawValue)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectionFramePreview({ frame }: { frame?: CommandCenterFrame }) {
  return (
    <ConnectionQueryResponsePreview
      frame={frame}
      showRaw={false}
      emptyMessage="No frame rows returned."
    />
  );
}
