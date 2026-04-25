import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetSettingsComponentProps } from "@/widgets/types";

import { GraphTable } from "./GraphTable";
import type { GraphControllerContext } from "./controller";
import {
  buildGraphChartSeries,
  normalizeGraphLineStyle,
  buildGraphSeries,
  buildGraphTableColumns,
  resolveGraphEffectiveTimeAxisMode,
  resolveGraphNormalizationTimeMs,
  type GraphViewMode,
  type GraphWidgetProps,
} from "./graphModel";
import { TradingViewSeriesChart } from "./TradingViewSeriesChart";
import { EChartsSeriesChart } from "./EChartsSeriesChart";
import { GraphChartErrorBoundary } from "./GraphChartErrorBoundary";
import { TabularFieldSchemaInspector } from "@/widgets/shared/tabular-field-schema-inspector";
import { PickerField, type PickerOption } from "@/widgets/shared/picker-field";

const previewRowLimit = 2_500;

const lineStyleOptions: PickerOption[] = [
  { value: "solid", label: "Solid", description: "TradingView solid stroke." },
  { value: "dotted", label: "Dotted", description: "TradingView dotted stroke." },
  { value: "dashed", label: "Dashed", description: "TradingView dashed stroke." },
  { value: "large_dashed", label: "Large dashed", description: "TradingView large dashed stroke." },
  { value: "sparse_dotted", label: "Sparse dotted", description: "TradingView sparse dotted stroke." },
];

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function formatPreviewTimestamp(timestampMs: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestampMs);
}

