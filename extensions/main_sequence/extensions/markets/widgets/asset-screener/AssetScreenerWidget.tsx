import { useCallback, useMemo } from "react";
import { Database } from "lucide-react";
import type { ISparklineCellRendererParams } from "ag-grid-community";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import { useWorkspaceVariableReferenceRegistry } from "@/dashboards/DashboardWidgetDependencies";
import {
  TableFrameView,
  type TableFrameColumnDefOverride,
  type TableWidgetCellValue,
  type TableWidgetColumnSchema,
  type TableWidgetFrameRow,
  type TableWidgetRow,
} from "@/widgets/core/table/TableFrameView";
import {
  applyTableWidgetFormulaColumnsToPublishedFrame,
  buildTableWidgetRowObjects,
  buildTableWidgetSourceVisualContractFromFrame,
  buildTableWidgetRowKey,
  normalizeTableWidgetSelectionState,
  resolveEffectivePublishedSelectionMode,
  resolveTableSelectionOutputsFromFrame,
  resolveTableWidgetPropsWithFrame,
  type ResolvedTableWidgetProps,
  type TableWidgetSelectionMode,
  withTableWidgetSelectionRuntimeState,
  type TableWidgetSelectionState,
  type TableWidgetProps,
  type TableWidgetResolvedFrameInput,
} from "@/widgets/core/table/tableModel";
import { proTableSharedOptions, withProTableDefaultProps } from "@/widgets/core/table/proTableOptions";
import { useOptionalTheme } from "@/themes/ThemeProvider";
import { mainSequenceSpaceTheme } from "@/themes/presets/main-sequence-space";
import { useIncrementalTabularConsumerBindingState } from "@/widgets/shared/incremental-tabular-consumer";
import { useRuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameFieldSchema, TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
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
  __assetKey?: string | null;
};
const assetScreenerSelectionKeyFields = ["__assetKey"] as const;

type AssetScreenerResolvedRowSelection = {
  assetKey: string;
  rowIndex: number;
  rowKey: string;
  rowObject: AssetScreenerTableRowObject;
};

function normalizeAssetScreenerSelectionMode(
  mode: TableWidgetSelectionMode,
): TableWidgetSelectionMode {
  return mode === "cell" ? "single-row" : mode;
}

function normalizeAssetScreenerSelectionStateMode(
  selection: TableWidgetSelectionState,
): TableWidgetSelectionState {
  const normalizedMode = normalizeAssetScreenerSelectionMode(selection.mode);

  return normalizedMode === selection.mode
    ? selection
    : {
        ...selection,
        mode: normalizedMode,
      };
}

function resolveAssetScreenerPublishedSelectionMode(
  props: Pick<ResolvedTableWidgetProps, "publishSelectionOutputs" | "selectionMode">,
  selection: TableWidgetSelectionState,
  referencedOutputIds?: Iterable<string>,
) {
  return normalizeAssetScreenerSelectionMode(
    resolveEffectivePublishedSelectionMode(props, selection, referencedOutputIds),
  );
}

