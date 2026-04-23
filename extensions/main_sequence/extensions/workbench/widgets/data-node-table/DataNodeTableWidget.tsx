import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  AllCommunityModule,
  type CellStyle,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { CalendarClock, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardControls } from "@/dashboards/DashboardControls";
import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import {
  resolveDataNodeDateRange,
} from "../data-node-shared/dataNodeShared";
import {
  useResolvedDataNodeWidgetSourceBinding,
} from "../data-node-shared/dataNodeWidgetSource";
import { withAlpha } from "@/lib/color";
import { useTheme } from "@/themes/ThemeProvider";
import { getThemeTightnessMetrics } from "@/themes/tightness";
import type { ThemeTokens } from "@/themes/types";
import { createAgGridTerminalTheme } from "@/widgets/extensions/ag-grid/grid-theme";
import type { WidgetComponentProps } from "@/widgets/types";

import {
  buildDataNodeTableVisualizerFrameFromRemoteData,
  buildDataNodeTableVisualizerRowObjects,
  evaluateDataNodeTableVisualizerRule,
  formatDataNodeTableVisualizerValue,
  getDataNodeTableVisualizerColumnRange,
  getDataNodeTableVisualizerNumericValue,
  getDataNodeTableVisualizerValueLabel,
  resolveDataNodeTableVisualizerColumns,
  resolveDataNodeTableVisualizerProps,
  resolveDataNodeTableVisualizerPropsWithFrame,
  validateDataNodeTableVisualizerSchema,
  type ResolvedDataNodeTableVisualizerColumnConfig,
  type ResolvedDataNodeTableVisualizerProps,
  type DataNodeTableVisualizerSchemaValidationIssue,
  type DataNodeTableVisualizerCellValue,
  type DataNodeTableVisualizerConditionalRule,
  type DataNodeTableVisualizerProps,
  type DataNodeTableVisualizerRow,
  type DataNodeTableVisualizerTone,
  type DataNodeTableVisualizerValueLabel,
} from "./dataNodeTableModel";

type Props = WidgetComponentProps<DataNodeTableVisualizerProps>;
type ColumnRange = ReturnType<typeof getDataNodeTableVisualizerColumnRange>;

interface DataNodeTableVisualizerCellRendererParams
  extends ICellRendererParams<DataNodeTableVisualizerRow, DataNodeTableVisualizerCellValue> {
  columnConfig: ResolvedDataNodeTableVisualizerColumnConfig;
  resolvedProps: ResolvedDataNodeTableVisualizerProps;
  range: ColumnRange;
  tokens: ThemeTokens;
}

const agGridModules = [AllCommunityModule];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseHexColor(hex: string) {
  const normalized = hex.trim().replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return null;
  }

  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return null;
  }

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function toHexColor({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}) {
  const encode = (value: number) =>
    Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

  return `#${encode(r)}${encode(g)}${encode(b)}`;
}

function interpolateHexColor(left: string, right: string, ratio: number) {
  const leftColor = parseHexColor(left);
  const rightColor = parseHexColor(right);

  if (!leftColor || !rightColor) {
    return left;
  }

  const normalizedRatio = clamp(ratio);

  return toHexColor({
    r: leftColor.r + (rightColor.r - leftColor.r) * normalizedRatio,
    g: leftColor.g + (rightColor.g - leftColor.g) * normalizedRatio,
    b: leftColor.b + (rightColor.b - leftColor.b) * normalizedRatio,
  });
}

function getHeatmapPaletteStops(
  palette: ResolvedDataNodeTableVisualizerColumnConfig["heatmapPalette"],
) {
  switch (palette) {
    case "viridis":
      return ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];
    case "plasma":
      return ["#0d0887", "#7e03a8", "#cc4778", "#f89441", "#f0f921"];
    case "inferno":
      return ["#000004", "#420a68", "#932667", "#dd513a", "#fca50a", "#fcffa4"];
    case "magma":
      return ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"];
    case "turbo":
      return ["#30123b", "#4675ed", "#1bcfd4", "#61fc6c", "#d1e834", "#fe9b2d", "#c52702"];
    case "jet":
      return ["#00008f", "#005bff", "#00d4ff", "#7dff7a", "#ffe600", "#ff7d00", "#800000"];
    case "blue-white-red":
      return ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"];
    case "red-yellow-green":
      return ["#a50026", "#f46d43", "#fee08b", "#a6d96a", "#1a9850"];
    case "auto":
    default:
      return ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"];
  }
}