function formatRangeSummary(startMs: number, endMs: number) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(startMs)} - ${formatter.format(endMs)}`;
}

function toColorInputValue(value: string | undefined, fallback: string) {
  if (typeof value === "string" && /^#(?:[0-9a-fA-F]{6})$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return fallback;
}

function buildSourceSchemaEmptyMessage(input: {
  hasBoundSource: boolean;
  isAwaitingBoundSourceValue: boolean;
  sourceStatus?: string;
}) {
  if (!input.hasBoundSource) {
    return "Bind this graph to a tabular source to inspect its source schema.";
  }

  if (input.isAwaitingBoundSourceValue || input.sourceStatus === "idle" || input.sourceStatus === "loading") {
    return "The source binding is valid, but the bound widget has not published a runtime frame yet.";
  }

  if (input.sourceStatus === "error") {
    return "The source binding is valid, but the bound widget published an error instead of a schema.";
  }

  return "The source binding is valid, but the resolved frame does not include fields or rows to inspect.";
}

function buildSeriesStylingEmptyMessage(input: {
  hasBoundSource: boolean;
  isAwaitingBoundSourceValue: boolean;
  previewRows: number;
  sourceStatus?: string;
}) {
  if (!input.hasBoundSource) {
    return "Bind a chartable tabular source before configuring per-series styling.";
  }

  if (input.isAwaitingBoundSourceValue || input.sourceStatus === "idle" || input.sourceStatus === "loading") {
    return "The source binding is valid, but the bound widget has not published a runtime frame yet.";
  }

  if (input.sourceStatus === "error") {
    return "The source binding is valid, but the bound widget returned an error.";
  }

  if (input.previewRows === 0) {
    return "The bound source returned no rows, so there are no series to style yet.";
  }

  return "Rows are loaded, but the graph cannot derive chartable series from the current time and value fields.";
}

export function GraphWidgetSettings({
  draftProps,
  editable,
  onDraftPropsChange,
  controllerContext,
}: WidgetSettingsComponentProps<GraphWidgetProps>) {
  const { resolvedTokens } = useTheme();
  const context = controllerContext as GraphControllerContext | undefined;
  const resolvedConfig = context?.resolvedConfig;
  const hasNoData = context?.hasNoData ?? false;
  const linkedDataset = useMemo(
    () => context?.resolvedSourceDataset ?? null,
    [context?.resolvedSourceDataset],
  );
  const hasBoundSource = Boolean(context?.sourceWidgetId || context?.resolvedSourceWidget);
  const hasPreviewSource = Boolean(resolvedConfig?.sourceId || hasBoundSource);
  const [previewModeOverride, setPreviewModeOverride] = useState<GraphViewMode | null>(
    null,
  );

  const activePreviewMode = previewModeOverride ?? "chart";
  const previewRange = { hasValidRange: true, rangeStartMs: null, rangeEndMs: null };
  const previewRows = linkedDataset?.rows ?? [];
  const sourceStatus = linkedDataset?.status;
  const previewErrorMessage =
    linkedDataset?.status === "error"
      ? linkedDataset.error ?? "The bound source failed to load rows."
      : null;
  const previewIsLoading =
    Boolean(context?.isAwaitingBoundSourceValue) ||
    linkedDataset?.status === "loading";

  const previewSeriesResult = useMemo(
    () =>
      resolvedConfig
        ? buildGraphSeries(previewRows, resolvedConfig)
        : { series: [], droppedGroups: 0, filteredGroups: 0, totalGroups: 0 },
    [previewRows, resolvedConfig],
  );
  const previewTimeAxisMode = useMemo(
    () =>
      resolvedConfig
        ? resolveGraphEffectiveTimeAxisMode(resolvedConfig, previewRows)
        : "datetime",
    [previewRows, resolvedConfig],
  );
  const previewChartSeriesResult = useMemo(
    () => buildGraphChartSeries(previewSeriesResult.series, previewTimeAxisMode),
    [previewSeriesResult.series, previewTimeAxisMode],
  );
  const previewTableColumns = useMemo(
    () =>
      resolvedConfig
        ? buildGraphTableColumns(previewRows, resolvedConfig)
        : [],
    [previewRows, resolvedConfig],
  );
  const previewNormalizationTimeMs = useMemo(
    () =>
      resolvedConfig
        ? resolveGraphNormalizationTimeMs(resolvedConfig)
        : null,
    [resolvedConfig],
  );
  const previewRangeSummary =
    previewRange.rangeStartMs && previewRange.rangeEndMs
        ? formatRangeSummary(previewRange.rangeStartMs, previewRange.rangeEndMs)
        : "Select a valid date range to preview";
  const canRenderPreviewContent =
    Boolean(context?.isFilterWidgetSource) || previewRange.hasValidRange;
  const previewChartEmptyMessage =
    previewRows.length > 0
      ? "Rows were loaded, but the selected X field is not time-like or the Y field is not numeric."
      : "No chartable rows are available for the selected range.";
  const canRenderChartPreview = Boolean(resolvedConfig?.xField && resolvedConfig?.yField);
  const suggestedGroupField = null;
  const previewChartCollisionMessage = useMemo(() => {
    if (previewChartSeriesResult.collapsedPointCount <= 0) {
      return null;
    }

    const baseMessage = `Merged ${previewChartSeriesResult.collapsedPointCount.toLocaleString()} preview row ${
      previewChartSeriesResult.collapsedPointCount === 1 ? "collision" : "collisions"
    } that resolved to the same chart second. The preview keeps the latest point per second.`;

    if (suggestedGroupField) {
      return `${baseMessage} Consider grouping by ${suggestedGroupField}.`;
    }

    return baseMessage;
  }, [
    previewChartSeriesResult.collapsedPointCount,
    suggestedGroupField,
  ]);

  const seriesStyleRows = useMemo(() => {
    const palette = [
      resolvedTokens.primary,
      resolvedTokens.accent,
      resolvedTokens.success,
      resolvedTokens.warning,
      resolvedTokens.danger,
    ];

    return previewSeriesResult.series.map((series, index) => ({
      id: series.id,
      label: series.label,
      pointCount: series.pointCount,
      color: toColorInputValue(
        resolvedConfig?.seriesOverrides?.[series.id]?.color,
        toColorInputValue(palette[index % palette.length], "#2563eb"),
      ),
      lineStyle: normalizeGraphLineStyle(
        resolvedConfig?.seriesOverrides?.[series.id]?.lineStyle,
      ),
    }));
  }, [previewSeriesResult.series, resolvedConfig?.seriesOverrides, resolvedTokens]);

  function updateSeriesColor(seriesId: string, color: string) {
    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: {
        ...(resolvedConfig?.seriesOverrides ?? {}),
        [seriesId]: {
          ...(resolvedConfig?.seriesOverrides?.[seriesId] ?? {}),
          color,
        },
      },
    });
  }

  function updateSeriesLineStyle(seriesId: string, lineStyle: string) {
    const normalizedLineStyle = normalizeGraphLineStyle(lineStyle);

    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: {
        ...(resolvedConfig?.seriesOverrides ?? {}),
        [seriesId]: {
          ...(resolvedConfig?.seriesOverrides?.[seriesId] ?? {}),
          lineStyle: normalizedLineStyle === "solid" ? undefined : normalizedLineStyle,
        },
      },
    });
  }

  function clearSeriesColor(seriesId: string) {
    if (!resolvedConfig?.seriesOverrides?.[seriesId]) {
      return;
    }

    const nextOverrides = { ...(resolvedConfig.seriesOverrides ?? {}) };
    const nextSeriesOverride = { ...(nextOverrides[seriesId] ?? {}) };
    delete nextSeriesOverride.color;
    delete nextSeriesOverride.lineStyle;

    if (Object.keys(nextSeriesOverride).length > 0) {
      nextOverrides[seriesId] = nextSeriesOverride;
    } else {
      delete nextOverrides[seriesId];
    }

    onDraftPropsChange({
      ...draftProps,
      seriesOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
  }

  if (!resolvedConfig) {
    return null;
  }

  return (
    <div className="space-y-4">
      <TabularFieldSchemaInspector
        title="Resolved source schema"
        description="Inspect the resolved field schema this graph is using for axis selection, grouping, and date parsing."
        fields={resolvedConfig.availableFields}
        rows={previewRows}
        emptyMessage={buildSourceSchemaEmptyMessage({
          hasBoundSource,
          isAwaitingBoundSourceValue: Boolean(context?.isAwaitingBoundSourceValue),
          sourceStatus,
        })}
      />

      <SettingsSection
        title="Series styling"
        description="Lock specific series colors and line styles after the preview resolves the active series list."
      >
        {!hasPreviewSource || hasNoData ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            {buildSeriesStylingEmptyMessage({
              hasBoundSource,
              isAwaitingBoundSourceValue: Boolean(context?.isAwaitingBoundSourceValue),
              previewRows: previewRows.length,
              sourceStatus,
            })}
          </div>
        ) : context?.isAwaitingBoundSourceValue ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            The source binding is valid, but the bound widget has not published a runtime frame yet.
          </div>
        ) : previewErrorMessage ? (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-danger/50 bg-danger/8 px-4 py-5 text-sm text-danger">
            {previewErrorMessage}
          </div>
        ) : previewIsLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
            <Skeleton className="h-24 rounded-[calc(var(--radius)-6px)]" />
          </div>
        ) : seriesStyleRows.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {seriesStyleRows.map((series) => (
              <div
                key={series.id}
                className="space-y-3 rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{series.label}</div>
                  <div className="text-xs text-muted-foreground">
                      {series.pointCount > 0
                        ? `${series.pointCount.toLocaleString()} preview points`
                        : "Uses the active series id when data becomes available."}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!editable || !resolvedConfig.seriesOverrides?.[series.id]}
                    onClick={() => clearSeriesColor(series.id)}
                  >
                    Reset
                  </Button>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="color"
                      value={series.color}
                      onChange={(event) => updateSeriesColor(series.id, event.target.value)}
                      disabled={!editable}
                      className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                    />
                    <Input value={series.color} readOnly />
                  </label>

                  <PickerField
                    value={series.lineStyle}
                    onChange={(value) => updateSeriesLineStyle(series.id, value)}
                    options={lineStyleOptions}
                    placeholder="Solid"
                    disabled={!editable}
                    searchPlaceholder="Search line styles"
                    emptyMessage="No line styles."
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/20 px-4 py-5 text-sm text-muted-foreground">
            {buildSeriesStylingEmptyMessage({
              hasBoundSource,
              isAwaitingBoundSourceValue: Boolean(context?.isAwaitingBoundSourceValue),
              previewRows: previewRows.length,
              sourceStatus,
            })}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