function cloneJsonValue<T>(value: T): T {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function assetScreenerSelectionRowKey(row: Pick<AssetScreenerTableRowObject, "__assetKey">) {
  return buildTableWidgetRowKey(row as Record<string, unknown>, assetScreenerSelectionKeyFields);
}

function isAssetScreenerAssetRow(
  row: TableWidgetRow | undefined,
): row is AssetScreenerTableRowObject & { __assetKey: string } {
  return Boolean(
    row &&
      typeof row === "object" &&
      typeof (row as AssetScreenerTableRowObject).__assetKey === "string",
  );
}

function createAssetScreenerSelectionRowLookups(
  rowObjects: TableWidgetRow[],
) {
  const byIndex = new Map<number, AssetScreenerResolvedRowSelection>();
  const byRowKey = new Map<string, AssetScreenerResolvedRowSelection>();
  const byAssetKey = new Map<string, AssetScreenerResolvedRowSelection>();

  rowObjects.forEach((rowObject, rowIndex) => {
    if (!isAssetScreenerAssetRow(rowObject)) {
      return;
    }

    const rowKey = assetScreenerSelectionRowKey(rowObject);

    if (!rowKey) {
      return;
    }

    const resolved = {
      assetKey: rowObject.__assetKey,
      rowIndex,
      rowKey,
      rowObject,
    } satisfies AssetScreenerResolvedRowSelection;

    byIndex.set(rowIndex, resolved);
    byRowKey.set(rowKey, resolved);
    byAssetKey.set(resolved.assetKey, resolved);
  });

  return {
    byAssetKey,
    byIndex,
    byRowKey,
  };
}

function resolveAssetScreenerSelectionRow(
  selection: {
    rowIndex: number;
    rowKey?: string;
  },
  lookups: ReturnType<typeof createAssetScreenerSelectionRowLookups>,
) {
  if (selection.rowKey) {
    const byKey = lookups.byRowKey.get(selection.rowKey);

    if (byKey) {
      return byKey;
    }
  }

  return lookups.byIndex.get(selection.rowIndex) ?? null;
}

function uniqueAssetScreenerSelectionRows(
  rows: Array<AssetScreenerResolvedRowSelection | null | undefined>,
) {
  const seen = new Set<string>();
  const normalized: AssetScreenerResolvedRowSelection[] = [];

  rows.forEach((row) => {
    if (!row || seen.has(row.assetKey)) {
      return;
    }

    seen.add(row.assetKey);
    normalized.push(row);
  });

  return normalized;
}

function sanitizeAssetScreenerSelectionState(
  selection: TableWidgetSelectionState,
  rowObjects: TableWidgetRow[],
): TableWidgetSelectionState {
  const normalizedSelection = normalizeAssetScreenerSelectionStateMode(selection);
  const lookups = createAssetScreenerSelectionRowLookups(rowObjects);
  const selectedRows = uniqueAssetScreenerSelectionRows([
    ...normalizedSelection.selectedRowKeys.map((rowKey) =>
      resolveAssetScreenerSelectionRow({ rowKey, rowIndex: -1 }, lookups)
    ),
    ...normalizedSelection.selectedRowIndices.map((rowIndex) =>
      resolveAssetScreenerSelectionRow({ rowIndex }, lookups)
    ),
    ...normalizedSelection.selectedCells.map((cell) =>
      resolveAssetScreenerSelectionRow(cell, lookups)
    ),
  ]);
  const activeCellRow = normalizedSelection.activeCell
    ? resolveAssetScreenerSelectionRow(normalizedSelection.activeCell, lookups)
    : null;
  const activeRow =
    resolveAssetScreenerSelectionRow(
      {
        rowKey: normalizedSelection.activeRowKey,
        rowIndex: normalizedSelection.activeRowIndex ?? -1,
      },
      lookups,
    ) ??
    activeCellRow;
  const selectedRowsWithActive = activeRow
    ? uniqueAssetScreenerSelectionRows([...selectedRows, activeRow])
    : selectedRows;
  const selectedCells = normalizedSelection.selectedCells.flatMap((cell) => {
    const resolvedRow = resolveAssetScreenerSelectionRow(cell, lookups);

    if (!resolvedRow) {
      return [];
    }

    return [{
      ...cell,
      rowKey: resolvedRow.rowKey,
      rowIndex: resolvedRow.rowIndex,
      value: cell.value ?? resolvedRow.rowObject[cell.columnKey] ?? null,
    }];
  });

  return {
    ...normalizedSelection,
    selectedRowKeys: selectedRowsWithActive.map((row) => row.rowKey),
    selectedRowIndices: selectedRowsWithActive.map((row) => row.rowIndex),
    activeRowKey: activeRow?.rowKey,
    activeRowIndex: activeRow?.rowIndex,
    activeCell:
      normalizedSelection.activeCell && activeCellRow
        ? {
            ...normalizedSelection.activeCell,
            rowKey: activeCellRow.rowKey,
            rowIndex: activeCellRow.rowIndex,
            value:
              normalizedSelection.activeCell.value ??
              activeCellRow.rowObject[normalizedSelection.activeCell.columnKey] ??
              null,
          }
        : undefined,
    selectedCells,
  };
}

function normalizeAssetScreenerSelectionRuntimeState(
  runtimeState: unknown,
): unknown {
  const normalizedSelection = normalizeAssetScreenerSelectionStateMode(
    normalizeTableWidgetSelectionState(runtimeState),
  );

  return withTableWidgetSelectionRuntimeState(
    runtimeState as Record<string, unknown> | undefined,
    normalizedSelection,
  );
}

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

  if (format === "formula") {
    return "formula";
  }

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

export function buildAssetScreenerTableFrame({
  columns,
  rows,
  sourceFrame,
  sourceColumns,
}: {
  columns: MarketAssetScreenerColumn[];
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
      formulaExpression: format === "formula" ? sourceSchema?.formulaExpression : undefined,
      formulaResultFormat: format === "formula" ? sourceSchema?.formulaResultFormat : undefined,
      decimals: sourceSchema?.decimals,
      minWidth:
        column.width ??
        sourceSchema?.minWidth ??
        (column.kind === "asset-field" ? 120 : 96),
      pinned: sourceSchema?.pinned,
      categorical: sourceSchema?.categorical ?? (column.kind === "asset-field"),
      heatmapEligible:
        sourceSchema?.heatmapEligible ??
        (format === "number" ||
          format === "percent" ||
          format === "currency" ||
          format === "bps" ||
          format === "formula"),
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
    rowObjects,
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
  const normalizedTableSettings = withProTableDefaultProps(tableSettings);
  const densityOverride =
    normalizedTableSettings.density === "comfortable" || normalizedTableSettings.density === "compact"
      ? normalizedTableSettings.density
      : undefined;
  const pageSize =
    typeof normalizedTableSettings.pageSize === "number" && Number.isFinite(normalizedTableSettings.pageSize)
      ? Math.max(5, Math.min(Math.trunc(normalizedTableSettings.pageSize), 200))
      : 100;
  const resolved = resolveTableWidgetPropsWithFrame(
    {
      tableSourceMode: "bound",
      density: densityOverride ?? (density === "comfortable" ? "comfortable" : "compact"),
      groupBy:
        typeof normalizedTableSettings.groupBy === "string" && normalizedTableSettings.groupBy.trim()
          ? normalizedTableSettings.groupBy.trim()
          : undefined,
      showToolbar: false,
      showSearch: false,
      showColumnFilters: normalizedTableSettings.showColumnFilters !== false,
      zebraRows: normalizedTableSettings.zebraRows === true,
      pagination: false,
      pageSize,
      schema: Array.isArray(normalizedTableSettings.schema) ? normalizedTableSettings.schema : undefined,
      columnOverrides: normalizedTableSettings.columnOverrides,
      valueLabels: Array.isArray(normalizedTableSettings.valueLabels) ? normalizedTableSettings.valueLabels : [],
      conditionalRules: Array.isArray(normalizedTableSettings.conditionalRules) ? normalizedTableSettings.conditionalRules : [],
      formulasEnabled: normalizedTableSettings.formulasEnabled,
    },
    frame,
  );

  return {
    ...resolved,
    showToolbar: false,
    showSearch: false,
    showColumnFilters: normalizedTableSettings.showColumnFilters !== false,
    zebraRows: normalizedTableSettings.zebraRows === true,
    pagination: false,
    pageSize,
  };
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

export function buildAssetScreenerSparklineColumnDefOverrides({
  columns,
  rows,
  strokeColor,
}: {
  columns: MarketAssetScreenerColumn[];
  rows: MarketAssetScreenerRow[];
  strokeColor: string;
}) {
  const rowByAssetKey = new Map(rows.map((row) => [row.asset.assetKey, row]));
  const sparklineOptions = {
    axis: { visible: false },
    stroke: strokeColor,
    strokeWidth: 1.5,
    marker: { enabled: false },
    tooltip: { enabled: false },
    type: "line",
  } as NonNullable<ISparklineCellRendererParams["sparklineOptions"]>;

  return Object.fromEntries(
    columns.flatMap((column) => {
      if (column.kind !== "sparkline") {
        return [];
      }

      const columnDefOverride: TableFrameColumnDefOverride = {
        cellDataType: false,
        cellRenderer: "agSparklineCellRenderer",
        cellRendererParams: {
          sparklineOptions,
        },
        filter: false,
        sortable: false,
        suppressHeaderMenuButton: true,
        tooltipValueGetter: undefined,
        valueGetter: ({ data }) => {
          const assetKey =
            data && typeof data === "object" && typeof data.__assetKey === "string"
              ? data.__assetKey
              : undefined;
          const screenerRow = assetKey ? rowByAssetKey.get(assetKey) : undefined;

          if (!screenerRow) {
            return null;
          }

          const values = buildSparklineValues(screenerRow, column.valueField);
          return values.length >= 2 ? values : null;
        },
      };

      return [[column.id, columnDefOverride] as const];
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
  const variableRegistry = useWorkspaceVariableReferenceRegistry();
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
        rows: state.filteredRows,
        sourceFrame: state.sourceFrame,
        sourceColumns: state.sourceColumns,
      }),
    [state.columns, state.filteredRows, state.sourceColumns, state.sourceFrame],
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
  const resolvedRowObjects = useMemo(() => {
    const baseRows = buildTableWidgetRowObjects(
      resolvedTableProps.columns,
      resolvedTableProps.rows,
    );

    return baseRows.map<AssetScreenerTableRowObject>((row, index) => ({
      __assetKey:
        typeof tableFrame.rowObjects[index]?.__assetKey === "string"
          ? tableFrame.rowObjects[index]?.__assetKey
          : null,
      ...row,
    }));
  }, [resolvedTableProps.columns, resolvedTableProps.rows, tableFrame.rowObjects]);
  const selectionState = useMemo(
    () => normalizeAssetScreenerSelectionStateMode(
      normalizeTableWidgetSelectionState(runtimeState),
    ),
    [runtimeState],
  );
  const referencedOutputIds = useMemo(
    () =>
      new Set(
        !instanceId
          ? []
          : (variableRegistry?.bySourceWidgetId.get(instanceId) ?? []).flatMap((entry) =>
              entry?.key.sourceOutputId ? [entry.key.sourceOutputId] : [],
            ),
      ),
    [instanceId, variableRegistry],
  );
  const selectionOutputProps = useMemo(
    (): Pick<
      ResolvedTableWidgetProps,
      "publishSelectionOutputs" | "selectionMode"
    > => ({
      publishSelectionOutputs: normalizedProps.table?.publishSelectionOutputs !== false,
      selectionMode:
        normalizedProps.table?.selectionMode === "single-row" ||
        normalizedProps.table?.selectionMode === "multi-row" ||
        normalizedProps.table?.selectionMode === "cell"
          ? normalizeAssetScreenerSelectionMode(normalizedProps.table.selectionMode)
          : "none",
    }),
    [
      normalizedProps.table?.publishSelectionOutputs,
      normalizedProps.table?.selectionMode,
    ],
  );
  const effectiveSelectionMode = useMemo(
    () =>
      resolveAssetScreenerPublishedSelectionMode(
        selectionOutputProps,
        selectionState,
        referencedOutputIds,
      ),
    [referencedOutputIds, selectionOutputProps, selectionState],
  );

  const handleSelectionChange = useCallback(
    (selection: TableWidgetSelectionState) => {
      if (!onRuntimeStateChange) {
        return;
      }

      const sanitized = sanitizeAssetScreenerSelectionState(selection, resolvedRowObjects);
      const nextRuntimeState = withTableWidgetSelectionRuntimeState(
        runtimeState as Record<string, unknown> | undefined,
        {
          ...sanitized,
          implicitMode:
            selectionOutputProps.selectionMode === "none" &&
            effectiveSelectionMode !== "none",
        },
      );

      if (import.meta.env.DEV) {
        /*
        console.log("[asset-screener:runtime-state-publish]", {
          instanceId,
          effectiveSelectionMode,
          incomingSelection: selection,
          nextRuntimeState,
        });
        */
      }

      onRuntimeStateChange(nextRuntimeState);
    },
    [
      effectiveSelectionMode,
      onRuntimeStateChange,
      resolvedRowObjects,
      runtimeState,
      selectionOutputProps.selectionMode,
    ],
  );
  const selectionViewProps = useMemo(
    () =>
      effectiveSelectionMode === "none"
        ? {}
        : {
            selectionMode: effectiveSelectionMode,
            selectionState,
            onSelectionChange: handleSelectionChange,
          },
    [effectiveSelectionMode, handleSelectionChange, selectionState],
  );

  const sparklineColumnDefOverrides = useMemo(
    () =>
      buildAssetScreenerSparklineColumnDefOverrides({
        columns: state.columns,
        rows: state.filteredRows,
        strokeColor: resolvedTokens.primary,
      }),
    [resolvedTokens.primary, state.columns, state.filteredRows],
  );
  const sourceFrameStatus = state.sourceFrame?.status;
  const sourceFrameError =
    typeof state.sourceFrame?.error === "string" && state.sourceFrame.error.trim()
      ? state.sourceFrame.error.trim()
      : undefined;
  const awaitingSourceFrame =
    state.hasAnyBinding &&
    state.columns.length === 0 &&
    (
      sourceFrameStatus === "idle" ||
      sourceFrameStatus === "loading" ||
      state.sourceStatuses.seed === "valid" ||
      state.sourceStatuses.live === "valid"
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

  if (sourceFrameStatus === "error" && state.columns.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-none border border-dashed border-danger/35 bg-transparent p-6 text-center">
        <Database className="h-9 w-9 text-danger" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Source data failed to load</div>
          <div className="max-w-md text-xs text-muted-foreground">
            {sourceFrameError ?? "Run the source again or check the connection configuration."}
          </div>
        </div>
      </div>
    );
  }

  if (awaitingSourceFrame) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-none border border-dashed border-border/70 bg-transparent p-6 text-center">
        <Database className="h-9 w-9 text-muted-foreground" />
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Waiting for source data</div>
          <div className="max-w-md text-xs text-muted-foreground">
            Run the source connection or complete the upstream selection so the screener can infer
            its columns.
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
            The source returned data, but it did not describe which columns the screener should
            show. Add source column metadata or save a visible column override in screener
            settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col">
      <div className="min-h-0 flex-1">
        <TableFrameView
          columnDefOverrides={sparklineColumnDefOverrides}
          emptyMessage=""
          gridModules={proTableSharedOptions.gridModules}
          resolvedProps={resolvedTableProps}
          resolvedTokens={resolvedTokens}
          rowObjects={resolvedRowObjects}
          showColumnFilters={false}
          surface="transparent"
          tightness={tightness}
          {...selectionViewProps}
        />
      </div>
    </div>
  );
}

function inferAssetScreenerFieldType(value: unknown): TabularFrameFieldSchema["type"] {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "string") {
    return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) ? "datetime" : "string";
  }

  if (value === null || value === undefined) {
    return "unknown";
  }

  return Array.isArray(value) || typeof value === "object" ? "json" : "unknown";
}

function buildAssetScreenerPublicRow(
  row: MarketAssetScreenerRow,
  columns: MarketAssetScreenerColumn[],
) {
  const publicRow: Record<string, unknown> = {
    assetKey: row.asset.assetKey,
    unique_identifier: row.asset.assetKey,
  };

  [
    "symbol",
    "displayName",
    "exchange",
    "currency",
    "country",
    "assetClass",
    "sector",
    "industry",
    "group",
    "tags",
  ].forEach((key) => {
    const value = row.asset[key as keyof typeof row.asset];

    if (value !== undefined) {
      publicRow[key] = cloneJsonValue(value);
    }
  });

  Object.entries(row.metrics).forEach(([key, value]) => {
    if (!(key in publicRow)) {
      publicRow[key] = cloneJsonValue(value);
    }
  });

  columns.forEach((column) => {
    publicRow[column.id] = cloneJsonValue(tableValueForColumn(row, column));
  });

  return publicRow;
}

function buildAssetScreenerSelectedRowsOutputColumns(
  columns: MarketAssetScreenerColumn[],
  rows: Array<Record<string, unknown>>,
) {
  const ordered = new Set<string>([
    ...columns.map((column) => column.id),
    "assetKey",
    "unique_identifier",
    "symbol",
    "displayName",
    "exchange",
    "currency",
    "country",
    "assetClass",
    "sector",
    "industry",
    "group",
    "tags",
  ]);

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      ordered.add(key);
    });
  });

  return Array.from(ordered).filter((key) =>
    rows.some((row) => row[key] !== undefined),
  );
}