function getInterpolatedPaletteColor(stops: string[], ratio: number) {
  if (stops.length === 0) {
    return "#000000";
  }

  if (stops.length === 1) {
    return stops[0]!;
  }

  const normalizedRatio = clamp(ratio);
  const scaled = normalizedRatio * (stops.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const localRatio = scaled - lowerIndex;

  return interpolateHexColor(stops[lowerIndex]!, stops[upperIndex]!, localRatio);
}

function getHeatmapNormalizedRatio(numericValue: number, range: ColumnRange) {
  if (!range) {
    return 0.5;
  }

  if (range.min === range.max) {
    return 1;
  }

  return clamp((numericValue - range.min) / (range.max - range.min));
}

function getHeatmapBackgroundAlpha(
  numericValue: number,
  range: ColumnRange,
) {
  if (!range) {
    return 0.28;
  }

  if (range.min === range.max) {
    return 0.58;
  }

  if (range.min < 0 && range.max > 0) {
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    return 0.18 + clamp(Math.abs(numericValue) / maxAbs) * 0.44;
  }

  return 0.18 + getHeatmapNormalizedRatio(numericValue, range) * 0.44;
}

function getColumnTone(
  numericValue: number,
  range: ColumnRange,
  tokens: ThemeTokens,
) {
  if (range && range.min < 0 && range.max <= 0) {
    return tokens.danger;
  }

  if (range && range.min < 0 && range.max > 0) {
    return numericValue >= 0 ? tokens.primary : tokens.danger;
  }

  return numericValue >= 0 ? tokens.primary : tokens.warning;
}

function getBarFillRatio(numericValue: number, range: ColumnRange) {
  if (!range) {
    return 0;
  }

  if (range.min === range.max) {
    return 1;
  }

  if (range.min < 0 && range.max > 0) {
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    return clamp(Math.abs(numericValue) / maxAbs);
  }

  const denominator = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
  return clamp(Math.abs(numericValue) / denominator);
}

function resolveColumnVisualRange(
  columnConfig: Pick<
    ResolvedDataNodeTableVisualizerColumnConfig,
    "visualMax" | "visualMin" | "visualRangeMode"
  >,
  range: ColumnRange,
): ColumnRange {
  if (
    columnConfig.visualRangeMode === "fixed" &&
    typeof columnConfig.visualMin === "number" &&
    Number.isFinite(columnConfig.visualMin) &&
    typeof columnConfig.visualMax === "number" &&
    Number.isFinite(columnConfig.visualMax) &&
    columnConfig.visualMin < columnConfig.visualMax
  ) {
    return {
      min: columnConfig.visualMin,
      max: columnConfig.visualMax,
    };
  }

  return range;
}

function getMatchingConditionalRule(
  resolvedProps: ResolvedDataNodeTableVisualizerProps,
  columnKey: string,
  numericValue: number,
) {
  return (
    resolvedProps.conditionalRules.find(
      (rule) => rule.columnKey === columnKey && evaluateDataNodeTableVisualizerRule(numericValue, rule),
    ) ?? null
  );
}

function getAlignmentClasses(
  align: ResolvedDataNodeTableVisualizerColumnConfig["align"],
) {
  if (align === "left") {
    return "justify-start text-left";
  }

  if (align === "center") {
    return "justify-center text-center";
  }

  return "justify-end text-right";
}

function supportsValueLabels(columnConfig: Pick<ResolvedDataNodeTableVisualizerColumnConfig, "format">) {
  return columnConfig.format === "text";
}

function supportsNumericDisplay(columnConfig: Pick<ResolvedDataNodeTableVisualizerColumnConfig, "format">) {
  return columnConfig.format !== "text";
}

function formatSchemaValidationIssue(issue: DataNodeTableVisualizerSchemaValidationIssue) {
  if (issue.code === "empty_schema") {
    return "No schema fields are configured for this widget instance.";
  }

  if (issue.code === "missing_columns") {
    return `Configured fields not found in the data rows: ${(issue.columnKeys ?? []).join(", ")}`;
  }

  return `Fields formatted as numeric but backed by non-numeric data: ${(issue.columnKeys ?? []).join(", ")}`;
}

function resolveSemanticToneColor(
  tone: DataNodeTableVisualizerTone | undefined,
  tokens: ThemeTokens,
) {
  if (tone === "primary") {
    return tokens.primary;
  }

  if (tone === "success") {
    return tokens.success;
  }

  if (tone === "warning") {
    return tokens.warning;
  }

  if (tone === "danger") {
    return tokens.danger;
  }

  return tokens["muted-foreground"];
}

function resolveLabelToneStyle(
  entry: Pick<DataNodeTableVisualizerValueLabel, "tone" | "backgroundColor" | "textColor">,
  tokens: ThemeTokens,
) {
  const toneColor = resolveSemanticToneColor(entry.tone, tokens);
  return {
    textColor: entry.textColor ?? toneColor,
    backgroundColor: entry.backgroundColor ?? withAlpha(toneColor, entry.tone === "neutral" ? 0.18 : 0.14),
    borderColor:
      entry.backgroundColor != null
        ? withAlpha(entry.backgroundColor, 0.58)
        : withAlpha(entry.tone === "neutral" ? tokens.border : toneColor, 0.42),
  };
}

function resolveConditionalToneStyle(
  entry: Pick<DataNodeTableVisualizerConditionalRule, "tone" | "backgroundColor" | "textColor">,
  tokens: ThemeTokens,
) {
  const toneColor = resolveSemanticToneColor(entry.tone, tokens);
  return {
    textColor: entry.textColor ?? (entry.tone ? toneColor : tokens.foreground),
    backgroundColor: entry.backgroundColor ?? toneColor,
  };
}

function getValueLabelChipClass(
  density: ResolvedDataNodeTableVisualizerProps["density"],
) {
  return density === "compact"
    ? "inline-flex max-w-full min-h-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.08em] overflow-hidden"
    : "inline-flex max-w-full min-h-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.12em] overflow-hidden";
}

function createTableCellStyle({
  value,
  columnConfig,
  resolvedProps,
  range,
  tokens,
}: Omit<DataNodeTableVisualizerCellRendererParams, "api" | "colDef" | "column" | "context" | "data" | "eGridCell" | "eParentOfValue" | "getValue" | "node" | "pinned" | "registerRowDragger" | "refreshCell" | "setTooltip" | "valueFormatted">): CellStyle {
  const cellValue = value ?? null;
  const supportsNumericFormatting = supportsNumericDisplay(columnConfig);
  const numericValue = supportsNumericFormatting ? getDataNodeTableVisualizerNumericValue(cellValue) : null;
  const conditionalRule =
    numericValue === null
      ? null
      : getMatchingConditionalRule(resolvedProps, columnConfig.key, numericValue);

  const style: CellStyle = {
    textAlign: columnConfig.align,
    color: conditionalRule?.textColor ?? tokens.foreground,
  };
  const visualRange = resolveColumnVisualRange(columnConfig, range);

  if (conditionalRule?.backgroundColor) {
    style.background = `linear-gradient(90deg, ${withAlpha(conditionalRule.backgroundColor, 0.18)} 0%, ${withAlpha(
      conditionalRule.backgroundColor,
      0.08,
    )} 100%)`;
    style.boxShadow = `inset 3px 0 0 ${withAlpha(conditionalRule.backgroundColor, 0.72)}`;
    return style;
  }

  if (conditionalRule?.tone) {
    const toneStyle = resolveConditionalToneStyle(conditionalRule, tokens);
    style.color = toneStyle.textColor;
    style.background = `linear-gradient(90deg, ${withAlpha(toneStyle.backgroundColor, 0.16)} 0%, ${withAlpha(
      toneStyle.backgroundColor,
      0.05,
    )} 100%)`;
    style.boxShadow = `inset 3px 0 0 ${withAlpha(toneStyle.backgroundColor, 0.44)}`;
    return style;
  }

  if (
    !supportsNumericFormatting ||
    (columnConfig.gradientMode !== "fill" && !columnConfig.heatmap) ||
    numericValue === null
  ) {
    return style;
  }

  const effectivePalette =
    columnConfig.heatmapPalette === "auto"
      ? (visualRange && visualRange.min < 0 && visualRange.max > 0
          ? "blue-white-red"
          : "viridis")
      : columnConfig.heatmapPalette;
  const heatmapColor = getInterpolatedPaletteColor(
    getHeatmapPaletteStops(effectivePalette),
    getHeatmapNormalizedRatio(numericValue, visualRange),
  );

  style.backgroundColor = withAlpha(
    heatmapColor,
    getHeatmapBackgroundAlpha(numericValue, visualRange),
  );
  style.boxShadow = `inset 0 0 0 1px ${withAlpha(heatmapColor, 0.18)}`;

  return style;
}

function DataNodeTableVisualizerCellRenderer({
  value,
  columnConfig,
  resolvedProps,
  range,
  tokens,
}: DataNodeTableVisualizerCellRendererParams) {
  const cellValue = value ?? null;
  const formattedValue = formatDataNodeTableVisualizerValue(cellValue, columnConfig);
  const supportsNumericFormatting = supportsNumericDisplay(columnConfig);
  const numericValue = supportsNumericFormatting ? getDataNodeTableVisualizerNumericValue(cellValue) : null;
  const conditionalRule =
    numericValue === null
      ? null
      : getMatchingConditionalRule(resolvedProps, columnConfig.key, numericValue);
  const valueLabel =
    supportsValueLabels(columnConfig)
      ? getDataNodeTableVisualizerValueLabel(resolvedProps, columnConfig.key, cellValue)
      : null;
  const alignmentClasses = getAlignmentClasses(columnConfig.align);
  const visualRange = resolveColumnVisualRange(columnConfig, range);

  if (valueLabel) {
    const toneStyle = resolveLabelToneStyle(valueLabel, tokens);
    return (
      <div className={`flex h-full w-full items-center overflow-hidden ${alignmentClasses}`}>
        <span
          className={getValueLabelChipClass(resolvedProps.density)}
          style={{
            color: toneStyle.textColor,
            backgroundColor: toneStyle.backgroundColor,
            borderColor: toneStyle.borderColor,
            maxHeight: resolvedProps.density === "compact" ? "calc(100% - 6px)" : "calc(100% - 8px)",
          }}
        >
          <span className="truncate">{valueLabel.label ?? formattedValue}</span>
        </span>
      </div>
    );
  }

  const fillRatio =
    supportsNumericFormatting && numericValue !== null && columnConfig.barMode === "fill"
      ? getBarFillRatio(numericValue, visualRange)
      : 0;
  const fillTone =
    numericValue !== null ? getColumnTone(numericValue, visualRange, tokens) : tokens.primary;
  const gaugeRatio =
    supportsNumericFormatting && numericValue !== null && columnConfig.gaugeMode === "ring"
      ? getBarFillRatio(numericValue, visualRange)
      : 0;
  const gaugeCircumference = 2 * Math.PI * 9;
  const gaugeStrokeOffset = gaugeCircumference * (1 - gaugeRatio);

  return (
    <div className={`relative flex h-full w-full items-center overflow-hidden ${alignmentClasses}`}>
      {fillRatio > 0 ? (
        <div
          className="pointer-events-none absolute inset-y-1 left-0 rounded-[6px]"
          style={{
            width: `${Math.max(fillRatio * 100, 6)}%`,
            background: `linear-gradient(90deg, ${withAlpha(fillTone, 0.18)} 0%, ${withAlpha(
              fillTone,
              0.42,
            )} 100%)`,
            boxShadow: `inset 0 0 0 1px ${withAlpha(fillTone, 0.22)}`,
          }}
        />
      ) : null}
      {columnConfig.gaugeMode === "ring" ? (
        <span className="relative z-10 mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke={withAlpha(tokens.border, 0.9)}
              strokeWidth="3"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke={fillTone}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={gaugeCircumference}
              strokeDashoffset={gaugeStrokeOffset}
            />
          </svg>
        </span>
      ) : null}
      <span
        className="relative z-10 w-full truncate font-medium tabular-nums"
        style={{ color: conditionalRule?.textColor }}
      >
        {formattedValue}
      </span>
    </div>
  );
}

export function DataNodeTableWidget({ props, instanceId }: Props) {
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const { resolvedTokens, tightness } = useTheme();
  const tightnessMetrics = useMemo(() => getThemeTightnessMetrics(tightness), [tightness]);
  const normalizedProps = useMemo(
    () => resolveDataNodeTableVisualizerProps(props),
    [props],
  );
  const sourceBindingProps = useMemo<DataNodeTableVisualizerProps>(
    () => ({
      sourceMode: normalizedProps.sourceMode,
      sourceWidgetId: normalizedProps.sourceWidgetId,
      dataNodeId: normalizedProps.dataNodeId,
      dateRangeMode: normalizedProps.dateRangeMode,
      fixedStartMs: normalizedProps.fixedStartMs,
      fixedEndMs: normalizedProps.fixedEndMs,
      uniqueIdentifierList: normalizedProps.uniqueIdentifierList,
    }),
    [
      normalizedProps.dataNodeId,
      normalizedProps.dateRangeMode,
      normalizedProps.fixedEndMs,
      normalizedProps.fixedStartMs,
      normalizedProps.sourceMode,
      normalizedProps.sourceWidgetId,
      normalizedProps.uniqueIdentifierList,
    ],
  );
  const sourceBinding = useResolvedDataNodeWidgetSourceBinding({
    props: sourceBindingProps,
    currentWidgetInstanceId: instanceId,
  });
  useResolveWidgetUpstream(instanceId, {
    enabled: sourceBinding.requiresUpstreamResolution,
  });
  const linkedDataset = sourceBinding.resolvedSourceDataset;
  const effectiveProps = useMemo(
    () => ({
      ...normalizedProps,
      ...sourceBinding.resolvedSourceProps,
    }),
    [normalizedProps, sourceBinding.resolvedSourceProps],
  );
  const baseResolvedProps = useMemo(
    () => resolveDataNodeTableVisualizerProps(effectiveProps),
    [effectiveProps],
  );

  const resolvedRange = useMemo(
    () =>
      resolveDataNodeDateRange(
        baseResolvedProps,
        rangeStartMs,
        rangeEndMs,
      ),
    [baseResolvedProps, rangeEndMs, rangeStartMs],
  );
  const sourceColumns = linkedDataset?.columns ?? [];
  const sourceRows = linkedDataset?.rows ?? [];

  const remoteFrame = useMemo(
    () =>
      buildDataNodeTableVisualizerFrameFromRemoteData(
        undefined,
        sourceRows,
        sourceColumns,
        linkedDataset?.fields ?? [],
      ),
    [linkedDataset?.fields, sourceColumns, sourceRows],
  );
  const resolvedProps = useMemo(
    () => resolveDataNodeTableVisualizerPropsWithFrame(effectiveProps, remoteFrame),
    [effectiveProps, remoteFrame],
  );
  const rowObjects = useMemo(
    () => buildDataNodeTableVisualizerRowObjects(resolvedProps.columns, resolvedProps.rows),
    [resolvedProps.columns, resolvedProps.rows],
  );
  const columns = useMemo(
    () => resolveDataNodeTableVisualizerColumns(resolvedProps),
    [resolvedProps],
  );
  const schemaValidation = useMemo(
    () => validateDataNodeTableVisualizerSchema(rowObjects, columns),
    [columns, rowObjects],
  );
  const dataErrorMessage =
    linkedDataset?.status === "error"
      ? linkedDataset.error ?? "The linked Data Node failed to load rows."
      : null;
  const isDataLoading = linkedDataset?.status === "loading" || linkedDataset == null;
  const [quickFilter, setQuickFilter] = useState("");
  const deferredQuickFilter = useDeferredValue(quickFilter);

  const theme = useMemo(
    () => createAgGridTerminalTheme(resolvedTokens, tightnessMetrics.table),
    [resolvedTokens, tightnessMetrics],
  );

  const columnRanges = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [column.key, getDataNodeTableVisualizerColumnRange(rowObjects, column.key)]),
      ) satisfies Record<string, ColumnRange>,
    [columns, rowObjects],
  );

  const columnDefs = useMemo<ColDef<DataNodeTableVisualizerRow>[]>(
    () =>
      columns.map((column) => ({
        field: column.key,
        colId: column.key,
        headerName: column.label,
        headerTooltip: column.description,
        minWidth: column.minWidth ?? 110,
        flex: column.flex ?? 1,
        hide: !column.visible,
        pinned: column.pinned,
        sortable: true,
        resizable: true,
        filter: column.format === "text" ? "agTextColumnFilter" : "agNumberColumnFilter",
        floatingFilter: true,
        suppressHeaderMenuButton: false,
        cellDataType: column.format === "text" ? "text" : "number",
        tooltipValueGetter: (params) => formatDataNodeTableVisualizerValue(params.value ?? null, column),
        cellStyle: (params) =>
          createTableCellStyle({
            value: params.value ?? null,
            columnConfig: column,
            resolvedProps,
            range: columnRanges[column.key] ?? null,
            tokens: resolvedTokens,
          }),
        cellRenderer: DataNodeTableVisualizerCellRenderer,
        cellRendererParams: {
          columnConfig: column,
          resolvedProps,
          range: columnRanges[column.key] ?? null,
          tokens: resolvedTokens,
        },
      })),
    [columnRanges, columns, resolvedProps, resolvedTokens],
  );

  const defaultColDef = useMemo<ColDef<DataNodeTableVisualizerRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      floatingFilter: true,
      flex: 1,
      minWidth: 110,
    }),
    [],
  );

  const rowHeight =
    resolvedProps.density === "compact"
      ? tightnessMetrics.table.agGridRowHeight
      : tightnessMetrics.table.agGridRowHeight + 6;
  const headerHeight =
    resolvedProps.density === "compact"
      ? tightnessMetrics.table.agGridHeaderHeight
      : tightnessMetrics.table.agGridHeaderHeight + 4;

  useEffect(() => {
    if (!resolvedProps.showSearch && quickFilter) {
      setQuickFilter("");
    }
  }, [quickFilter, resolvedProps.showSearch]);

  if (sourceBinding.isFilterWidgetSource && !sourceBinding.hasResolvedFilterWidgetSource) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and use the Bindings tab to connect this table to a Data Node.
          </p>
        </div>
      </div>
    );
  }

  if (sourceBinding.isAwaitingBoundSourceValue) {
    return <Skeleton className="h-full" />;
  }

  if (!sourceBinding.hasResolvedFilterWidgetSource || !linkedDataset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a Data Node source</div>
          <p className="text-sm text-muted-foreground">
            This table only renders the canonical dataset coming from a linked Data Node.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedProps.dateRangeMode === "fixed" && !resolvedRange.hasValidRange) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Fix the Data Node date range</div>
          <p className="text-sm text-muted-foreground">
            The linked Data Node needs both a start and end date for its fixed dataset window.
          </p>
        </div>
      </div>
    );
  }

  if (isDataLoading && sourceRows.length === 0) {
    return <Skeleton className="h-full" />;
  }

  if (dataErrorMessage) {
    return (
      <div className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {dataErrorMessage}
      </div>
    );
  }

  return (
    <AgGridProvider modules={agGridModules}>
      <div className="flex h-full min-h-[280px] flex-col overflow-hidden border border-border/70 bg-card/70 text-foreground">
        {resolvedProps.showToolbar ? (
          <div className="border-b border-border/70 bg-card/88 px-4 py-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {resolvedProps.showSearch ? (
                <div className="flex min-w-[280px] flex-1 flex-wrap items-center justify-end gap-2">
                  <Input
                    value={quickFilter}
                    onChange={(event) => {
                      setQuickFilter(event.target.value);
                    }}
                    placeholder="Quick filter rows, labels, and routes"
                    className="max-w-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!quickFilter}
                    onClick={() => {
                      setQuickFilter("");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!schemaValidation.isValid ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="w-full max-w-3xl border border-danger/40 bg-danger/10 px-4 py-4 text-sm text-danger">
              <div className="font-medium text-foreground">Wrong schema affects rendering</div>
              <p className="mt-1 text-danger/90">
                The current widget schema does not match the available row shape, so the table cannot render reliably.
              </p>
              <ul className="mt-3 space-y-1">
                {schemaValidation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{formatSchemaValidationIssue(issue)}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <AgGridReact<DataNodeTableVisualizerRow>
              theme={theme}
              rowData={rowObjects}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              quickFilterText={resolvedProps.showSearch ? deferredQuickFilter : ""}
              animateRows
              enableCellTextSelection
              pagination={resolvedProps.pagination}
              paginationPageSize={resolvedProps.pageSize}
              rowHeight={rowHeight}
              headerHeight={headerHeight}
              getRowStyle={() =>
                resolvedProps.zebraRows
                  ? undefined
                  : {
                      backgroundColor: withAlpha(resolvedTokens.card, 0.98),
                    }
              }
            />
          </div>
        )}

        {!isDataLoading &&
        !dataErrorMessage &&
        rowObjects.length === 0 ? (
          <div className="border-t border-border/70 bg-background/22 px-4 py-3 text-sm text-muted-foreground">
            No rows were returned for the selected period.
          </div>
        ) : null}
      </div>
    </AgGridProvider>
  );
}
