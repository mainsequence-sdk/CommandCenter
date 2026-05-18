import { useMemo } from "react";
import { Database } from "lucide-react";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import {
  TableFrameView,
  type ResolvedTableWidgetProps,
  type TableFrameCustomCellRenderer,
  type TableWidgetCellValue,
  type TableWidgetColumnSchema,
  type TableWidgetFrameRow,
  type TableWidgetRow,
} from "@/widgets/core/table/TableFrameView";
import {
  buildTableWidgetSourceVisualContractFromFrame,
  resolveTableWidgetPropsWithFrame,
  type TableWidgetProps,
  type TableWidgetResolvedFrameInput,
} from "@/widgets/core/table/tableModel";
import { useOptionalTheme } from "@/themes/ThemeProvider";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInput, ResolvedWidgetInputs, WidgetComponentProps } from "@/widgets/types";

import {
  normalizeAssetScreenerProps,
  resolveAssetScreenerState,
  type MainSequenceAssetScreenerDensity,
  type MainSequenceAssetScreenerWidgetProps,
} from "./assetScreenerModel";
import type {
  MarketAssetScreenerColumn,
  MarketAssetScreenerRow,
  MarketAssetScalarValue,
  MarketAssetValuePoint,
  MarketTableVisualColumnMetadata,
} from "../../widget-contracts/marketAssetFrames";
import {
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
} from "../../widget-contracts/marketAssetFrames";

type Props = WidgetComponentProps<MainSequenceAssetScreenerWidgetProps>;
type AssetScreenerTableRowObject = TableWidgetRow & {
  __assetKey?: string;
  __groupCount?: number;
  __groupHeader?: boolean;
  __groupLabel?: string;
};
const assetScreenerBlankCellValue = " ";

function firstResolvedInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const input = resolvedInputs?.[inputId];
  return Array.isArray(input) ? input.find((entry) => entry.status === "valid") ?? input[0] : input;
}

function isIdleFrame(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "status" in value &&
      (value as { status?: unknown }).status === "idle",
  );
}

function inputRequiresPassiveUpstreamResolution(input: ResolvedWidgetInput | undefined) {
  if (!input || input.status !== "valid" || !input.sourceWidgetId) {
    return false;
  }

  const hasPublishedValue =
    input.upstreamBase !== undefined ||
    input.upstreamBaseRef !== undefined ||
    input.value !== undefined ||
    input.valueRef !== undefined ||
    input.upstreamDelta !== undefined ||
    input.upstreamDeltaRef !== undefined;

  if (!hasPublishedValue) {
    return true;
  }

  return isIdleFrame(input.upstreamBase) || isIdleFrame(input.value) || isIdleFrame(input.upstreamDelta);
}

function assetScreenerRequiresUpstreamResolution(
  resolvedInputs: ResolvedWidgetInputs | undefined,
) {
  return inputRequiresPassiveUpstreamResolution(
    firstResolvedInput(resolvedInputs, MARKET_ASSET_SCREENER_SEED_INPUT_ID),
  ) || inputRequiresPassiveUpstreamResolution(
    firstResolvedInput(resolvedInputs, MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID),
  );
}

function normalizeTableCellValue(value: MarketAssetScalarValue | undefined): TableWidgetCellValue {
  if (value === undefined) {
    return null;
  }

  return value;
}

function normalizeFieldMatch(value: string | undefined) {
  return value ? value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
}

function derivedSourceFieldIdsForReturnColumn(
  column: Extract<MarketAssetScreenerColumn, { kind: "return" }>,
) {
  if (column.returnMode !== "percent") {
    return [];
  }

  if (column.valueField !== "price") {
    return [];
  }

  if (column.referenceKey === "previousClose") {
    return ["oneDayReturn", "one_day_return"];
  }

  if (column.referenceKey === "oneMonthAgo") {
    return ["oneMonthReturn", "one_month_return"];
  }

  if (column.referenceKey === "yearStart") {
    return ["ytdReturn", "ytd_return"];
  }

  if (column.referenceKey === "oneYearAgo") {
    return ["oneYearReturn", "one_year_return"];
  }

  return [];
}