function buildAssetScreenerSelectedRowsOutputFields(
  columns: string[],
  rows: Array<Record<string, unknown>>,
): TabularFrameFieldSchema[] | undefined {
  if (columns.length === 0) {
    return undefined;
  }

  return columns.map((column) => {
    const sample = rows.find((row) => row[column] !== undefined)?.[column];

    return {
      key: column,
      label: column,
      provenance: "derived",
      type: inferAssetScreenerFieldType(sample),
    } satisfies TabularFrameFieldSchema;
  });
}

function buildAssetScreenerPublicRows(
  rows: MarketAssetScreenerRow[],
  columns: MarketAssetScreenerColumn[],
) {
  return rows.map((row) => buildAssetScreenerPublicRow(row, columns));
}

function buildAssetScreenerPublicFrame(
  rows: MarketAssetScreenerRow[],
  columns: MarketAssetScreenerColumn[],
  sourceFrame?: TabularFrameSourceV1 | null,
  tableSettings?: Partial<TableWidgetProps>,
): TabularFrameSourceV1 {
  const publicRows = buildAssetScreenerPublicRows(rows, columns);
  const publicColumns = buildAssetScreenerSelectedRowsOutputColumns(columns, publicRows);
  const publicFrame = {
    status: sourceFrame?.status === "error"
      ? "error"
      : sourceFrame?.status === "loading"
        ? "loading"
        : "ready",
    columns: publicColumns,
    rows: publicRows,
    fields: buildAssetScreenerSelectedRowsOutputFields(publicColumns, publicRows),
    source: {
      kind: "asset-screener-public-rows",
      label: "Asset screener rows",
      context: {
        uniqueIdentifierList: ["assetKey"],
      },
    },
  } satisfies TabularFrameSourceV1;

  return applyTableWidgetFormulaColumnsToPublishedFrame(
    withProTableDefaultProps(tableSettings),
    publicFrame,
  );
}

