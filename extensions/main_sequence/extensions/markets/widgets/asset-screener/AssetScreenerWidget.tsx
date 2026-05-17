import { useMemo } from "react";
import { AlertTriangle, Database } from "lucide-react";

import { useResolveWidgetUpstream } from "@/dashboards/DashboardWidgetExecution";
import {
  TableFrameView,
  type ResolvedTableWidgetProps,
  type TableFrameCustomCellRenderer,
  type TableWidgetCellValue,
  type TableWidgetColumnOverride,
  type TableWidgetColumnSchema,
  type TableWidgetConditionalRule,
  type TableWidgetFrameRow,
  type TableWidgetRow,
  type TableWidgetTone,
} from "@/widgets/core/table/TableFrameView";
import type { TableWidgetProps } from "@/widgets/core/table/tableModel";
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

interface AssetScreenerTableFrame {
  columns: string[];
  rows: TableWidgetFrameRow[];
  schemaFallback: TableWidgetColumnSchema[];
  sourceLabel?: string;
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

function getColumnVisual(row: MarketAssetScreenerRow, column: MarketAssetScreenerColumn) {
  if (column.kind === "asset-field") {
    return column.visual ?? row.visuals[column.id] ?? row.visuals[String(column.field)];
  }

  if (column.kind === "sparkline") {
    return column.visual ?? row.visuals[column.id] ?? row.visuals[column.valueField];
  }

  return column.visual ?? row.visuals[column.id] ?? row.visuals[column.valueField];
}

function getSourceColumnVisual(
  rows: MarketAssetScreenerRow[],
  column: MarketAssetScreenerColumn,
) {
  return column.visual ?? rows.map((row) => getColumnVisual(row, column)).find(Boolean);
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

function isTableColumnSchema(value: unknown): value is TableWidgetColumnSchema {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { key?: unknown }).key === "string" &&
      typeof (value as { label?: unknown }).label === "string",
  );
}

