import { useEffect, useMemo, useRef, useState } from "react";

import { Database, LineChart } from "lucide-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

import { Skeleton } from "@/components/ui/skeleton";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import type { WidgetComponentProps } from "@/widgets/types";

import { useResolvedDataNodeWidgetSourceBinding } from "../../../workbench/widgets/data-node-shared/dataNodeWidgetSource";
import {
  buildZeroCurveSeriesFromRows,
  formatZeroCurveDayLabel,
  normalizeZeroCurveProps,
  resolveZeroCurveConfig,
  type MainSequenceZeroCurveWidgetProps,
} from "./zeroCurveModel";

type Props = WidgetComponentProps<MainSequenceZeroCurveWidgetProps>;

const curvePaletteTokenOrder = ["primary", "accent", "success", "warning", "danger"] as const;

function formatYield(value: number) {
  const absValue = Math.abs(value);
  const maximumFractionDigits = absValue >= 10 ? 2 : absValue >= 1 ? 3 : 4;

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)}%`;
}

function getSeriesPalette(resolvedTokens: Record<string, string>) {
  return curvePaletteTokenOrder.map((tokenKey) => resolvedTokens[tokenKey]);
}

function hashCurveFamilyKey(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getCurveFamilyLabel(uniqueIdentifier: string) {
  return uniqueIdentifier === "__empty__" ? "Curve" : uniqueIdentifier;
}

function getCurveFamilyColor(uniqueIdentifier: string, palette: string[], fallback: string) {
  if (palette.length === 0) {
    return fallback;
  }

  return palette[hashCurveFamilyKey(uniqueIdentifier) % palette.length] ?? fallback;
}

function getCurveFamilySeriesStyling({
  familySeriesCount,
  familySeriesIndex,
}: {
  familySeriesCount: number;
  familySeriesIndex: number;
}) {
  if (familySeriesCount <= 1) {
    return {
      alpha: 1,
      isLatest: true,
      lineWidth: 4,
    };
  }

  const isLatest = familySeriesIndex === familySeriesCount - 1;

  return {
    alpha: isLatest ? 1 : 0.14,
    isLatest,
    lineWidth: isLatest ? 4.5 : 1.25,
  };
}

function getTooltipPointPayload(
  value: unknown,
): { day: number | null; rate: number | null; timeIndexLabel: string | null } {
  if (Array.isArray(value)) {
    return {
      day: typeof value[0] === "number" ? value[0] : null,
      rate: typeof value[1] === "number" ? value[1] : null,
      timeIndexLabel: null,
    };
  }

  if (!value || typeof value !== "object") {
    return {
      day: null,
      rate: null,
      timeIndexLabel: null,
    };
  }

  const record = value as {
    timeIndexLabel?: unknown;
    value?: unknown;
  };
  const rawValue = record.value;

  return {
    day: Array.isArray(rawValue) && typeof rawValue[0] === "number" ? rawValue[0] : null,
    rate: Array.isArray(rawValue) && typeof rawValue[1] === "number" ? rawValue[1] : null,
    timeIndexLabel:
      typeof record.timeIndexLabel === "string" && record.timeIndexLabel.trim().length > 0
        ? record.timeIndexLabel
        : null,
  };
}

function buildZeroCurveChartOption({
  palette,
  resolvedTokens,
  series,
}: {
  palette: string[];
  resolvedTokens: Record<string, string>;
  series: Awaited<ReturnType<typeof buildZeroCurveSeriesFromRows>>["series"];
}): EChartsOption {
  const sortedSeries = [...series].sort((left, right) => {
    if (left.uniqueIdentifier !== right.uniqueIdentifier) {
      return left.uniqueIdentifier.localeCompare(right.uniqueIdentifier);
    }

    const leftTime = left.timeIndexSortValue ?? Number.NEGATIVE_INFINITY;
    const rightTime = right.timeIndexSortValue ?? Number.NEGATIVE_INFINITY;
    return leftTime - rightTime;
  });
  const familyOrder = new Map<string, string[]>();
  const familyBaseColors = new Map<string, string>();
  const seriesById = new Map<string, (typeof sortedSeries)[number]>();

  sortedSeries.forEach((entry) => {
    const familySeries = familyOrder.get(entry.uniqueIdentifier) ?? [];
    familySeries.push(entry.id);
    familyOrder.set(entry.uniqueIdentifier, familySeries);
    seriesById.set(entry.id, entry);
    if (!familyBaseColors.has(entry.uniqueIdentifier)) {
      familyBaseColors.set(
        entry.uniqueIdentifier,
        getCurveFamilyColor(entry.uniqueIdentifier, palette, resolvedTokens.primary),
      );
    }
  });
  const legendFamilies = [...familyOrder.keys()].map((uniqueIdentifier) => ({
    name: getCurveFamilyLabel(uniqueIdentifier),
    icon: "circle",
    textStyle: {
      color: familyBaseColors.get(uniqueIdentifier) ?? resolvedTokens.foreground,
      fontWeight: 600,
    },
    itemStyle: {
      color: familyBaseColors.get(uniqueIdentifier) ?? resolvedTokens.primary,
    },
  }));

  const allDays = series.flatMap((entry) => entry.points.map((point) => point.day));
  const allValues = series.flatMap((entry) => entry.points.map((point) => point.value));
  const minDay = allDays.reduce((currentMin, day) => Math.min(currentMin, day), Number.POSITIVE_INFINITY);
  const maxDay = allDays.reduce((currentMax, day) => Math.max(currentMax, day), 0);
  const minValue = allValues.reduce(
    (currentMin, value) => Math.min(currentMin, value),
    Number.POSITIVE_INFINITY,
  );
  const maxValue = allValues.reduce((currentMax, value) => Math.max(currentMax, value), Number.NEGATIVE_INFINITY);
  const xPadding = Number.isFinite(minDay) && Number.isFinite(maxDay)
    ? Math.max(Math.round((maxDay - minDay) * 0.03), 1)
    : 1;
  const yPadding = Number.isFinite(minValue) && Number.isFinite(maxValue)
    ? Math.max((maxValue - minValue) * 0.08, 0.001)
    : 0.001;

  return {
    animation: false,
    color: palette,
    grid: {
      left: 18,
      right: 18,
      top: 18,
      bottom: series.length > 1 ? 72 : 40,
      containLabel: true,
    },
    legend: series.length > 1 ? {
      type: "scroll",
      data: legendFamilies,
      bottom: 8,
      left: 12,
      right: 12,
      textStyle: {
        color: resolvedTokens["muted-foreground"],
      },
    } : undefined,
    tooltip: {
      trigger: "item",
      axisPointer: {
        show: false,
      },
      backgroundColor: resolvedTokens.card,
      borderColor: withAlpha(resolvedTokens.border, 0.72),
      textStyle: {
        color: resolvedTokens.foreground,
      },
      formatter: (params: unknown) => {
        const typedParams = params as {
          color?: string;
          data?: unknown;
          seriesId?: string;
          seriesIndex?: number;
          seriesName?: string;
        };
        const seriesMeta =
          (typeof typedParams.seriesId === "string"
            ? seriesById.get(typedParams.seriesId)
            : null) ??
          (typeof typedParams.seriesIndex === "number"
            ? sortedSeries[typedParams.seriesIndex] ?? null
            : null);
        const color = typedParams.color ?? resolvedTokens.primary;
        const pointPayload = getTooltipPointPayload(typedParams.data);
        const title = typedParams.seriesName ?? "Curve";
        const dateLabel = pointPayload.timeIndexLabel ?? seriesMeta?.timeIndexLabel ?? "—";

        return [
          `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">`,
          `<span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${color}"></span>`,
          `<span style="font-weight:600">${title}</span>`,
          `</div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px">`,
          `<span style="color:${resolvedTokens["muted-foreground"]}">Date</span>`,
          `<span style="font-weight:600">${dateLabel}</span>`,
          `</div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px">`,
          `<span style="color:${resolvedTokens["muted-foreground"]}">Tenor</span>`,
          `<span style="font-weight:600">${typeof pointPayload.day === "number" ? formatZeroCurveDayLabel(pointPayload.day) : "—"}</span>`,
          `</div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px">`,
          `<span style="color:${resolvedTokens["muted-foreground"]}">Rate</span>`,
          `<span style="font-weight:600">${typeof pointPayload.rate === "number" ? formatYield(pointPayload.rate) : "—"}</span>`,
          `</div>`,
        ].join("");
      },
    },
    xAxis: {
      type: "value",
      min: Number.isFinite(minDay) ? Math.max(0, minDay - xPadding) : 0,
      max: Number.isFinite(maxDay) ? maxDay + xPadding : 1,
      scale: true,
      axisLine: {
        lineStyle: {
          color: withAlpha(resolvedTokens.border, 0.72),
        },
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: resolvedTokens["muted-foreground"],
        formatter: (value: number) => formatZeroCurveDayLabel(value),
      },
      splitLine: {
        lineStyle: {
          color: withAlpha(resolvedTokens["chart-grid"], 0.08),
        },
      },
      minorSplitLine: {
        show: false,
      },
      boundaryGap: [0, 0],
    },
    yAxis: {
      type: "value",
      min: Number.isFinite(minValue) ? minValue - yPadding : "dataMin",
      max: Number.isFinite(maxValue) ? maxValue + yPadding : "dataMax",
      scale: true,
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: resolvedTokens["muted-foreground"],
        formatter: (value: number) => formatYield(value),
      },
      splitLine: {
        lineStyle: {
          color: withAlpha(resolvedTokens["chart-grid"], 0.14),
        },
      },
    },
    series: sortedSeries.map((entry) => {
      const familyBaseColor = getCurveFamilyColor(
        entry.uniqueIdentifier,
        palette,
        resolvedTokens.primary,
      );
      const familySeriesIds = familyOrder.get(entry.uniqueIdentifier) ?? [entry.id];
      const familySeriesIndex = familySeriesIds.indexOf(entry.id);
      const { alpha, isLatest, lineWidth } = getCurveFamilySeriesStyling({
        familySeriesCount: familySeriesIds.length,
        familySeriesIndex: Math.max(familySeriesIndex, 0),
      });
      const lineColor = withAlpha(familyBaseColor, alpha);

      return ({
      type: "line",
      id: entry.id,
      name: getCurveFamilyLabel(entry.uniqueIdentifier),
      data: entry.points.map((point) => ({
        value: [point.day, point.value],
        timeIndexLabel: entry.timeIndexLabel,
      })),
      showSymbol: false,
      triggerLineEvent: true,
      lineStyle: {
        color: lineColor,
        width: lineWidth,
      },
      itemStyle: {
        color: lineColor,
        opacity: isLatest ? 1 : Math.max(alpha, 0.08),
      },
      emphasis: {
        focus: "series",
        lineStyle: {
          width: isLatest ? lineWidth + 0.5 : Math.max(lineWidth + 1, 2),
        },
      },
      connectNulls: false,
      smooth: false,
      z: isLatest ? 3 : 1,
    });
    }),
  };
}