function areSemanticallyEquivalentColumns(
  left: MarketAssetScreenerColumn,
  right: MarketAssetScreenerColumn,
) {
  if (left.kind === "asset-field" && right.kind === "asset-field") {
    return String(left.field) === String(right.field);
  }

  if (left.kind === "sparkline" && right.kind === "sparkline") {
    return left.valueField === right.valueField && left.historyKey === right.historyKey;
  }

  if (left.kind === "latest-value" && right.kind === "latest-value") {
    return left.valueField === right.valueField;
  }

  if (left.kind === "reference-value" && right.kind === "reference-value") {
    return left.valueField === right.valueField && left.referenceKey === right.referenceKey;
  }

  if (left.kind === "return" && right.kind === "return") {
    return left.valueField === right.valueField &&
      left.referenceKey === right.referenceKey &&
      left.returnMode === right.returnMode;
  }

  if (left.kind === "latest-value" && right.kind === "return") {
    const derivedKeys = derivedSourceFieldIdsForReturnColumn(right).map(normalizeFieldMatch);
    return derivedKeys.includes(normalizeFieldMatch(left.valueField)) ||
      derivedKeys.includes(normalizeFieldMatch(left.id));
  }

  if (left.kind === "return" && right.kind === "latest-value") {
    const derivedKeys = derivedSourceFieldIdsForReturnColumn(left).map(normalizeFieldMatch);
    return derivedKeys.includes(normalizeFieldMatch(right.valueField)) ||
      derivedKeys.includes(normalizeFieldMatch(right.id));
  }

  return false;
}

function resolveSourceColumnAlias(
  sourceColumns: MarketAssetScreenerColumn[] | undefined,
  column: MarketAssetScreenerColumn,
) {
  const directMatch = sourceColumns?.find((candidate) => candidate.id === column.id);

  if (directMatch) {
    return directMatch.id;
  }

  const sourceColumn = sourceColumns?.find((candidate) =>
    areSemanticallyEquivalentColumns(candidate, column)
  );

  return sourceColumn?.id;
}

function tableFormatForColumn(
  column: MarketAssetScreenerColumn,
  visual: MarketTableVisualColumnMetadata | undefined,
): TableWidgetColumnSchema["format"] {
  const format = ("format" in column ? column.format : undefined) ?? visual?.format;

  if (format === "percent") {
    return "percent";
  }

  if (format === "volume") {
    return "number";
  }

  if (format === "number" || format === "price" || format === "currency") {
    return "number";
  }

  return column.kind === "asset-field" || column.kind === "sparkline" ? "text" : "number";
}

function tableValueForColumn(
  row: MarketAssetScreenerRow,
  column: MarketAssetScreenerColumn,
): TableWidgetCellValue {
  if (column.kind === "sparkline") {
    return row.asset.assetKey;
  }

  return normalizeTableCellValue(row.metrics[column.id]);
}

function isAssetScreenerGroupHeaderRow(
  row: TableWidgetRow | undefined,
): row is AssetScreenerTableRowObject {
  return Boolean(
    row &&
      typeof row === "object" &&
      (row as AssetScreenerTableRowObject).__groupHeader === true,
  );
}

function resolveAssetScreenerGroupValue(
  row: MarketAssetScreenerRow,
  groupBy: string | undefined,
) {
  if (!groupBy) {
    return undefined;
  }

  const value = row.asset[groupBy as keyof typeof row.asset];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const firstValue = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof firstValue === "string" ? firstValue.trim() : undefined;
  }

  return undefined;
}

function buildGroupedRowObjects({
  columnIds,
  groupBy,
  rowObjects,
  rows,
}: {
  columnIds: string[];
  groupBy: string | undefined;
  rowObjects: AssetScreenerTableRowObject[];
  rows: MarketAssetScreenerRow[];
}) {
  const firstColumnId = columnIds[0];

  if (!groupBy || !firstColumnId || rowObjects.length === 0) {
    return rowObjects;
  }

  const buckets = new Map<string, AssetScreenerTableRowObject[]>();
  const orderedGroups: string[] = [];

  rows.forEach((row, rowIndex) => {
    const rowObject = rowObjects[rowIndex];

    if (!rowObject) {
      return;
    }

    const groupValue = resolveAssetScreenerGroupValue(row, groupBy) ?? "Ungrouped";
    const groupRows = buckets.get(groupValue);

    if (groupRows) {
      groupRows.push(rowObject);
      return;
    }

    orderedGroups.push(groupValue);
    buckets.set(groupValue, [rowObject]);
  });

  return orderedGroups.flatMap((groupValue) => {
    const groupRows = buckets.get(groupValue) ?? [];

    return [
      {
        __groupCount: groupRows.length,
        __groupHeader: true,
        __groupLabel: groupValue,
        ...Object.fromEntries(
          columnIds.map((columnId, columnIndex) => [
            columnId,
            columnIndex === 0 ? groupValue : assetScreenerBlankCellValue,
          ]),
        ),
      } satisfies AssetScreenerTableRowObject,
      ...groupRows,
    ];
  });
}