function resolveTableSchemaWithInstanceSettings(
  schemaFallback: TableWidgetColumnSchema[],
  tableSettings: Partial<TableWidgetProps> | undefined,
) {
  if (!Array.isArray(tableSettings?.schema)) {
    return schemaFallback;
  }

  const savedSchemaByKey = new Map(
    tableSettings.schema
      .filter(isTableColumnSchema)
      .map((column) => [column.key, column] as const),
  );

  return schemaFallback.map((column) => {
    const savedColumn = savedSchemaByKey.get(column.key);

    return savedColumn
      ? {
          ...column,
          ...savedColumn,
          key: column.key,
        }
      : column;
  });
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

function tableToneForMarketTone(tone: string | undefined): TableWidgetTone | undefined {
  if (
    tone === "neutral" ||
    tone === "primary" ||
    tone === "success" ||
    tone === "warning" ||
    tone === "danger"
  ) {
    return tone;
  }

  if (tone === "muted") {
    return "neutral";
  }

  return undefined;
}

function buildLegacyColorScaleRules(
  columnId: string,
  visual: MarketTableVisualColumnMetadata | undefined,
) {
  const colorScale = visual?.colorScale;

  if (!colorScale) {
    return [];
  }

  const rules: TableWidgetConditionalRule[] = [];
  const negativeTone = tableToneForMarketTone(colorScale.negative);
  const neutralTone = tableToneForMarketTone(colorScale.neutral);
  const positiveTone = tableToneForMarketTone(colorScale.positive);

  if (negativeTone) {
    rules.push({
      id: `${columnId}:negative`,
      columnKey: columnId,
      operator: "lt",
      value: 0,
      tone: negativeTone,
    });
  }

  if (neutralTone) {
    rules.push({
      id: `${columnId}:neutral`,
      columnKey: columnId,
      operator: "eq",
      value: 0,
      tone: neutralTone,
    });
  }

  if (positiveTone) {
    rules.push({
      id: `${columnId}:positive`,
      columnKey: columnId,
      operator: "gt",
      value: 0,
      tone: positiveTone,
    });
  }

  return rules;
}

function buildTableThresholdRules(
  columnId: string,
  visual: MarketTableVisualColumnMetadata | undefined,
) {
  if (!visual?.thresholds?.length) {
    return [];
  }

  return visual.thresholds.map<TableWidgetConditionalRule>((rule, index) => ({
    backgroundColor: rule.backgroundColor,
    columnKey: columnId,
    id: rule.id ?? `${columnId}:threshold:${index}`,
    operator: rule.operator,
    textColor: rule.textColor,
    tone: rule.tone,
    value: rule.value,
  }));
}

function buildColumnOverride(
  column: MarketAssetScreenerColumn,
  visual: MarketTableVisualColumnMetadata | undefined,
): TableWidgetColumnOverride {
  const override: TableWidgetColumnOverride = {
    align: column.kind === "asset-field" || column.kind === "sparkline" ? "left" : "right",
    compact: visual?.format === "volume",
    format: tableFormatForColumn(column, visual),
    label: column.label,
  };

  override.barMode = visual?.barMode ?? (visual?.kind === "bar" ? "fill" : undefined);
  override.gradientMode = visual?.gradientMode ?? (visual?.kind === "heatmap" ? "fill" : undefined);
  override.gaugeMode = visual?.gaugeMode;
  override.heatmap = visual?.heatmap ?? (visual?.kind === "heatmap" ? true : undefined);
  override.heatmapPalette = visual?.heatmapPalette;

  if (
    visual?.range &&
    typeof visual.range.min === "number" &&
    typeof visual.range.max === "number" &&
    Number.isFinite(visual.range.min) &&
    Number.isFinite(visual.range.max)
  ) {
    override.visualRangeMode = "fixed";
    override.visualMin = visual.range.min;
    override.visualMax = visual.range.max;
  }

  if (visual?.visualRangeMode) {
    override.visualRangeMode = visual.visualRangeMode;
  }

  if (typeof visual?.visualMin === "number" && Number.isFinite(visual.visualMin)) {
    override.visualMin = visual.visualMin;
  }

  if (typeof visual?.visualMax === "number" && Number.isFinite(visual.visualMax)) {
    override.visualMax = visual.visualMax;
  }

  return override;
}

export function buildAssetScreenerTableFrame({
  columns,
  rows,
}: {
  columns: MarketAssetScreenerColumn[];
  rows: MarketAssetScreenerRow[];
}): {
  frame: AssetScreenerTableFrame;
  rowObjects: TableWidgetRow[];
} {
  const columnIds = columns.map((column) => column.id);
  const schemaFallback = columns.map<TableWidgetColumnSchema>((column) => {
    const visual = getSourceColumnVisual(rows, column);
    const format = tableFormatForColumn(column, visual);

    return {
      key: column.id,
      label: column.label,
      format,
      minWidth: column.width ?? (column.kind === "asset-field" ? 120 : 96),
      categorical: column.kind === "asset-field",
      heatmapEligible: format === "number" || format === "percent" || format === "currency" || format === "bps",
      compact: visual?.format === "volume",
    };
  });
  const frameRows = rows.map((row) =>
    columns.map((column) => tableValueForColumn(row, column)),
  );
  const rowObjects = rows.map<TableWidgetRow>((row, rowIndex) => ({
    __assetKey: row.asset.assetKey,
    ...Object.fromEntries(
      columns.map((column, columnIndex) => [column.id, frameRows[rowIndex]?.[columnIndex] ?? null]),
    ),
  }));

  return {
    frame: {
      columns: columnIds,
      rows: frameRows,
      schemaFallback,
      sourceLabel: "Market asset screener",
    },
    rowObjects,
  };
}

export function buildAssetScreenerResolvedTableProps({
  columns,
  density,
  frame,
  rows,
  tableSettings,
}: {
  columns: MarketAssetScreenerColumn[];
  density: MainSequenceAssetScreenerDensity | undefined;
  frame: AssetScreenerTableFrame;
  rows: MarketAssetScreenerRow[];
  tableSettings?: Partial<TableWidgetProps>;
}): ResolvedTableWidgetProps {
  const sourceColumnOverrides = Object.fromEntries(
    columns.map((column) => {
      const visual = getSourceColumnVisual(rows, column);
      return [column.id, buildColumnOverride(column, visual)] as const;
    }),
  );
  const sourceConditionalRules = columns.flatMap((column) => {
    const visual = getSourceColumnVisual(rows, column);
    const thresholdRules = buildTableThresholdRules(column.id, visual);

    return thresholdRules.length > 0
      ? thresholdRules
      : buildLegacyColorScaleRules(column.id, visual);
  });
  const densityOverride =
    tableSettings?.density === "comfortable" || tableSettings?.density === "compact"
      ? tableSettings.density
      : undefined;
  const pageSize =
    typeof tableSettings?.pageSize === "number" && Number.isFinite(tableSettings.pageSize)
      ? Math.max(5, Math.min(Math.trunc(tableSettings.pageSize), 200))
      : 100;

  return {
    columns: frame.columns,
    rows: frame.rows,
    schema: resolveTableSchemaWithInstanceSettings(frame.schemaFallback, tableSettings),
    density: densityOverride ?? (density === "comfortable" ? "comfortable" : "compact"),
    showToolbar: tableSettings?.showToolbar !== false,
    showSearch: tableSettings?.showSearch !== false,
    showColumnFilters: tableSettings?.showColumnFilters !== false,
    zebraRows: tableSettings?.zebraRows === true,
    pagination: tableSettings?.pagination === true,
    pageSize,
    columnOverrides: {
      ...sourceColumnOverrides,
      ...(tableSettings?.columnOverrides ?? {}),
    },
    valueLabels: Array.isArray(tableSettings?.valueLabels) ? tableSettings.valueLabels : [],
    conditionalRules: [
      ...sourceConditionalRules,
      ...(Array.isArray(tableSettings?.conditionalRules) ? tableSettings.conditionalRules : []),
    ],
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
  rows,
}: {
  columns: MarketAssetScreenerColumn[];
  rows: MarketAssetScreenerRow[];
}) {
  const rowByAssetKey = new Map(rows.map((row) => [row.asset.assetKey, row]));

  return Object.fromEntries(
    columns.flatMap((column) => {
      if (column.kind !== "sparkline") {
        return [];
      }

      const renderer: TableFrameCustomCellRenderer = ({ value }) => {
        const row = typeof value === "string" ? rowByAssetKey.get(value) : undefined;

        if (!row) {
          return <span className="text-muted-foreground">—</span>;
        }

        return (
          <div className="flex h-full w-full items-center overflow-hidden text-primary">
            <Sparkline row={row} valueField={column.valueField} />
          </div>
        );
      };

      return [[column.id, renderer] as const];
    }),
  );
}

export function AssetScreenerWidget({
  instanceTitle,
  instanceId,
  props,
  resolvedInputs,
  runtimeState,
  runtimeDataStore,
}: Props) {
  const normalizedProps = normalizeAssetScreenerProps(props);

  useResolveWidgetUpstream(instanceId, {
    enabled: assetScreenerRequiresUpstreamResolution(resolvedInputs),
  });

  const state = useMemo(
    () =>
      resolveAssetScreenerState({
        props: normalizedProps,
        resolvedInputs,
        runtimeDataStore,
        fallbackFrames: isAssetScreenerDemoRuntimeState(runtimeState)
          ? runtimeState.marketAssetScreenerDemoFrames
          : undefined,
      }),
    [normalizedProps, resolvedInputs, runtimeDataStore, runtimeState],
  );
  const tableFrame = useMemo(
    () =>
      buildAssetScreenerTableFrame({
        columns: state.columns,
        rows: state.filteredRows,
      }),
    [state.columns, state.filteredRows],
  );
  const resolvedTableProps = useMemo(
    () =>
      buildAssetScreenerResolvedTableProps({
        columns: state.columns,
        density: normalizedProps.density,
        frame: tableFrame.frame,
        rows: state.filteredRows,
        tableSettings: normalizedProps.table,
      }),
    [normalizedProps.density, normalizedProps.table, state.columns, state.filteredRows, tableFrame.frame],
  );
  const customCellRenderers = useMemo(
    () =>
      buildSparklineCellRenderers({
        columns: state.columns,
        rows: state.filteredRows,
      }),
    [state.columns, state.filteredRows],
  );
  const cardTitle = instanceTitle?.trim();

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
          <div className="text-sm font-medium text-foreground">
            {cardTitle || "Asset screener"}
          </div>
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
          emptyMessage="No assets match the current bindings and filters."
          quickFilterPlaceholder="Filter assets"
          resolvedProps={resolvedTableProps}
          rowObjects={tableFrame.rowObjects}
          showColumnFilters={false}
          surface="transparent"
          toolbarStart={
            <div className="min-w-0">
              {cardTitle ? (
                <div className="truncate text-sm font-semibold text-foreground">{cardTitle}</div>
              ) : null}
              <div className="text-[11px] text-muted-foreground">
                {state.filteredRows.length.toLocaleString()} of {state.rows.length.toLocaleString()} assets
              </div>
            </div>
          }
        />
      </div>
      {normalizedProps.showDiagnostics && state.runtimeModel.warnings.length > 0 ? (
        <div className="flex items-start gap-2 border-x border-b border-border/70 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="line-clamp-2">
            {state.runtimeModel.warnings.slice(0, 3).join(" ")}
          </div>
        </div>
      ) : null}
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