type AssetScreenerOutputContext = {
  columns: MarketAssetScreenerColumn[];
  effectiveSelectionMode: TableWidgetSelectionMode;
  normalizedRuntimeState: unknown;
  publicFrame: TabularFrameSourceV1;
  sourceFrame?: TabularFrameSourceV1 | null;
};

function buildAssetScreenerOutputContext({
  props,
  resolvedInputs,
  runtimeState,
  runtimeDataStore,
}: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}): AssetScreenerOutputContext {
  const normalizedProps = normalizeAssetScreenerProps(props);
  const state = resolveAssetScreenerState({
    props: normalizedProps,
    resolvedInputs,
    runtimeDataStore: runtimeDataStore as never,
    fallbackFrames: isAssetScreenerDemoRuntimeState(runtimeState)
      ? runtimeState.marketAssetScreenerDemoFrames
      : undefined,
  });
  const tableFrame = buildAssetScreenerTableFrame({
    columns: state.columns,
    rows: state.filteredRows,
    sourceFrame: state.sourceFrame,
    sourceColumns: state.sourceColumns,
  });
  const selection = normalizeAssetScreenerSelectionStateMode(
    normalizeTableWidgetSelectionState(runtimeState),
  );
  const publicFrame = buildAssetScreenerPublicFrame(
    state.filteredRows,
    state.columns,
    state.sourceFrame,
    normalizedProps.table,
  );
  const normalizedRuntimeState = normalizeAssetScreenerSelectionRuntimeState(runtimeState);
  const selectionOutputProps: Pick<
    ResolvedTableWidgetProps,
    "publishSelectionOutputs" | "selectionMode" | "selectionKeyFields" | "uniqueIdentifierList"
  > = {
    publishSelectionOutputs: normalizedProps.table?.publishSelectionOutputs !== false,
    selectionMode:
      normalizedProps.table?.selectionMode === "single-row" ||
      normalizedProps.table?.selectionMode === "multi-row" ||
      normalizedProps.table?.selectionMode === "cell"
        ? normalizeAssetScreenerSelectionMode(normalizedProps.table.selectionMode)
        : "none",
    selectionKeyFields: ["assetKey"],
    uniqueIdentifierList: ["assetKey"],
  };

  return {
    columns: state.columns,
    effectiveSelectionMode: resolveAssetScreenerPublishedSelectionMode(
      selectionOutputProps,
      selection,
    ),
    normalizedRuntimeState,
    publicFrame,
    sourceFrame: state.sourceFrame,
  };
}