export function buildAssetScreenerTableFrame({
  columns,
  groupBy,
  rows,
  sourceFrame,
  sourceColumns,
}: {
  columns: MarketAssetScreenerColumn[];
  groupBy?: string;
  rows: MarketAssetScreenerRow[];
  sourceFrame?: TabularFrameSourceV1 | null;
  sourceColumns?: MarketAssetScreenerColumn[];
}): {
  frame: TableWidgetResolvedFrameInput;
  rowObjects: TableWidgetRow[];
} {
  const columnIds = columns.map((column) => column.id);
  const sourceVisualContract = buildTableWidgetSourceVisualContractFromFrame(sourceFrame);
  const sourceSchemaByKey = new Map(
    (sourceVisualContract?.schemaFallback ?? []).map((entry) => [entry.key, entry] as const),
  );
  const sourceColumnOverrides = sourceVisualContract?.sourceColumnOverrides ?? {};
  const sourceConditionalRules = sourceVisualContract?.sourceConditionalRules ?? [];
  const sourceAliasByColumnId = new Map(
    columns.map((column) => [column.id, resolveSourceColumnAlias(sourceColumns, column)] as const),
  );
  const schemaFallback = columns.map<TableWidgetColumnSchema>((column) => {
    const sourceAlias = sourceAliasByColumnId.get(column.id);
    const sourceSchema = sourceAlias ? sourceSchemaByKey.get(sourceAlias) : undefined;
    const format = sourceSchema?.format ?? tableFormatForColumn(column, undefined);

    return {
      key: column.id,
      label: column.label,
      description: sourceSchema?.description,
      format,
      decimals: sourceSchema?.decimals,
      minWidth:
        column.width ??
        sourceSchema?.minWidth ??
        (column.kind === "asset-field" ? 120 : 96),
      pinned: sourceSchema?.pinned,
      categorical: sourceSchema?.categorical ?? (column.kind === "asset-field"),
      heatmapEligible:
        sourceSchema?.heatmapEligible ??
        (format === "number" || format === "percent" || format === "currency" || format === "bps"),
      compact: sourceSchema?.compact,
    };
  });
  const frameRows = rows.map((row) =>
    columns.map((column) => tableValueForColumn(row, column)),
  );
  const rowObjects = rows.map<AssetScreenerTableRowObject>((row, rowIndex) => ({
    __assetKey: row.asset.assetKey,
    ...Object.fromEntries(
      columns.map((column, columnIndex) => [column.id, frameRows[rowIndex]?.[columnIndex] ?? null]),
    ),
  }));
  const aliasedSourceColumnOverrides = Object.fromEntries(
    columns.flatMap((column) => {
      const sourceAlias = sourceAliasByColumnId.get(column.id);
      const sourceOverride = sourceAlias ? sourceColumnOverrides[sourceAlias] : undefined;
      const alignOverride =
        column.kind === "asset-field" || column.kind === "sparkline"
          ? { align: "left" as const }
          : undefined;
      const combinedOverride = sourceOverride || alignOverride
        ? {
            ...(sourceOverride ?? {}),
            ...(alignOverride ?? {}),
          }
        : undefined;

      return combinedOverride ? [[column.id, combinedOverride] as const] : [];
    }),
  );
  const aliasedSourceConditionalRules = columns.flatMap((column) => {
    const sourceAlias = sourceAliasByColumnId.get(column.id);

    if (!sourceAlias) {
      return [];
    }

    return sourceConditionalRules
      .filter((rule) => rule.columnKey === sourceAlias)
      .map((rule) => ({
        ...rule,
        columnKey: column.id,
        id: `${column.id}:${rule.id}`,
      }));
  });

  return {
    frame: {
      columns: columnIds,
      rows: frameRows,
      schemaFallback,
      sourceColumnOverrides:
        Object.keys(aliasedSourceColumnOverrides).length > 0 ? aliasedSourceColumnOverrides : undefined,
      sourceConditionalRules:
        aliasedSourceConditionalRules.length > 0 ? aliasedSourceConditionalRules : undefined,
      sourceLabel: "Market asset screener",
    },
    rowObjects: buildGroupedRowObjects({
      columnIds,
      groupBy,
      rowObjects,
      rows,
    }),
  };
}