export function ZeroCurveWidget({ props, instanceId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTokens } = useTheme();

  const normalizedProps = useMemo(
    () => normalizeZeroCurveProps(props),
    [props],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: normalizedProps,
    currentWidgetInstanceId: instanceId,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const effectiveSourceProps = sourceBinding.resolvedSourceProps;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...effectiveSourceProps,
    }),
    [effectiveSourceProps, normalizedProps],
  );
  const resolvedConfig = useMemo(
    () => resolveZeroCurveConfig(effectiveProps),
    [effectiveProps],
  );
  const hasRuntimeRows = (linkedDataset?.rows?.length ?? 0) > 0;
  const palette = useMemo(
    () => getSeriesPalette(resolvedTokens),
    [resolvedTokens],
  );
  const [seriesState, setSeriesState] = useState<{
    error: string | null;
    loading: boolean;
    result: Awaited<ReturnType<typeof buildZeroCurveSeriesFromRows>> | null;
  }>({
    error: null,
    loading: false,
    result: null,
  });

  useEffect(() => {
    let cancelled = false;
    const rows = linkedDataset?.rows ?? [];

    setSeriesState({
      error: null,
      loading: true,
      result: null,
    });

    void buildZeroCurveSeriesFromRows(rows, resolvedConfig)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSeriesState({
          error: null,
          loading: false,
          result,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setSeriesState({
          error:
            error instanceof Error
              ? error.message
              : "Zero Curve rows could not be decompressed.",
          loading: false,
          result: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [linkedDataset?.rows, resolvedConfig]);

  const overallRange = useMemo(() => {
    const datedSeries = (seriesState.result?.series ?? [])
      .filter(
        (entry): entry is typeof entry & {
          timeIndexLabel: string;
          timeIndexSortValue: number;
        } =>
          typeof entry.timeIndexLabel === "string" &&
          entry.timeIndexLabel.trim().length > 0 &&
          typeof entry.timeIndexSortValue === "number" &&
          Number.isFinite(entry.timeIndexSortValue),
      )
      .sort((left, right) => left.timeIndexSortValue - right.timeIndexSortValue);

    if (datedSeries.length === 0) {
      return null;
    }

    return {
      endLabel: datedSeries[datedSeries.length - 1]!.timeIndexLabel,
      startLabel: datedSeries[0]!.timeIndexLabel,
    };
  }, [seriesState.result]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !seriesState.result || seriesState.result.series.length === 0) {
      return;
    }

    const chart = echarts.init(container, undefined, {
      renderer: "canvas",
    });
    const option = buildZeroCurveChartOption({
      palette,
      resolvedTokens,
      series: seriesState.result.series,
    });

    chart.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [palette, resolvedTokens, seriesState.result]);

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this zero curve widget to a Data Node widget.
          </p>
        </div>
      </div>
    );
  }

  if (!resolvedConfig.dataNodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Configure the linked Data Node</div>
          <p className="text-sm text-muted-foreground">
            This zero curve widget only renders the compressed curve dataset coming from its linked Data Node widget.
          </p>
        </div>
      </div>
    );
  }

  if (linkedDataset == null || linkedDataset.status === "loading" || seriesState.loading) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (linkedDataset.status === "error") {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {linkedDataset.error ?? "The linked Data Node failed to load rows."}
      </div>
    );
  }

  if (seriesState.error) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {seriesState.error}
      </div>
    );
  }

  if (!hasRuntimeRows || !seriesState.result || seriesState.result.series.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <LineChart className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">No zero curves could be rendered</div>
          <p className="text-sm text-muted-foreground">
            The linked rows did not contain parsable compressed curve payloads for the selected source.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {seriesState.result.invalidRowCount > 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Skipped {seriesState.result.invalidRowCount.toLocaleString()} row
          {seriesState.result.invalidRowCount === 1 ? "" : "s"} because the selected curve payload could not be parsed.
        </div>
      ) : null}

      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)-6px)] border px-2 pt-2 pb-2"
        style={{
          borderColor: withAlpha(resolvedTokens.border, 0.72),
          background: `linear-gradient(180deg, ${withAlpha(resolvedTokens.background, 0.76)} 0%, ${withAlpha(
            resolvedTokens.card,
            0.96,
          )} 100%)`,
        }}
      >
        {overallRange ? (
          <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: withAlpha(resolvedTokens.border, 0.72),
                backgroundColor: withAlpha(resolvedTokens.background, 0.78),
                color: resolvedTokens.foreground,
              }}
            >
              <span className="uppercase tracking-[0.12em] text-[10px] text-muted-foreground">From</span>
              <span className="font-semibold">{overallRange.startLabel}</span>
              <span className="text-muted-foreground">→</span>
              <span className="uppercase tracking-[0.12em] text-[10px] text-muted-foreground">To</span>
              <span className="font-semibold">{overallRange.endLabel}</span>
            </div>
          </div>
        ) : null}
        <div ref={containerRef} className="h-full min-h-0 w-full" />
      </div>
    </div>
  );
}
