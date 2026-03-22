import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
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
import {
  fetchDataNodeDataBetweenDatesFromRemote,
  fetchDataNodeDetail,
  formatMainSequenceError,
} from "../../../../common/api";
import {
  buildDataNodeFieldOptions,
  resolveDataNodeDateRange,
} from "../data-node-shared/dataNodeShared";
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

function getHeatmapAlpha(numericValue: number, range: ColumnRange) {
  if (!range) {
    return 0.12;
  }

  if (range.min === range.max) {
    return 0.18;
  }

  if (range.min < 0 && range.max > 0) {
    const maxAbs = Math.max(Math.abs(range.min), Math.abs(range.max), 1);
    return 0.08 + clamp(Math.abs(numericValue) / maxAbs) * 0.2;
  }

  return 0.08 + clamp((numericValue - range.min) / (range.max - range.min)) * 0.2;
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

  if (!supportsNumericFormatting || !columnConfig.heatmap || numericValue === null) {
    return style;
  }

  const tone = getColumnTone(numericValue, range, tokens);
  style.background = `linear-gradient(90deg, ${withAlpha(
    tone,
    getHeatmapAlpha(numericValue, range),
  )} 0%, ${withAlpha(tone, 0.03)} 100%)`;
  style.boxShadow = `inset 1px 0 0 ${withAlpha(tone, 0.24)}`;

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

  if (valueLabel) {
    const toneStyle = resolveLabelToneStyle(valueLabel, tokens);
    return (
      <div className={`flex h-full w-full items-center ${alignmentClasses}`}>
        <span
          className="inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: toneStyle.textColor,
            backgroundColor: toneStyle.backgroundColor,
            borderColor: toneStyle.borderColor,
          }}
        >
          <span className="truncate">{valueLabel.label ?? formattedValue}</span>
        </span>
      </div>
    );
  }

  const fillRatio =
    supportsNumericFormatting && numericValue !== null && columnConfig.barMode === "fill"
      ? getBarFillRatio(numericValue, range)
      : 0;
  const fillTone =
    numericValue !== null ? getColumnTone(numericValue, range, tokens) : tokens.primary;

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
      <span
        className="relative z-10 w-full truncate font-medium tabular-nums"
        style={{ color: conditionalRule?.textColor }}
      >
        {formattedValue}
      </span>
    </div>
  );
}

export function DataNodeTableWidget({ props }: Props) {
  const { rangeStartMs, rangeEndMs } = useDashboardControls();
  const { resolvedTokens, tightness } = useTheme();
  const tightnessMetrics = useMemo(() => getThemeTightnessMetrics(tightness), [tightness]);
  const baseResolvedProps = useMemo(() => resolveDataNodeTableVisualizerProps(props), [props]);
  const dataNodeId =
    baseResolvedProps.sourceMode === "data-node"
      ? Number(baseResolvedProps.dataNodeId ?? 0)
      : 0;

  const dataNodeDetailQuery = useQuery({
    queryKey: ["main_sequence", "widgets", "data_node_table_visualizer", "detail", dataNodeId],
    queryFn: () => fetchDataNodeDetail(dataNodeId),
    enabled:
      baseResolvedProps.sourceMode === "data-node" &&
      Number.isFinite(dataNodeId) &&
      dataNodeId > 0,
    staleTime: 300_000,
  });

  const requestedColumns = useMemo(
    () => buildDataNodeFieldOptions(dataNodeDetailQuery.data).map((field) => field.key),
    [dataNodeDetailQuery.data],
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
  const hasSourceTableConfiguration = Boolean(
    dataNodeDetailQuery.data?.sourcetableconfiguration,
  );

  const dataQuery = useQuery({
    queryKey: [
      "main_sequence",
      "widgets",
      "data_node_table_visualizer",
      dataNodeId,
      requestedColumns.join("|"),
      (baseResolvedProps.uniqueIdentifierList ?? []).join("|"),
      resolvedRange.mode,
      resolvedRange.rangeStartMs,
      resolvedRange.rangeEndMs,
      baseResolvedProps.limit,
    ],
    queryFn: () =>
      fetchDataNodeDataBetweenDatesFromRemote(dataNodeId, {
        start_date: Math.floor((resolvedRange.rangeStartMs ?? 0) / 1000),
        end_date: Math.floor((resolvedRange.rangeEndMs ?? 0) / 1000),
        columns: requestedColumns,
        unique_identifier_list: baseResolvedProps.uniqueIdentifierList,
        great_or_equal: true,
        less_or_equal: true,
        limit: baseResolvedProps.limit,
        offset: 0,
      }),
    enabled:
      baseResolvedProps.sourceMode === "data-node" &&
      Boolean(dataNodeId) &&
      hasSourceTableConfiguration &&
      requestedColumns.length > 0 &&
      resolvedRange.hasValidRange,
    staleTime: 60_000,
  });

  const remoteFrame = useMemo(
    () =>
      baseResolvedProps.sourceMode === "data-node"
        ? buildDataNodeTableVisualizerFrameFromRemoteData(
            dataNodeDetailQuery.data,
            dataQuery.data ?? [],
          )
        : null,
    [baseResolvedProps.sourceMode, dataNodeDetailQuery.data, dataQuery.data],
  );
  const resolvedProps = useMemo(
    () => resolveDataNodeTableVisualizerPropsWithFrame(props, remoteFrame),
    [props, remoteFrame],
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

  if (resolvedProps.sourceMode === "data-node" && !resolvedProps.dataNodeId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Select a data node</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and choose the data node that should feed this table.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedProps.sourceMode === "data-node" && dataNodeDetailQuery.isLoading && !dataNodeDetailQuery.data) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (resolvedProps.sourceMode === "data-node" && dataNodeDetailQuery.isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(dataNodeDetailQuery.error)}
      </div>
    );
  }

  if (resolvedProps.sourceMode === "data-node" && !hasSourceTableConfiguration) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">This data node has no table data</div>
          <p className="text-sm text-muted-foreground">
            Choose another data node with source-table metadata to render it here.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedProps.sourceMode === "data-node" && resolvedProps.dateRangeMode === "fixed" && !resolvedRange.hasValidRange) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)-6px)] border border-dashed border-border/70 bg-background/35 px-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-background/55 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Pick a fixed date range</div>
          <p className="text-sm text-muted-foreground">
            Open widget settings and choose both a start and end date for this table.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedProps.sourceMode === "data-node" && dataQuery.isLoading && !dataQuery.data) {
    return <Skeleton className="h-full rounded-[calc(var(--radius)-6px)]" />;
  }

  if (resolvedProps.sourceMode === "data-node" && dataQuery.isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(dataQuery.error)}
      </div>
    );
  }

  return (
    <AgGridProvider modules={agGridModules}>
      <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-[calc(var(--radius)-6px)] border border-border/70 bg-card/70 text-foreground">
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
            <div className="w-full max-w-3xl rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-4 text-sm text-danger">
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

        {resolvedProps.sourceMode === "data-node" &&
        !dataQuery.isLoading &&
        !dataQuery.isError &&
        rowObjects.length === 0 ? (
          <div className="border-t border-border/70 bg-background/22 px-4 py-3 text-sm text-muted-foreground">
            No rows were returned for the selected period.
          </div>
        ) : null}
      </div>
    </AgGridProvider>
  );
}