export function resolveAssetScreenerSelectedRowsOutput({
  props,
  resolvedInputs,
  runtimeState,
  runtimeDataStore,
}: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}): TabularFrameSourceV1 {
  const context = buildAssetScreenerOutputContext({
    props,
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  });
  const { selectedRows } = resolveTableSelectionOutputsFromFrame(
    context.publicFrame,
    {
      publishSelectionOutputs: true,
      selectionMode: context.effectiveSelectionMode,
      selectionKeyFields: ["assetKey"],
      uniqueIdentifierList: ["assetKey"],
    },
    context.normalizedRuntimeState,
  );
  const columns = buildAssetScreenerSelectedRowsOutputColumns(context.columns, selectedRows);

  return {
    status: context.sourceFrame?.status === "error"
      ? "error"
      : context.sourceFrame?.status === "loading"
        ? "loading"
        : "ready",
    columns,
    rows: selectedRows,
    fields: buildAssetScreenerSelectedRowsOutputFields(columns, selectedRows),
    source: {
      kind: "asset-screener-selection",
      label: "Selected screener rows",
      context: {
        selectedRowCount: selectedRows.length,
      },
    },
  };
}

export function resolveAssetScreenerActiveRowOutput(input: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}) {
  const context = buildAssetScreenerOutputContext(input);
  return resolveTableSelectionOutputsFromFrame(
    context.publicFrame,
    {
      publishSelectionOutputs: true,
      selectionMode: context.effectiveSelectionMode,
      selectionKeyFields: ["assetKey"],
      uniqueIdentifierList: ["assetKey"],
    },
    context.normalizedRuntimeState,
  ).activeRow;
}