export function buildAssetScreenerResolvedTableProps({
  density,
  frame,
  tableSettings,
}: {
  density: MainSequenceAssetScreenerDensity | undefined;
  frame: TableWidgetResolvedFrameInput;
  tableSettings?: Partial<TableWidgetProps>;
}): ResolvedTableWidgetProps {
  const densityOverride =
    tableSettings?.density === "comfortable" || tableSettings?.density === "compact"
      ? tableSettings.density
      : undefined;
  const pageSize =
    typeof tableSettings?.pageSize === "number" && Number.isFinite(tableSettings.pageSize)
      ? Math.max(5, Math.min(Math.trunc(tableSettings.pageSize), 200))
      : 100;
  const resolved = resolveTableWidgetPropsWithFrame(
    {
      tableSourceMode: "bound",
      density: densityOverride ?? (density === "comfortable" ? "comfortable" : "compact"),
      showToolbar: false,
      showSearch: false,
      showColumnFilters: tableSettings?.showColumnFilters !== false,
      zebraRows: tableSettings?.zebraRows === true,
      pagination: false,
      pageSize,
      schema: Array.isArray(tableSettings?.schema) ? tableSettings.schema : undefined,
      columnOverrides: tableSettings?.columnOverrides,
      valueLabels: Array.isArray(tableSettings?.valueLabels) ? tableSettings.valueLabels : [],
      conditionalRules: Array.isArray(tableSettings?.conditionalRules) ? tableSettings.conditionalRules : [],
    },
    frame,
  );

  return {
    ...resolved,
    showToolbar: false,
    showSearch: false,
    showColumnFilters: tableSettings?.showColumnFilters !== false,
    zebraRows: tableSettings?.zebraRows === true,
    pagination: false,
    pageSize,
  };
}

function getSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xStep = values.length > 1 ? width / (values.length - 1) : width;

  return values.map((value, index) => {
    const x = index * xStep;
    const y = min === max ? height / 2 : height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function pointSortValue(point: MarketAssetValuePoint) {
  if (typeof point.observedAtMs === "number") {
    return point.observedAtMs;
  }

  if (typeof point.sequence === "number") {
    return point.sequence;
  }

  return 0;
}

export function buildSparklineValues(row: MarketAssetScreenerRow, valueField: string) {
  const referencePoints = Object.values(row.references).filter(
    (point): point is NonNullable<typeof point> => Boolean(point),
  );
  const explicitHistory = row.history.length > 0 ? row.history : [];
  const latestPoints: MarketAssetValuePoint[] = row.latest ? [row.latest] : [];
  const sourcePoints: MarketAssetValuePoint[] = explicitHistory.length >= 2
    ? explicitHistory
    : [...referencePoints, ...explicitHistory, ...latestPoints];
  const seen = new Set<string>();

  return sourcePoints
    .filter((point) => {
      const value = point.values[valueField];

      return typeof value === "number" && Number.isFinite(value);
    })
    .sort((left, right) =>
      pointSortValue(left) - pointSortValue(right),
    )
    .filter((point) => {
      const key = [
        point.assetKey,
        point.observedAtMs ?? "",
        point.sequence ?? "",
        point.values[valueField],
      ].join(":");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((point) => point.values[valueField])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function Sparkline({
  row,
  valueField,
}: {
  row: MarketAssetScreenerRow;
  valueField: string;
}) {
  const values = buildSparklineValues(row, valueField);
  const path = getSparklinePath(values, 84, 22);

  if (!path || values.length < 2) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-24 overflow-visible"
      viewBox="0 0 84 22"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function buildSparklineCellRenderers({
  columns,
  firstColumnId,
  rows,
}: {
  columns: MarketAssetScreenerColumn[];
  firstColumnId: string | undefined;
  rows: MarketAssetScreenerRow[];
}) {
  const rowByAssetKey = new Map(rows.map((row) => [row.asset.assetKey, row]));

  return Object.fromEntries(
    columns.flatMap((column) => {
      if (column.kind !== "sparkline" && column.id !== firstColumnId) {
        return [];
      }

      const renderer: TableFrameCustomCellRenderer = ({ row, value }) => {
        if (isAssetScreenerGroupHeaderRow(row)) {
          if (column.id !== firstColumnId) {
            return <span aria-hidden="true">{assetScreenerBlankCellValue}</span>;
          }

          return (
            <div className="flex h-full w-full items-center overflow-hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="truncate">{row.__groupLabel ?? String(value ?? "")}</span>
              {typeof row.__groupCount === "number" ? (
                <span className="ml-2 shrink-0 text-[9px] text-muted-foreground/80">
                  {row.__groupCount}
                </span>
              ) : null}
            </div>
          );
        }

        if (column.kind !== "sparkline") {
          return undefined;
        }

        const screenerRow = typeof value === "string" ? rowByAssetKey.get(value) : undefined;

        if (!screenerRow) {
          return <span className="text-muted-foreground">—</span>;
        }

        return (
          <div className="flex h-full w-full items-center overflow-hidden text-primary">
            <Sparkline row={screenerRow} valueField={column.valueField} />
          </div>
        );
      };

      return [[column.id, renderer] as const];
    }),
  );
}

export function AssetScreenerWidget({
  instanceId,
  onRuntimeStateChange,
  props,
  resolvedInputs,
  runtimeState,
  runtimeDataStore,
}: Props) {
  const normalizedProps = normalizeAssetScreenerProps(props);
  const theme = useOptionalTheme();
  const resolvedTokens = theme?.resolvedTokens ?? mainSequenceSpaceTheme.tokens;
  const tightness = theme?.tightness ?? mainSequenceSpaceTheme.tightness;
  const contextRuntimeDataStore = useRuntimeDataStore();
  const activeRuntimeDataStore = runtimeDataStore ?? contextRuntimeDataStore;
  const incrementalBinding = useIncrementalTabularConsumerBindingState({
    instanceId,
    onRuntimeStateChange,
    resolvedInputs,
    runtimeState,
  });

  useResolveWidgetUpstream(instanceId, {
    enabled:
      incrementalBinding.active
        ? incrementalBinding.requiresUpstreamResolution
        : assetScreenerRequiresUpstreamResolution(resolvedInputs),
  });

  const state = useMemo(
    () =>
      resolveAssetScreenerState({
        canonicalSourceFrame:
          incrementalBinding.active ? incrementalBinding.consumerState.dataset : undefined,
        props: normalizedProps,
        resolvedInputs,
        runtimeDataStore: activeRuntimeDataStore,
        fallbackFrames: isAssetScreenerDemoRuntimeState(runtimeState)
          ? runtimeState.marketAssetScreenerDemoFrames
          : undefined,
      }),
    [
      activeRuntimeDataStore,
      incrementalBinding.active,
      incrementalBinding.consumerState.dataset,
      normalizedProps,
      resolvedInputs,
      runtimeState,
    ],
  );
  const tableFrame = useMemo(
    () =>
      buildAssetScreenerTableFrame({
        columns: state.columns,
        groupBy: normalizedProps.groupBy,
        rows: state.filteredRows,
        sourceFrame: state.sourceFrame,
        sourceColumns: state.sourceColumns,
      }),
    [normalizedProps.groupBy, state.columns, state.filteredRows, state.sourceColumns, state.sourceFrame],
  );
  const resolvedTableProps = useMemo(
    () =>
      buildAssetScreenerResolvedTableProps({
        density: normalizedProps.density,
        frame: tableFrame.frame,
        tableSettings: normalizedProps.table,
      }),
    [normalizedProps.density, normalizedProps.table, tableFrame.frame],
  );
  const customCellRenderers = useMemo(
    () =>
      buildSparklineCellRenderers({
        columns: state.columns,
        firstColumnId: tableFrame.frame.columns[0],
        rows: state.filteredRows,
      }),
    [state.columns, state.filteredRows, tableFrame.frame.columns],
  );

  if (!state.hasAnyBinding && state.rows.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-none border border-dashed border-border/70 bg-transparent p-6 text-center">
        <Database className="h-9 w-9 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Bind market asset data</div>
          <div className="max-w-md text-xs text-muted-foreground">
            Connect the full semantic market snapshot to seedData and optional live price or quote
            updates to liveUpdates.
          </div>
        </div>
      </div>
    );
  }

  if (state.columns.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-none border border-dashed border-border/70 bg-transparent p-6 text-center">
        <Database className="h-9 w-9 text-muted-foreground" />
        <div className="space-y-1">
          <div className="max-w-md text-xs text-muted-foreground">
            No source columns are available yet. Publish `meta.tableVisuals.columns`, market field
            roles, or save instance override columns in settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col">
      <div className="min-h-0 flex-1">
        <TableFrameView
          customCellRenderers={customCellRenderers}
          emptyMessage=""
          getRowStyle={(row) =>
            isAssetScreenerGroupHeaderRow(row)
              ? {
                  backgroundColor: "rgba(148, 163, 184, 0.08)",
                  fontWeight: 600,
                }
              : undefined
          }
          resolvedProps={resolvedTableProps}
          resolvedTokens={resolvedTokens}
          rowObjects={tableFrame.rowObjects}
          showColumnFilters={false}
          surface="transparent"
          tightness={tightness}
        />
      </div>
    </div>
  );
}

function isAssetScreenerDemoRuntimeState(
  value: unknown,
): value is {
  marketAssetScreenerDemoFrames: NonNullable<
    Parameters<typeof resolveAssetScreenerState>[0]["fallbackFrames"]
  >;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "marketAssetScreenerDemoFrames" in value,
  );
}