export function resolveAssetScreenerActiveCellOutput(input: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}) {
  const context = buildAssetScreenerOutputContext(input);
  return resolveTableSelectionOutputsFromFrame(
    context.publicFrame,
    {
      publishSelectionOutputs: true,
      selectionMode: context.effectiveSelectionMode,
      selectionKeyFields: ["assetKey"],
      uniqueIdentifierList: ["assetKey"],
    },
    context.normalizedRuntimeState,
  ).activeCell;
}

export function resolveAssetScreenerActiveCellValueOutput(input: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}) {
  const context = buildAssetScreenerOutputContext(input);
  const resolved = resolveTableSelectionOutputsFromFrame(
    context.publicFrame,
    {
      publishSelectionOutputs: true,
      selectionMode: context.effectiveSelectionMode,
      selectionKeyFields: ["assetKey"],
      uniqueIdentifierList: ["assetKey"],
    },
    context.normalizedRuntimeState,
  );

  return resolved.activeCellValue;
}

export function resolveAssetScreenerSelectedCellValuesOutput(input: {
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs: ResolvedWidgetInputs | undefined;
  runtimeState?: unknown;
  runtimeDataStore?: unknown;
}) {
  const context = buildAssetScreenerOutputContext(input);
  return resolveTableSelectionOutputsFromFrame(
    context.publicFrame,
    {
      publishSelectionOutputs: true,
      selectionMode: context.effectiveSelectionMode,
      selectionKeyFields: ["assetKey"],
      uniqueIdentifierList: ["assetKey"],
    },
    context.normalizedRuntimeState,
  ).selectedCellValues;
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
