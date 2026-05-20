import type { ResolvedWidgetInput, ResolvedWidgetInputs } from "@/widgets/types";
import type { WidgetInstancePresentation } from "@/widgets/types";
import type { RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameFieldSchema, TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { TabularSourceDetail, TabularDataRow } from "@/widgets/shared/tabular-widget-source";
import {
  buildTabularFieldOptions,
  formatTabularSourceLabel,
  normalizeAnyTabularFrameSource,
  TABULAR_SOURCE_INPUT_ID,
  type TabularFieldOption,
} from "@/widgets/shared/tabular-widget-source";
import {
  resolveIncrementalTabularOutputFrame,
  TABULAR_LIVE_UPDATES_INPUT_ID,
  TABULAR_SEED_INPUT_ID,
} from "@/widgets/shared/incremental-tabular-consumer";
import {
  buildManualTableFieldOptions,
  normalizeTabularWidgetSourceReferenceProps,
  normalizeManualTableColumns,
  normalizeManualTableRows,
  type TabularWidgetSourceReferenceProps,
  type TabularWidgetSourceMode,
  type ManualTableColumnDefinition,
} from "@/widgets/shared/tabular-widget-source";
import {
  normalizeConnectionQueryProps,
  type ConnectionQueryWidgetProps,
} from "@/widgets/core/connection-query/connectionQueryModel";
import type { ConnectionStreamQueryWidgetProps } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import {
  resolveUpstreamConsumerState,
  type ResolvedUpstreamConsumerState,
} from "@/widgets/shared/upstream-consumer-state";
import {
  applyTableComputedColumns,
  applyResolvedTableComputedColumns,
  resolveTableVisualsMetadata,
  type TableFrameComputedColumn,
  type TableFrameVisualColumnMetadata,
} from "./tableFrameMetadata";
import { compileTableFormulaExpression } from "./tableFormulaCompiler";

export type TableWidgetDateRangeMode = "dashboard" | "fixed";
export type TableWidgetSourceMode = "bound" | "connection" | "connection-stream" | "manual";
export type TableWidgetColumnFormat =
  | "auto"
  | "text"
  | "datetime"
  | "number"
  | "currency"
  | "percent"
  | "bps"
  | "formula";
export type TableWidgetDensity = "compact" | "comfortable";
export type TableWidgetBarMode = "none" | "fill";
export type TableWidgetGradientMode = "none" | "fill";
export type TableWidgetHeatmapPalette =
  | "auto"
  | "viridis"
  | "plasma"
  | "inferno"
  | "magma"
  | "turbo"
  | "jet"
  | "blue-white-red"
  | "red-yellow-green";
export type TableWidgetGaugeMode = "none" | "ring";
export type TableWidgetRangeMode = "auto" | "fixed";
export type TableWidgetAlign = "auto" | "left" | "center" | "right";
export type TableWidgetPinned = "none" | "left" | "right";
export type TableWidgetOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type TableWidgetTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type TableWidgetSelectionMode = "none" | "single-row" | "multi-row" | "cell";

export type TableWidgetCellValue = number | string | boolean | null;
export type TableWidgetRow = Record<string, TableWidgetCellValue>;
export type TableWidgetFrameRow = TableWidgetCellValue[];
export const TABLE_WIDGET_DATASET_OUTPUT_ID = "dataset";
export const TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID = "selectedRows";
export const TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID = "activeRow";
export const TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID = "activeCell";
export const TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID = "activeCellValue";
export const TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID = "selectedCellValues";

export interface TableWidgetColumnSchema {
  key: string;
  label: string;
  description?: string;
  format: Exclude<TableWidgetColumnFormat, "auto">;
  formulaExpression?: string;
  formulaResultFormat?: Exclude<TableWidgetColumnFormat, "auto" | "formula">;
  minWidth?: number;
  flex?: number;
  pinned?: Exclude<TableWidgetPinned, "none">;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateTimeInputFormat?: string;
  dateTimeOutputFormat?: string;
  categorical?: boolean;
  heatmapEligible?: boolean;
  compact?: boolean;
}

export interface TableWidgetColumnOverride {
  visible?: boolean;
  label?: string;
  format?: TableWidgetColumnFormat;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateTimeInputFormat?: string;
  dateTimeOutputFormat?: string;
  heatmap?: boolean;
  compact?: boolean;
  barMode?: TableWidgetBarMode;
  gradientMode?: TableWidgetGradientMode;
  heatmapPalette?: TableWidgetHeatmapPalette;
  gaugeMode?: TableWidgetGaugeMode;
  visualRangeMode?: TableWidgetRangeMode;
  visualMin?: number;
  visualMax?: number;
  align?: TableWidgetAlign;
  pinned?: TableWidgetPinned;
}

export interface TableWidgetValueLabel {
  columnKey: string;
  value: string;
  label?: string;
  tone?: TableWidgetTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface TableWidgetConditionalRule {
  id: string;
  columnKey: string;
  operator: TableWidgetOperator;
  value: number;
  tone?: TableWidgetTone;
  textColor?: string;
  backgroundColor?: string;
}

export interface TableWidgetActiveCellSelection {
  rowKey?: string;
  rowIndex: number;
  columnKey: string;
  value: unknown;
}

export interface TableWidgetSelectionState {
  mode: TableWidgetSelectionMode;
  selectedRowKeys: string[];
  selectedRowIndices: number[];
  activeRowKey?: string;
  activeRowIndex?: number;
  activeCell?: TableWidgetActiveCellSelection;
  selectedCells: TableWidgetActiveCellSelection[];
  implicitMode?: boolean;
  updatedAtMs: number;
}

export interface TableWidgetInteractionRuntimeState {
  interaction?: {
    selection?: TableWidgetSelectionState;
  };
}

export interface TableWidgetProps
  extends Record<string, unknown>,
    TabularWidgetSourceReferenceProps {
  tableSourceMode?: TableWidgetSourceMode;
  embeddedConnectionPresentation?: WidgetInstancePresentation;
  embeddedConnectionQuery?: ConnectionQueryWidgetProps | ConnectionStreamQueryWidgetProps;
  sourceId?: number;
  dateRangeMode?: TableWidgetDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  uniqueIdentifierList?: string[];
  manualColumns?: ManualTableColumnDefinition[];
  manualRows?: Array<Record<string, unknown>>;
  limit?: number;
  columns?: string[];
  rows?: TableWidgetFrameRow[];
  schema?: TableWidgetColumnSchema[];
  density?: TableWidgetDensity;
  groupBy?: string;
  showToolbar?: boolean;
  showSearch?: boolean;
  showColumnFilters?: boolean;
  zebraRows?: boolean;
  pagination?: boolean;
  pageSize?: number;
  columnOverrides?: Record<string, TableWidgetColumnOverride>;
  valueLabels?: TableWidgetValueLabel[];
  conditionalRules?: TableWidgetConditionalRule[];
  formulasEnabled?: boolean;
  selectionMode?: TableWidgetSelectionMode;
  selectionKeyFields?: string[];
  publishSelectionOutputs?: boolean;
}

export function resolveTableWidgetSourceInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
): ResolvedWidgetInput | undefined {
  const resolvedEntry = resolvedInputs?.[TABULAR_SOURCE_INPUT_ID];

  return Array.isArray(resolvedEntry)
    ? resolvedEntry.find((entry) => entry.status === "valid") ?? resolvedEntry[0]
    : resolvedEntry;
}

export function resolveTableWidgetSourceDataset(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
): TabularFrameSourceV1 | null {
  const incrementalFrame = resolveIncrementalTabularOutputFrame({
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  });

  if (incrementalFrame) {
    return incrementalFrame;
  }

  const candidate = resolveTableWidgetSourceInput(resolvedInputs);

  return candidate?.status === "valid"
    ? normalizeTableWidgetSourceFrame(
        normalizeAnyTabularFrameSource(candidate.upstreamBase ?? candidate.value),
      )
    : null;
}

function resolveInvalidTableInputError(input: ResolvedWidgetInput | undefined) {
  if (!input) {
    return "Bind a canonical tabular dataset before this table can publish rows.";
  }

  if (input.status === "missing-source") {
    return "The bound source widget is no longer available.";
  }

  if (input.status === "missing-output") {
    return "The bound source widget no longer publishes the selected output.";
  }

  if (input.status === "contract-mismatch") {
    return "The bound source output is not a canonical tabular dataset.";
  }

  if (input.status === "self-reference-blocked") {
    return "A table widget cannot bind to its own published output.";
  }

  if (input.status === "transform-invalid") {
    return "The binding transform for the source dataset is invalid.";
  }

  return "Bind a canonical tabular dataset before this table can publish rows.";
}

export function resolveTableWidgetSourceConsumerState(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
): ResolvedUpstreamConsumerState<TabularFrameSourceV1> {
  const incrementalDataset = resolveIncrementalTabularOutputFrame({
    resolvedInputs,
    runtimeState,
    runtimeDataStore,
  });

  if (incrementalDataset) {
    const seedInput = resolvedInputs?.[TABULAR_SEED_INPUT_ID];
    const liveInput = resolvedInputs?.[TABULAR_LIVE_UPDATES_INPUT_ID];
    const resolvedSeedInput = Array.isArray(seedInput)
      ? seedInput.find((entry) => entry.status === "valid") ?? seedInput[0]
      : seedInput;
    const resolvedLiveInput = Array.isArray(liveInput)
      ? liveInput.find((entry) => entry.status === "valid") ?? liveInput[0]
      : liveInput;
    const resolvedSourceInput = resolvedLiveInput ?? resolvedSeedInput;

    return resolveUpstreamConsumerState({
      hasCanonicalSourceBinding: Boolean(
        resolvedSeedInput?.sourceWidgetId || resolvedLiveInput?.sourceWidgetId,
      ),
      hasPublishedValue: true,
      resolvedSourceInput,
      dataset: normalizeTableWidgetSourceFrame(incrementalDataset),
      deltaDataset: normalizeTableWidgetSourceFrame(
        normalizeAnyTabularFrameSource(resolvedLiveInput?.upstreamDelta),
      ),
      invalidPublishedValueMessage:
        "The bound source did not publish a compatible canonical tabular frame.",
    });
  }

  const sourceInput = resolveTableWidgetSourceInput(resolvedInputs);
  const sourceValue = sourceInput?.upstreamBase ?? sourceInput?.value;

  return resolveUpstreamConsumerState({
    hasCanonicalSourceBinding: Boolean(sourceInput?.sourceWidgetId),
    hasPublishedValue: sourceValue !== undefined,
    resolvedSourceInput: sourceInput,
    dataset: normalizeTableWidgetSourceFrame(normalizeAnyTabularFrameSource(sourceValue)),
    invalidPublishedValueMessage:
      "The bound source did not publish a compatible canonical tabular frame.",
  });
}

function mapTableFieldOptionToFrameField(field: TabularFieldOption) {
  return {
    key: field.key,
    label: field.label ?? field.key,
    description: field.description ?? null,
    type: field.type,
    nullable: field.nullable,
    nativeType: field.nativeType ?? null,
    provenance: field.provenance,
    reason: field.reason ?? null,
    derivedFrom: field.derivedFrom,
    warnings: field.warnings,
  };
}

export function resolveTableWidgetOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
): TabularFrameSourceV1 {
  const migratedProps = stripLegacyTableWidgetDisplayConfig(props);
  const tableSourceMode = normalizeTableSourceMode(migratedProps.tableSourceMode);

  if (tableSourceMode !== "manual") {
    const sourceInput = resolveTableWidgetSourceInput(resolvedInputs);
    const sourceConsumerState = resolveTableWidgetSourceConsumerState(
      resolvedInputs,
      runtimeState,
      runtimeDataStore,
    );
    const sourceDataset = sourceConsumerState.dataset;
    const sourceContext = {
      kind: "table-widget",
      context: {
        tableSourceMode:
          tableSourceMode === "connection" || tableSourceMode === "connection-stream"
            ? tableSourceMode
            : "bound",
      },
    } satisfies TabularFrameSourceV1["source"];

    if (
      sourceConsumerState.kind === "missing-source" ||
      sourceConsumerState.kind === "missing-output" ||
      sourceConsumerState.kind === "contract-mismatch" ||
      sourceConsumerState.kind === "self-reference-blocked" ||
      sourceConsumerState.kind === "transform-invalid"
    ) {
      return {
        status: "error",
        error: resolveInvalidTableInputError(sourceInput),
        columns: [],
        rows: [],
        source: sourceContext,
      };
    }

    if (sourceConsumerState.kind === "awaiting-upstream" || !sourceDataset) {
      return {
        status: "idle",
        columns: [],
        rows: [],
        source: sourceContext,
      };
    }

    if (sourceConsumerState.kind === "error") {
      return {
        ...sourceDataset,
        status: "error",
        error:
          sourceConsumerState.error ??
          sourceDataset.error ??
          "The bound source failed to publish a canonical tabular frame.",
        source: sourceDataset.source ?? sourceContext,
      };
    }

    return applyTableWidgetFormulaColumnsToPublishedFrame(migratedProps, sourceDataset);
  }

  const manualFrame = buildTableWidgetFrameFromManualData({
    manualColumns: migratedProps.manualColumns,
    manualRows: migratedProps.manualRows,
  });
  const manualFields = buildManualTableFieldOptions({
    columns: migratedProps.manualColumns,
    rows: migratedProps.manualRows,
  }).map(mapTableFieldOptionToFrameField);

  const manualOutputFrame = {
    status:
      manualFrame.columns.length > 0 || manualFrame.rows.length > 0 || manualFields.length > 0
        ? "ready"
        : "idle",
    columns: manualFrame.columns,
    rows: buildTableWidgetRowObjects(manualFrame.columns, manualFrame.rows),
    fields: manualFields,
    source: {
      kind: "table-widget",
      label: "Manual table",
      context: {
        tableSourceMode: "manual",
      },
    },
  } satisfies TabularFrameSourceV1;

  return applyTableWidgetFormulaColumnsToPublishedFrame(migratedProps, manualOutputFrame);
}

export interface ResolvedTableWidgetColumnConfig extends TableWidgetColumnSchema {
  schemaFormat: Exclude<TableWidgetColumnFormat, "auto">;
  visible: boolean;
  align: Exclude<TableWidgetAlign, "auto">;
  heatmap: boolean;
  barMode: TableWidgetBarMode;
  gradientMode: TableWidgetGradientMode;
  heatmapPalette: TableWidgetHeatmapPalette;
  gaugeMode: TableWidgetGaugeMode;
  visualRangeMode: TableWidgetRangeMode;
  visualMin?: number;
  visualMax?: number;
  compact: boolean;
  formulaError?: string;
  pinned?: Exclude<TableWidgetPinned, "none">;
}

export interface ResolvedTableWidgetProps {
  tableSourceMode: TableWidgetSourceMode;
  sourceId?: number;
  sourceLabel?: string;
  dateRangeMode: TableWidgetDateRangeMode;
  fixedEndMs?: number;
  fixedStartMs?: number;
  sourceMode: TabularWidgetSourceMode;
  sourceWidgetId?: string;
  uniqueIdentifierList?: string[];
  manualColumns: ManualTableColumnDefinition[];
  manualRows: Array<Record<string, unknown>>;
  limit: number;
  supportsUniqueIdentifierList: boolean;
  columns: string[];
  rows: TableWidgetFrameRow[];
  schema: TableWidgetColumnSchema[];
  density: TableWidgetDensity;
  groupBy?: string;
  showToolbar: boolean;
  showSearch: boolean;
  showColumnFilters: boolean;
  zebraRows: boolean;
  pagination: boolean;
  pageSize: number;
  columnOverrides: Record<string, TableWidgetColumnOverride>;
  valueLabels: TableWidgetValueLabel[];
  conditionalRules: TableWidgetConditionalRule[];
  formulasEnabled: boolean;
  selectionMode: TableWidgetSelectionMode;
  selectionKeyFields: string[];
  publishSelectionOutputs: boolean;
}

export interface TableWidgetResolvedFrameInput {
  columns: string[];
  rows: TableWidgetFrameRow[];
  schemaFallback: TableWidgetColumnSchema[];
  sourceColumnOverrides?: Record<string, TableWidgetColumnOverride>;
  sourceConditionalRules?: TableWidgetConditionalRule[];
  supportsUniqueIdentifierList?: boolean;
  sourceLabel?: string;
}

export interface TableWidgetSourceVisualContract {
  columns: string[];
  rows: TableWidgetFrameRow[];
  schemaFallback: TableWidgetColumnSchema[];
  sourceColumnOverrides?: Record<string, TableWidgetColumnOverride>;
  sourceConditionalRules?: TableWidgetConditionalRule[];
}

export interface TableWidgetSchemaValidationIssue {
  code: "empty_schema" | "missing_columns" | "non_numeric_columns";
  columnKeys?: string[];
}

export interface TableWidgetSchemaValidationResult {
  isValid: boolean;
  issues: TableWidgetSchemaValidationIssue[];
}

const defaultPageSize = 10;
const defaultRemoteLimit = 500;
const hexColorPattern = /^#(?:[0-9a-fA-F]{6})$/;
export const TABLE_WIDGET_DEFAULT_DATETIME_OUTPUT_FORMAT = "yyyy-MM-dd HH:mm:ss";

export function isTableWidgetNumericFormat(format: TableWidgetColumnFormat) {
  return format === "number" || format === "currency" || format === "percent" || format === "bps";
}

function isTableWidgetFormulaResultFormat(
  format: unknown,
): format is Exclude<TableWidgetColumnFormat, "auto" | "formula"> {
  return (
    format === "text" ||
    format === "datetime" ||
    format === "number" ||
    format === "currency" ||
    format === "percent" ||
    format === "bps"
  );
}

function normalizeTableWidgetFormulaResultFormat(
  value: unknown,
): Exclude<TableWidgetColumnFormat, "auto" | "formula"> | undefined {
  return isTableWidgetFormulaResultFormat(value) ? value : undefined;
}

function normalizeTableWidgetFormulasEnabled(value: unknown) {
  return value === true;
}

function tableFormulaComputedColumnType(
  format: Exclude<TableWidgetColumnFormat, "auto" | "formula"> | undefined,
): TableFrameComputedColumn["type"] {
  if (format === "text" || format === "datetime") {
    return "string";
  }

  return "number";
}

function tableFieldTypeFromWidgetFormat(
  format: Exclude<TableWidgetColumnFormat, "auto" | "formula">,
): TabularFrameFieldSchema["type"] {
  if (format === "datetime") {
    return "datetime";
  }

  if (isTableWidgetNumericFormat(format)) {
    return "number";
  }

  return "string";
}

function buildFrameFieldSchemaFromTableColumn(
  column: TableWidgetColumnSchema,
): TabularFrameFieldSchema {
  const format =
    column.format === "formula"
      ? column.formulaResultFormat ?? "number"
      : column.format;

  return {
    key: column.key,
    label: column.label,
    description: column.description ?? null,
    provenance: "derived",
    type: tableFieldTypeFromWidgetFormat(format),
    nativeType: format,
  };
}

function isTimeLikeField(field: Pick<TabularFieldOption, "key" | "type"> | undefined) {
  if (!field) {
    return false;
  }

  return (
    field.type === "datetime" ||
    field.type === "date" ||
    field.type === "time" ||
    /date|time|timestamp/i.test(field.key)
  );
}

function isKeyLikeField(field: Pick<TabularFieldOption, "key"> | undefined) {
  if (!field) {
    return false;
  }

  return /^(unique_identifier|identifier)$/i.test(field.key.trim());
}

function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return hexColorPattern.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

function normalizeTone(value: unknown): TableWidgetTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeTableWidgetSourceFrame(
  frame: TabularFrameSourceV1 | null,
) {
  return frame ? applyTableComputedColumns(frame) : null;
}

function tableWidgetFormatFromSourceVisual(
  visual: TableFrameVisualColumnMetadata | undefined,
): Exclude<TableWidgetColumnFormat, "auto"> | undefined {
  if (!visual?.format) {
    return undefined;
  }

  if (visual.format === "formula") {
    return visual.formulaExpression ? "formula" : undefined;
  }

  if (visual.format === "percent") {
    return "percent";
  }

  if (visual.format === "currency") {
    return "currency";
  }

  return "number";
}

export function tableWidgetToneFromSourceTone(
  tone: string | undefined,
): TableWidgetTone | undefined {
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

export function buildTableWidgetConditionalRulesFromSourceVisual(
  columnKey: string,
  visual: TableFrameVisualColumnMetadata | undefined,
) {
  if (visual?.thresholds?.length) {
    return visual.thresholds.map<TableWidgetConditionalRule>((rule, index) => ({
      backgroundColor: rule.backgroundColor,
      columnKey,
      id: rule.id ?? `${columnKey}:threshold:${index}`,
      operator: rule.operator,
      textColor: rule.textColor,
      tone: rule.tone,
      value: rule.value,
    }));
  }

  const colorScale = visual?.colorScale;

  if (!colorScale) {
    return [];
  }

  const rules: TableWidgetConditionalRule[] = [];
  const negativeTone = tableWidgetToneFromSourceTone(colorScale.negative);
  const neutralTone = tableWidgetToneFromSourceTone(colorScale.neutral);
  const positiveTone = tableWidgetToneFromSourceTone(colorScale.positive);

  if (negativeTone) {
    rules.push({
      id: `${columnKey}:negative`,
      columnKey,
      operator: "lt",
      value: 0,
      tone: negativeTone,
    });
  }

  if (neutralTone) {
    rules.push({
      id: `${columnKey}:neutral`,
      columnKey,
      operator: "eq",
      value: 0,
      tone: neutralTone,
    });
  }

  if (positiveTone) {
    rules.push({
      id: `${columnKey}:positive`,
      columnKey,
      operator: "gt",
      value: 0,
      tone: positiveTone,
    });
  }

  return rules;
}

export function buildTableWidgetColumnVisualOverrideFromSourceVisual(
  visual: TableFrameVisualColumnMetadata | undefined,
) {
  if (!visual) {
    return undefined;
  }

  const override: TableWidgetColumnOverride = {
    compact: visual.format === "volume",
  };

  if (typeof visual.visible === "boolean") {
    override.visible = visual.visible;
  }

  override.barMode = visual.barMode ?? (visual.kind === "bar" ? "fill" : undefined);
  override.gradientMode = visual.gradientMode ?? (visual.kind === "heatmap" ? "fill" : undefined);
  override.gaugeMode = visual.gaugeMode;
  override.heatmap = visual.heatmap ?? (visual.kind === "heatmap" ? true : undefined);
  override.heatmapPalette = visual.heatmapPalette;

  if (
    visual.range &&
    typeof visual.range.min === "number" &&
    typeof visual.range.max === "number" &&
    Number.isFinite(visual.range.min) &&
    Number.isFinite(visual.range.max)
  ) {
    override.visualRangeMode = "fixed";
    override.visualMin = visual.range.min;
    override.visualMax = visual.range.max;
  }

  if (visual.visualRangeMode) {
    override.visualRangeMode = visual.visualRangeMode;
  }

  if (typeof visual.visualMin === "number" && Number.isFinite(visual.visualMin)) {
    override.visualMin = visual.visualMin;
  }

  if (typeof visual.visualMax === "number" && Number.isFinite(visual.visualMax)) {
    override.visualMax = visual.visualMax;
  }

  return Object.values(override).some((value) => value !== undefined)
    ? override
    : undefined;
}

export function buildTableWidgetSourceVisualContractFromFrame(
  frameInput: TabularFrameSourceV1 | null | undefined,
): TableWidgetSourceVisualContract | null {
  const sourceFrame = normalizeTableWidgetSourceFrame(normalizeAnyTabularFrameSource(frameInput));

  if (!sourceFrame) {
    return null;
  }

  const fieldOptionByKey = new Map((sourceFrame.fields ?? []).map((field) => [field.key, field]));
  const rowKeys = uniqueStrings(sourceFrame.rows.flatMap((row) => Object.keys(row)));
  const normalizedRuntimeColumns = uniqueStrings(sourceFrame.columns);
  const visualColumns = resolveTableVisualsMetadata(sourceFrame)?.columns ?? {};
  const columns =
    normalizedRuntimeColumns.length > 0 || rowKeys.length > 0 || Object.keys(visualColumns).length > 0
      ? uniqueStrings([...normalizedRuntimeColumns, ...rowKeys, ...Object.keys(visualColumns)])
      : uniqueStrings(Array.from(fieldOptionByKey.keys()));
  const rows = sourceFrame.rows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));
  const schemaFallback = columns.map<TableWidgetColumnSchema>((columnKey, index) => {
    const field = fieldOptionByKey.get(columnKey);
    const visual = visualColumns[columnKey];
    const format = tableWidgetFormatFromSourceVisual(visual) ?? inferRemoteColumnFormatFromKey(
      columnKey,
      field?.type === "unknown" ? undefined : field?.type,
      field?.nativeType ?? null,
      rows,
      index,
    );

    return {
      key: columnKey,
      label: visual?.label?.trim() || field?.label?.trim() || columnKey,
      description: field?.description ?? undefined,
      format,
      formulaExpression:
        format === "formula" && visual?.formulaExpression
          ? visual.formulaExpression
          : undefined,
      formulaResultFormat:
        format === "formula" && visual?.formulaResultFormat
          ? visual.formulaResultFormat
          : undefined,
      decimals:
        typeof visual?.decimals === "number" && Number.isFinite(visual.decimals)
          ? Math.max(0, Math.min(Math.trunc(visual.decimals), 6))
          : undefined,
      minWidth:
        typeof visual?.width === "number" && Number.isFinite(visual.width) && visual.width > 0
          ? Math.trunc(visual.width)
          : isTimeLikeField(field)
            ? 160
            : format === "text"
              ? 140
              : 120,
      pinned: isKeyLikeField(field) ? "left" : undefined,
      categorical: format === "text",
      heatmapEligible: isTableWidgetNumericFormat(
        format === "formula" ? (visual?.formulaResultFormat ?? "number") : format,
      ),
      compact:
        visual?.format === "volume" ||
        (
          format === "currency" &&
          /gross|net|pnl|notional|amount|exposure|value/i.test(columnKey)
        ),
    };
  });
  const sourceColumnOverrides = Object.fromEntries(
    columns.flatMap((columnKey) => {
      const override = buildTableWidgetColumnVisualOverrideFromSourceVisual(visualColumns[columnKey]);
      return override ? [[columnKey, override] as const] : [];
    }),
  );
  const sourceConditionalRules = columns.flatMap((columnKey) =>
    buildTableWidgetConditionalRulesFromSourceVisual(columnKey, visualColumns[columnKey]),
  );

  return {
    columns,
    rows,
    schemaFallback,
    sourceColumnOverrides:
      Object.keys(sourceColumnOverrides).length > 0 ? sourceColumnOverrides : undefined,
    sourceConditionalRules: sourceConditionalRules.length > 0 ? sourceConditionalRules : undefined,
  };
}

function normalizeCellValue(value: unknown): TableWidgetCellValue {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return String(value);
}

export function normalizeTableSourceMode(value: unknown): TableWidgetSourceMode {
  return value === "manual" || value === "connection" || value === "connection-stream"
    ? value
    : "bound";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resolveTableEmbeddedConnectionQueryProps(
  props: TableWidgetProps,
) {
  return normalizeConnectionQueryProps(
    isPlainRecord(props.embeddedConnectionQuery)
      ? (props.embeddedConnectionQuery as ConnectionQueryWidgetProps)
      : {},
  );
}

function coerceManualTableCellValue(
  value: unknown,
  fieldType: TabularFieldOption["type"],
): TableWidgetCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && !value.trim()) {
    return null;
  }

  if (fieldType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (/^true$/i.test(value.trim())) {
        return true;
      }

      if (/^false$/i.test(value.trim())) {
        return false;
      }
    }

    return null;
  }

  if (fieldType === "number" || fieldType === "integer") {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.trim())
          : Number.NaN;

    if (!Number.isFinite(parsed)) {
      return null;
    }

    return fieldType === "integer" ? Math.trunc(parsed) : parsed;
  }

  if (fieldType === "json") {
    if (typeof value === "string") {
      return value.trim();
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return normalizeCellValue(value);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values.filter((value): value is string => {
    if (!value?.trim()) {
      return false;
    }

    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
}

function normalizePositiveInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
}

function normalizeTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const absoluteValue = Math.abs(value);

    if (absoluteValue >= 1_000_000_000_000_000_000) {
      return Math.trunc(value / 1_000_000);
    }

    if (absoluteValue >= 1_000_000_000_000_000) {
      return Math.trunc(value / 1000);
    }

    if (absoluteValue >= 100_000_000_000) {
      return Math.trunc(value);
    }

    if (absoluteValue >= 100_000_000) {
      return Math.trunc(value * 1000);
    }

    return undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value.trim());

    if (Number.isFinite(numericValue)) {
      return normalizeTimestampMs(numericValue);
    }

    const parsed = Date.parse(normalizeDateTimeString(value));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeDateTimeString(value: string) {
  let normalized = value.trim();

  if (!normalized) {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(/\s+/, "T");
  }

  normalized = normalized.replace(/(\.\d{3})\d+/, "$1");
  normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  normalized = normalized.replace(/\s+UTC$/i, "Z");

  return normalized;
}

function parseDateOnlyLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date.getTime()
    : null;
}

function parseTimeOnlyLocal(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  const millisecond = Number((match[4] ?? "0").padEnd(3, "0"));

  if (hour > 23 || minute > 59 || second > 59 || millisecond > 999) {
    return null;
  }

  return new Date(1970, 0, 1, hour, minute, second, millisecond).getTime();
}

const dateTimeInputTokenPattern = /yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|a/g;
const dateTimeOutputTokenPattern = /yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|a/g;

function normalizeDateTimePattern(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readQuotedLiteral(format: string, startIndex: number) {
  let literal = "";
  let index = startIndex + 1;

  while (index < format.length) {
    const char = format[index]!;

    if (char === "'") {
      if (format[index + 1] === "'") {
        literal += "'";
        index += 2;
        continue;
      }

      return { literal, nextIndex: index + 1 };
    }

    literal += char;
    index += 1;
  }

  return { literal: "'", nextIndex: startIndex + 1 };
}

function tokenizeDateTimePattern(
  pattern: string,
  tokenPattern: RegExp,
  onToken: (token: string) => string,
) {
  let output = "";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index]!;

    if (char === "'") {
      const quoted = readQuotedLiteral(pattern, index);
      output += quoted.literal;
      index = quoted.nextIndex;
      continue;
    }

    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(pattern);

    if (match && match.index === index) {
      output += onToken(match[0]);
      index += match[0].length;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function compileDateTimeInputPattern(pattern: string) {
  const captures: string[] = [];
  let source = "";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index]!;

    if (char === "'") {
      const quoted = readQuotedLiteral(pattern, index);
      source += escapeRegExp(quoted.literal);
      index = quoted.nextIndex;
      continue;
    }

    dateTimeInputTokenPattern.lastIndex = index;
    const match = dateTimeInputTokenPattern.exec(pattern);

    if (match && match.index === index) {
      const token = match[0];
      captures.push(token);

      if (token === "yyyy") {
        source += "(\\d{4})";
      } else if (token === "yy") {
        source += "(\\d{2})";
      } else if (token === "SSS") {
        source += "(\\d{1,3})";
      } else if (token === "a") {
        source += "([AaPp][Mm])";
      } else {
        source += "(\\d{1,2})";
      }

      index += token.length;
      continue;
    }

    source += escapeRegExp(char);
    index += 1;
  }

  return {
    captures,
    regex: new RegExp(`^${source}$`),
  };
}

function parseDateTimeWithPattern(value: string, pattern: string) {
  const { captures, regex } = compileDateTimeInputPattern(pattern);
  const match = regex.exec(value.trim());

  if (!match) {
    return null;
  }

  const parsed: Record<string, string> = {};

  captures.forEach((token, index) => {
    parsed[token] = match[index + 1] ?? "";
  });

  const rawYear = parsed.yyyy ?? parsed.yy;
  const year =
    rawYear == null || rawYear === ""
      ? 1970
      : parsed.yy != null && parsed.yyyy == null
        ? Number(rawYear) >= 70
          ? 1900 + Number(rawYear)
          : 2000 + Number(rawYear)
        : Number(rawYear);
  const month = Number(parsed.MM ?? parsed.M ?? 1);
  const day = Number(parsed.dd ?? parsed.d ?? 1);
  let hour = Number(parsed.HH ?? parsed.H ?? parsed.hh ?? parsed.h ?? 0);
  const minute = Number(parsed.mm ?? parsed.m ?? 0);
  const second = Number(parsed.ss ?? parsed.s ?? 0);
  const millisecond = Number((parsed.SSS ?? "0").padEnd(3, "0"));
  const meridiem = parsed.a?.toLowerCase();

  if (parsed.hh != null || parsed.h != null) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    } else if (meridiem === "am" && hour === 12) {
      hour = 0;
    }
  }

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second) ||
    !Number.isFinite(millisecond) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second ||
    date.getMilliseconds() !== millisecond
  ) {
    return null;
  }

  return date.getTime();
}

export function parseTableWidgetDateTimeValue(
  value: TableWidgetCellValue,
  inputFormat?: string,
) {
  const explicitInputFormat = normalizeDateTimePattern(inputFormat);

  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeTimestampMs(value) ?? null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (explicitInputFormat) {
    const explicitParsed = parseDateTimeWithPattern(trimmed, explicitInputFormat);

    if (explicitParsed !== null) {
      return explicitParsed;
    }
  }

  const numericValue = Number(trimmed);

  if (Number.isFinite(numericValue)) {
    return normalizeTimestampMs(numericValue) ?? null;
  }

  const dateOnly = parseDateOnlyLocal(trimmed);

  if (dateOnly !== null) {
    return dateOnly;
  }

  const timeOnly = parseTimeOnlyLocal(trimmed);

  if (timeOnly !== null) {
    return timeOnly;
  }

  const parsed = Date.parse(normalizeDateTimeString(trimmed));

  return Number.isFinite(parsed) ? parsed : null;
}

function padDateTimePart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatDateTimeWithPattern(timestampMs: number, pattern: string) {
  const date = new Date(timestampMs);
  const hours = date.getHours();
  const twelveHour = hours % 12 || 12;

  return tokenizeDateTimePattern(pattern, dateTimeOutputTokenPattern, (token) => {
    switch (token) {
      case "yyyy":
        return String(date.getFullYear());
      case "yy":
        return padDateTimePart(date.getFullYear() % 100);
      case "MM":
        return padDateTimePart(date.getMonth() + 1);
      case "M":
        return String(date.getMonth() + 1);
      case "dd":
        return padDateTimePart(date.getDate());
      case "d":
        return String(date.getDate());
      case "HH":
        return padDateTimePart(hours);
      case "H":
        return String(hours);
      case "hh":
        return padDateTimePart(twelveHour);
      case "h":
        return String(twelveHour);
      case "mm":
        return padDateTimePart(date.getMinutes());
      case "m":
        return String(date.getMinutes());
      case "ss":
        return padDateTimePart(date.getSeconds());
      case "s":
        return String(date.getSeconds());
      case "SSS":
        return padDateTimePart(date.getMilliseconds(), 3);
      case "a":
        return hours >= 12 ? "PM" : "AM";
      default:
        return token;
    }
  });
}

function normalizeDateRangeMode(value: unknown): TableWidgetDateRangeMode {
  return value === "fixed" ? "fixed" : "dashboard";
}

function normalizeUniqueIdentifierList(value: unknown) {
  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,]+/).map((item) => item.trim()));
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedValues = uniqueStrings(
    value.map((item) => (typeof item === "string" ? item.trim() : "")),
  );

  return normalizedValues.length > 0 ? normalizedValues : undefined;
}

export function normalizeTableWidgetSelectionMode(value: unknown): TableWidgetSelectionMode {
  return value === "single-row" ||
    value === "multi-row" ||
    value === "cell"
    ? value
    : "none";
}

export const tableWidgetSelectionModeOptions: Array<{
  value: TableWidgetSelectionMode;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "Off",
    description: "Rows and cells are not published as interaction outputs.",
  },
  {
    value: "single-row",
    label: "Single row",
    description: "One selected row is published to downstream widgets.",
  },
  {
    value: "multi-row",
    label: "Multi row",
    description: "Multiple selected rows are published to downstream widgets.",
  },
  {
    value: "cell",
    label: "Cell",
    description:
      "The active cell, its value, its row, and the list of selected cell values are published to downstream widgets.",
  },
];

function normalizeSelectionKeyFields(value: unknown) {
  return normalizeUniqueIdentifierList(value) ?? [];
}

function normalizeGroupBy(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRowIndex(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeRowIndices(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.flatMap((entry) => {
    const index = normalizeRowIndex(entry);
    return index == null ? [] : [index];
  }))];
}

function normalizeRowKeys(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(
    value.map((entry) =>
      typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean"
        ? String(entry).trim()
        : "",
    ),
  );
}

function normalizeOptionalRowKey(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeActiveCellSelection(value: unknown): TableWidgetActiveCellSelection | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const rowIndex = normalizeRowIndex(value.rowIndex);
  const columnKey = typeof value.columnKey === "string" ? value.columnKey.trim() : "";

  if (rowIndex == null || !columnKey) {
    return undefined;
  }

  return {
    rowKey: normalizeOptionalRowKey(value.rowKey),
    rowIndex,
    columnKey,
    value: value.value,
  };
}

function normalizeSelectedCellSelections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: TableWidgetActiveCellSelection[] = [];

  value.forEach((entry) => {
    const cell = normalizeActiveCellSelection(entry);

    if (!cell) {
      return;
    }

    const key = `${cell.rowKey ?? cell.rowIndex}:${cell.columnKey}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push(cell);
  });

  return normalized;
}

export function normalizeTableWidgetSelectionState(
  runtimeState: unknown,
): TableWidgetSelectionState {
  const selection = isPlainRecord(runtimeState)
    ? isPlainRecord(runtimeState.interaction)
      ? runtimeState.interaction.selection
      : undefined
    : undefined;
  const record = isPlainRecord(selection) ? selection : {};
  const activeRowIndex = normalizeRowIndex(record.activeRowIndex);

  return {
    mode: normalizeTableWidgetSelectionMode(record.mode),
    selectedRowKeys: normalizeRowKeys(record.selectedRowKeys),
    selectedRowIndices: normalizeRowIndices(record.selectedRowIndices),
    activeRowKey: normalizeOptionalRowKey(record.activeRowKey),
    activeRowIndex,
    activeCell: normalizeActiveCellSelection(record.activeCell),
    selectedCells: normalizeSelectedCellSelections(record.selectedCells),
    implicitMode: record.implicitMode === true,
    updatedAtMs:
      typeof record.updatedAtMs === "number" && Number.isFinite(record.updatedAtMs)
        ? record.updatedAtMs
        : 0,
  };
}

export function resolveImplicitTableSelectionMode(
  outputIds: Iterable<string>,
): TableWidgetSelectionMode {
  const referencedOutputIds = outputIds instanceof Set ? outputIds : new Set(outputIds);

  if (referencedOutputIds.has(TABLE_WIDGET_SELECTED_ROWS_OUTPUT_ID)) {
    return "multi-row";
  }

  if (referencedOutputIds.has(TABLE_WIDGET_ACTIVE_ROW_OUTPUT_ID)) {
    return "single-row";
  }

  if (
    referencedOutputIds.has(TABLE_WIDGET_ACTIVE_CELL_OUTPUT_ID) ||
    referencedOutputIds.has(TABLE_WIDGET_ACTIVE_CELL_VALUE_OUTPUT_ID) ||
    referencedOutputIds.has(TABLE_WIDGET_SELECTED_CELL_VALUES_OUTPUT_ID)
  ) {
    return "cell";
  }

  return "none";
}

export function resolveEffectivePublishedSelectionMode(
  props: Pick<ResolvedTableWidgetProps, "publishSelectionOutputs" | "selectionMode">,
  selection: TableWidgetSelectionState,
  referencedOutputIds?: Iterable<string>,
): TableWidgetSelectionMode {
  if (!props.publishSelectionOutputs) {
    return "none";
  }

  if (props.selectionMode !== "none") {
    return props.selectionMode;
  }

  if (selection.implicitMode === true && selection.mode !== "none") {
    return selection.mode;
  }

  if (referencedOutputIds) {
    return resolveImplicitTableSelectionMode(referencedOutputIds);
  }

  return "none";
}

export function withTableWidgetSelectionRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
  selection: TableWidgetSelectionState,
): Record<string, unknown> {
  const base = isPlainRecord(runtimeState) ? runtimeState : {};
  const interaction = isPlainRecord(base.interaction) ? base.interaction : {};

  return {
    ...base,
    interaction: {
      ...interaction,
      selection,
    },
  };
}

function stableSelectionValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

export function buildTableWidgetRowKey(
  row: Record<string, unknown> | undefined,
  keyFields: readonly string[],
) {
  if (!row || keyFields.length === 0) {
    return undefined;
  }

  return JSON.stringify(keyFields.map((field) => stableSelectionValue(row[field])));
}

export function resolveTableWidgetSelectionKeyFields(
  props: Pick<TableWidgetProps, "selectionKeyFields" | "uniqueIdentifierList">,
  frame?: Pick<TabularFrameSourceV1, "columns" | "source"> | null,
) {
  const explicit = normalizeSelectionKeyFields(props.selectionKeyFields);

  if (explicit.length > 0) {
    return explicit;
  }

  const propIdentifiers = normalizeSelectionKeyFields(props.uniqueIdentifierList);

  if (propIdentifiers.length > 0) {
    return propIdentifiers;
  }

  const sourceContext = isPlainRecord(frame?.source?.context) ? frame.source.context : undefined;
  const sourceIdentifiers = normalizeSelectionKeyFields(sourceContext?.uniqueIdentifierList);

  if (sourceIdentifiers.length > 0) {
    return sourceIdentifiers;
  }

  return [];
}

function resolveRowsBySelection(
  frame: TabularFrameSourceV1,
  props: Pick<TableWidgetProps, "selectionKeyFields" | "uniqueIdentifierList">,
  selection: TableWidgetSelectionState,
) {
  const keyFields = resolveTableWidgetSelectionKeyFields(props, frame);
  const selectedKeySet = new Set(selection.selectedRowKeys);
  const selectedIndexSet = new Set(selection.selectedRowIndices);

  selection.selectedCells.forEach((cell) => {
    if (cell.rowKey) {
      selectedKeySet.add(cell.rowKey);
    }

    selectedIndexSet.add(cell.rowIndex);
  });

  if (keyFields.length > 0 && selectedKeySet.size > 0) {
    return frame.rows.filter((row) => {
      const rowKey = buildTableWidgetRowKey(row, keyFields);
      return rowKey ? selectedKeySet.has(rowKey) : false;
    });
  }

  return frame.rows.filter((_, index) => selectedIndexSet.has(index));
}

function resolveActiveRow(
  frame: TabularFrameSourceV1,
  props: Pick<TableWidgetProps, "selectionKeyFields" | "uniqueIdentifierList">,
  selection: TableWidgetSelectionState,
  options: { includeActiveCellFallback?: boolean } = {},
) {
  const keyFields = resolveTableWidgetSelectionKeyFields(props, frame);
  const activeRowKey =
    selection.activeRowKey ??
    (options.includeActiveCellFallback ? selection.activeCell?.rowKey : undefined);

  if (keyFields.length > 0 && activeRowKey) {
    const row = frame.rows.find((entry) => buildTableWidgetRowKey(entry, keyFields) === activeRowKey);

    if (row) {
      return row;
    }
  }

  const activeRowIndex =
    selection.activeRowIndex ??
    (options.includeActiveCellFallback ? selection.activeCell?.rowIndex : undefined);
  return activeRowIndex == null ? null : frame.rows[activeRowIndex] ?? null;
}

function resolveSelectionCellValue(
  frame: TabularFrameSourceV1,
  props: Pick<TableWidgetProps, "selectionKeyFields" | "uniqueIdentifierList">,
  cell: TableWidgetActiveCellSelection,
) {
  const keyFields = resolveTableWidgetSelectionKeyFields(props, frame);

  if (keyFields.length > 0 && cell.rowKey) {
    const row = frame.rows.find((entry) => buildTableWidgetRowKey(entry, keyFields) === cell.rowKey);

    if (row) {
      return row[cell.columnKey] ?? null;
    }
  }

  const row = frame.rows[cell.rowIndex];
  return row ? row[cell.columnKey] ?? null : cell.value ?? null;
}

function resolveSelectedCells(
  selection: TableWidgetSelectionState,
) {
  if (selection.selectedCells.length > 0) {
    return selection.selectedCells;
  }

  return selection.activeCell ? [selection.activeCell] : [];
}

export function resolveTableSelectionOutputsFromFrame(
  frame: TabularFrameSourceV1,
  props: Pick<
    ResolvedTableWidgetProps,
    "publishSelectionOutputs" | "selectionMode" | "selectionKeyFields" | "uniqueIdentifierList"
  >,
  runtimeState?: unknown,
) {
  const selection = normalizeTableWidgetSelectionState(runtimeState);
  const effectiveSelectionMode = resolveEffectivePublishedSelectionMode(props, selection);

  if (effectiveSelectionMode === "none") {
    return {
      activeCell: null,
      activeCellValue: null,
      activeRow: null,
      effectiveSelectionMode,
      selectedCellValues: [],
      selectedRows: [],
      selection,
    };
  }

  const activeRow = resolveActiveRow(
    frame,
    props,
    selection,
    { includeActiveCellFallback: effectiveSelectionMode === "cell" },
  );

  const activeCell =
    selection.mode !== effectiveSelectionMode || !selection.activeCell
      ? null
      : {
          rowKey: selection.activeCell.rowKey,
          rowIndex: selection.activeCell.rowIndex,
          columnKey: selection.activeCell.columnKey,
          value:
            (activeRow ? activeRow[selection.activeCell.columnKey] : selection.activeCell.value) ?? null,
          row: activeRow,
        };

  const selectedRows = resolveRowsBySelection(frame, props, selection);
  const selectedCellValues =
    selection.mode !== effectiveSelectionMode
      ? []
      : resolveSelectedCells(selection).map((cell) =>
          resolveSelectionCellValue(frame, props, cell),
        );

  return {
    activeCell,
    activeCellValue: activeCell ? activeCell.value ?? null : null,
    activeRow,
    effectiveSelectionMode,
    selectedCellValues,
    selectedRows,
    selection,
  };
}

function selectedRowsSource(frame: TabularFrameSourceV1, selectedRows: Array<Record<string, unknown>>) {
  return {
    kind: "table-widget-selection",
    label: "Selected table rows",
    context: {
      sourceKind: frame.source?.kind,
      selectedRowCount: selectedRows.length,
    },
  } satisfies TabularFrameSourceV1["source"];
}

export function resolveTableWidgetSelectedRowsOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
): TabularFrameSourceV1 {
  const frame = resolveTableWidgetOutput(props, resolvedInputs, runtimeState, runtimeDataStore);
  const normalizedProps = resolveTableWidgetPropsWithFrame(props);
  const { selectedRows } = resolveTableSelectionOutputsFromFrame(
    frame,
    normalizedProps,
    runtimeState,
  );

  return {
    ...frame,
    status: frame.status === "error" ? "error" : frame.status === "loading" ? "loading" : "ready",
    rows: selectedRows,
    source: selectedRowsSource(frame, selectedRows),
  };
}

export function resolveTableWidgetActiveRowOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
) {
  const frame = resolveTableWidgetOutput(props, resolvedInputs, runtimeState, runtimeDataStore);
  const normalizedProps = resolveTableWidgetPropsWithFrame(props);
  return resolveTableSelectionOutputsFromFrame(frame, normalizedProps, runtimeState).activeRow;
}

export function resolveTableWidgetActiveCellOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
) {
  const frame = resolveTableWidgetOutput(props, resolvedInputs, runtimeState, runtimeDataStore);
  const normalizedProps = resolveTableWidgetPropsWithFrame(props);
  return resolveTableSelectionOutputsFromFrame(frame, normalizedProps, runtimeState).activeCell;
}

export function resolveTableWidgetActiveCellValueOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
) {
  const frame = resolveTableWidgetOutput(props, resolvedInputs, runtimeState, runtimeDataStore);
  const normalizedProps = resolveTableWidgetPropsWithFrame(props);
  return resolveTableSelectionOutputsFromFrame(frame, normalizedProps, runtimeState).activeCellValue;
}

export function resolveTableWidgetSelectedCellValuesOutput(
  props: TableWidgetProps,
  resolvedInputs: ResolvedWidgetInputs | undefined,
  runtimeState?: unknown,
  runtimeDataStore?: RuntimeDataStore | null,
) {
  const frame = resolveTableWidgetOutput(props, resolvedInputs, runtimeState, runtimeDataStore);
  const normalizedProps = resolveTableWidgetPropsWithFrame(props);
  return resolveTableSelectionOutputsFromFrame(frame, normalizedProps, runtimeState).selectedCellValues;
}

function inferRemoteColumnFormatFromKey(
  key: string,
  fieldType: TabularFieldOption["type"] | undefined,
  nativeType: string | null | undefined,
  rows: readonly TableWidgetFrameRow[],
  columnIndex: number,
): Exclude<TableWidgetColumnFormat, "auto"> {
  if (
    fieldType === "datetime" ||
    fieldType === "date" ||
    fieldType === "time" ||
    (nativeType && /date|time|timestamp/i.test(nativeType))
  ) {
    return "datetime";
  }

  if (
    /date|time|timestamp/i.test(key) &&
    rows.some((row) => parseTableWidgetDateTimeValue(row[columnIndex]) !== null)
  ) {
    return "datetime";
  }

  if (
    fieldType === "number" ||
    fieldType === "integer" ||
    (nativeType && /int|float|double|decimal|number|numeric|real|bigint/i.test(nativeType))
  ) {
    if (/%|pct|percent/i.test(key)) {
      return "percent";
    }

    if (/bps/i.test(key)) {
      return "bps";
    }

    if (/price|cost|value|gross|net|pnl|notional|amount|exposure/i.test(key)) {
      return "currency";
    }

    return "number";
  }

  return inferSchemaFormatFromRows(key, rows, columnIndex);
}

export function buildTableWidgetFrameFromRemoteData(
  detail?: TabularSourceDetail | null,
  remoteRows: readonly TabularDataRow[] = [],
  runtimeColumns: readonly string[] = [],
  runtimeFields: readonly TabularFieldOption[] = [],
  runtimeMeta?: TabularFrameSourceV1["meta"],
): TableWidgetResolvedFrameInput {
  const fieldOptions = runtimeFields.length > 0 ? runtimeFields : buildTabularFieldOptions(detail);
  const sourceFrame = {
    status: "ready",
    columns: uniqueStrings(
      runtimeColumns.map((column) => (typeof column === "string" ? column.trim() : "")),
    ),
    rows: remoteRows.map((row) => ({ ...row })),
    fields: fieldOptions.map<TabularFrameFieldSchema>((field) => mapTableFieldOptionToFrameField(field)),
    meta: runtimeMeta,
  } satisfies TabularFrameSourceV1;
  const sharedContract = buildTableWidgetSourceVisualContractFromFrame(sourceFrame);

  return {
    columns: sharedContract?.columns ?? [],
    rows: sharedContract?.rows ?? [],
    schemaFallback: sharedContract?.schemaFallback ?? [],
    sourceColumnOverrides: sharedContract?.sourceColumnOverrides,
    sourceConditionalRules: sharedContract?.sourceConditionalRules,
    supportsUniqueIdentifierList:
      (detail?.sourcetableconfiguration?.index_names ?? []).includes("unique_identifier"),
    sourceLabel: formatTabularSourceLabel(detail),
  };
}

export function buildTableWidgetFrameFromManualData(
  props: Pick<TableWidgetProps, "manualColumns" | "manualRows">,
): TableWidgetResolvedFrameInput {
  const manualColumns = normalizeManualTableColumns(props.manualColumns);
  const manualRows = normalizeManualTableRows(props.manualRows);
  const fields = buildManualTableFieldOptions({
    columns: manualColumns,
    rows: manualRows,
  });
  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  const columns = fields.map((field) => field.key);
  const rows = manualRows.map<TableWidgetFrameRow>((row) =>
    columns.map((columnKey) => {
      const field = fieldByKey.get(columnKey);
      return coerceManualTableCellValue(row[columnKey], field?.type ?? "string");
    }),
  );
  const schemaFallback = fields.map<TableWidgetColumnSchema>((field, index) => {
    const format = inferRemoteColumnFormatFromKey(
      field.key,
      field.type,
      field.nativeType,
      rows,
      index,
    );

    return {
      key: field.key,
      label: field.label ?? field.key,
      description: field.description ?? undefined,
      format,
      minWidth: isTimeLikeField(field) ? 160 : format === "text" ? 140 : 120,
      categorical: format === "text",
      heatmapEligible: isTableWidgetNumericFormat(format),
    };
  });

  return {
    columns,
    rows,
    schemaFallback,
    supportsUniqueIdentifierList: false,
    sourceLabel: "Manual table",
  };
}

function normalizeFrameColumns(value: unknown, fallback: readonly string[]) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const seen = new Set<string>();
  const normalized = value.flatMap((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return [];
    }

    const key = entry.trim();

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [key];
  });

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeFrameRows(value: unknown, columnCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry)) {
      return [];
    }

    const row = Array.from({ length: columnCount }, (_, index) =>
      normalizeCellValue(entry[index]),
    );

    return [row];
  });
}

function inferSchemaFormatFromRows(
  columnKey: string,
  rows: readonly TableWidgetFrameRow[],
  columnIndex: number,
): Exclude<TableWidgetColumnFormat, "auto"> {
  const values = rows
    .map((row) => row[columnIndex])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return "text";
  }

  if (
    /date|time|timestamp/i.test(columnKey) &&
    values.some((value) => parseTableWidgetDateTimeValue(value) !== null)
  ) {
    return "datetime";
  }

  const allNumeric = values.every((value) => getTableWidgetNumericValue(value) !== null);

  if (allNumeric) {
    if (/%|pct|percent/i.test(columnKey)) {
      return "percent";
    }

    if (/bps/i.test(columnKey)) {
      return "bps";
    }

    if (/price|cost|value|gross|net|pnl|notional|amount|exposure/i.test(columnKey)) {
      return "currency";
    }

    return "number";
  }

  return "text";
}

function createSchemaTemplateFromFrame(
  columns: readonly string[],
  rows: readonly TableWidgetFrameRow[],
  schemaFallback: readonly TableWidgetColumnSchema[] = [],
) {
  const schemaFallbackByKey = new Map(schemaFallback.map((column) => [column.key, column]));

  return columns.map<TableWidgetColumnSchema>((columnKey, index) => {
    const existing = schemaFallbackByKey.get(columnKey);

    if (existing) {
      return { ...existing };
    }

    return {
      key: columnKey,
      label: columnKey,
      format: inferSchemaFormatFromRows(columnKey, rows, index),
      categorical: false,
    };
  });
}

function buildResolvedFrameInputFromPublishedFrame(
  frame: Pick<TabularFrameSourceV1, "columns" | "rows" | "fields">,
): TableWidgetResolvedFrameInput {
  const fieldByKey = new Map((frame.fields ?? []).map((field) => [field.key, field] as const));
  const rowKeys = uniqueStrings(frame.rows.flatMap((row) => Object.keys(row)));
  const columns =
    frame.columns.length > 0 || rowKeys.length > 0
      ? uniqueStrings([...frame.columns, ...rowKeys])
      : uniqueStrings(Array.from(fieldByKey.keys()));
  const rows = frame.rows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey])));
  const schemaFallback = columns.map<TableWidgetColumnSchema>((columnKey, index) => {
    const field = fieldByKey.get(columnKey);
    const format = inferRemoteColumnFormatFromKey(
      columnKey,
      field?.type === "unknown" ? undefined : field?.type,
      field?.nativeType ?? null,
      rows,
      index,
    );

    return {
      key: columnKey,
      label: field?.label?.trim() || columnKey,
      description: field?.description ?? undefined,
      format,
      minWidth: isTimeLikeField(field) ? 160 : format === "text" ? 140 : 120,
      pinned: isKeyLikeField(field) ? "left" : undefined,
      categorical: format === "text",
      heatmapEligible: isTableWidgetNumericFormat(format),
      compact:
        format === "currency" &&
        /gross|net|pnl|notional|amount|exposure|value/i.test(columnKey),
    };
  });

  return {
    columns,
    rows,
    schemaFallback,
  };
}

function resolveTableWidgetFormulaColumns(
  formulasEnabled: boolean,
  schema: readonly TableWidgetColumnSchema[],
) {
  const errorsByKey = new Map<string, string>();

  if (!formulasEnabled) {
    return {
      computedColumns: [] as TableFrameComputedColumn[],
      errorsByKey,
    };
  }

  const computedColumns = schema.flatMap((column) => {
    if (column.format !== "formula") {
      return [];
    }

    const compiled = compileTableFormulaExpression(column.formulaExpression);

    if (!compiled.expression) {
      if (compiled.error) {
        errorsByKey.set(column.key, compiled.error);
      }

      return [];
    }

    return [{
      id: column.key,
      label: column.label,
      type: tableFormulaComputedColumnType(column.formulaResultFormat),
      expression: compiled.expression,
    } satisfies TableFrameComputedColumn];
  });

  return {
    computedColumns,
    errorsByKey,
  };
}

function appendSchemaColumnsToFrameFallback(
  frameInput: TableWidgetResolvedFrameInput,
  schema: readonly TableWidgetColumnSchema[],
) {
  const seen = new Set(frameInput.schemaFallback.map((column) => column.key));
  const appended = schema
    .filter((column) => !seen.has(column.key))
    .map((column) => ({ ...column }));

  return appended.length > 0
    ? [...cloneTableWidgetSchema(frameInput.schemaFallback), ...appended]
    : cloneTableWidgetSchema(frameInput.schemaFallback);
}

function applyTableWidgetFormulaColumnsToResolvedFrameInput(
  props: Pick<TableWidgetProps, "formulasEnabled" | "schema">,
  frameInput: TableWidgetResolvedFrameInput | null | undefined,
) {
  if (!frameInput) {
    return null;
  }

  const formulasEnabled = normalizeTableWidgetFormulasEnabled(props.formulasEnabled);
  const schema = resolveTableWidgetSchemaFromFrame(props, frameInput);
  const formulaColumnKeys = schema
    .filter((column) => column.format === "formula")
    .map((column) => column.key);
  const schemaFallback = appendSchemaColumnsToFrameFallback(frameInput, schema);
  const { computedColumns } = resolveTableWidgetFormulaColumns(formulasEnabled, schema);
  const sourceFrame = {
    status: "ready",
    columns: frameInput.columns,
    rows: buildTableWidgetRowObjects(frameInput.columns, frameInput.rows),
    fields: schemaFallback.map((column) => buildFrameFieldSchemaFromTableColumn(column)),
  } satisfies TabularFrameSourceV1;
  const computedFrame =
    computedColumns.length > 0
      ? applyResolvedTableComputedColumns(sourceFrame, computedColumns)
      : sourceFrame;
  const columns = uniqueStrings([...computedFrame.columns, ...formulaColumnKeys]);

  return {
    ...frameInput,
    columns,
    rows: computedFrame.rows.map((row) => columns.map((columnKey) => normalizeCellValue(row[columnKey]))),
    schemaFallback,
  } satisfies TableWidgetResolvedFrameInput;
}

export function applyTableWidgetFormulaColumnsToPublishedFrame(
  props: Pick<TableWidgetProps, "formulasEnabled" | "schema">,
  frame: TabularFrameSourceV1,
) {
  const formulasEnabled = normalizeTableWidgetFormulasEnabled(props.formulasEnabled);
  const frameInput = buildResolvedFrameInputFromPublishedFrame(frame);
  const schema = resolveTableWidgetSchemaFromFrame(props, frameInput);
  const formulaColumnKeys = schema
    .filter((column) => column.format === "formula")
    .map((column) => column.key);
  const { computedColumns } = resolveTableWidgetFormulaColumns(formulasEnabled, schema);
  const nextFrame =
    computedColumns.length > 0
      ? applyResolvedTableComputedColumns(frame, computedColumns)
      : frame;

  if (formulaColumnKeys.length === 0) {
    return nextFrame;
  }

  const columns = uniqueStrings([...nextFrame.columns, ...formulaColumnKeys]);
  const existingFieldKeys = new Set((nextFrame.fields ?? []).map((field) => field.key));
  const fields = [
    ...(nextFrame.fields ?? []),
    ...schema.flatMap((column) => {
      if (column.format !== "formula" || existingFieldKeys.has(column.key)) {
        return [];
      }

      return [buildFrameFieldSchemaFromTableColumn(column)];
    }),
  ];

  return {
    ...nextFrame,
    columns,
    fields: fields.length > 0 ? fields : undefined,
  } satisfies TabularFrameSourceV1;
}

function normalizeColumnSchema(value: unknown): TableWidgetColumnSchema | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetColumnSchema;
  if (typeof record.key !== "string" || !record.key.trim()) {
    return undefined;
  }

  if (typeof record.label !== "string" || !record.label.trim()) {
    return undefined;
  }

  if (
    record.format !== "text" &&
    record.format !== "datetime" &&
    record.format !== "number" &&
    record.format !== "currency" &&
    record.format !== "percent" &&
    record.format !== "bps" &&
    record.format !== "formula"
  ) {
    return undefined;
  }

  const nextValue: TableWidgetColumnSchema = {
    key: record.key.trim(),
    label: record.label.trim(),
    format: record.format,
  };

  if (typeof record.description === "string" && record.description.trim()) {
    nextValue.description = record.description.trim();
  }

  if (record.format === "formula") {
    if (typeof record.formulaExpression === "string") {
      nextValue.formulaExpression = record.formulaExpression;
    }

    if (normalizeTableWidgetFormulaResultFormat(record.formulaResultFormat)) {
      nextValue.formulaResultFormat = record.formulaResultFormat;
    }
  }

  if (typeof record.minWidth === "number" && Number.isFinite(record.minWidth)) {
    nextValue.minWidth = Math.max(60, Math.trunc(record.minWidth));
  }

  if (typeof record.flex === "number" && Number.isFinite(record.flex)) {
    nextValue.flex = Math.max(0, record.flex);
  }

  if (record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.dateTimeInputFormat === "string" && record.dateTimeInputFormat.trim()) {
    nextValue.dateTimeInputFormat = record.dateTimeInputFormat.trim();
  }

  if (typeof record.dateTimeOutputFormat === "string" && record.dateTimeOutputFormat.trim()) {
    nextValue.dateTimeOutputFormat = record.dateTimeOutputFormat.trim();
  }

  if (typeof record.categorical === "boolean") {
    nextValue.categorical = record.categorical;
  }

  if (typeof record.heatmapEligible === "boolean") {
    nextValue.heatmapEligible = record.heatmapEligible;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  return nextValue;
}

function normalizeColumnSchemas(value: unknown, fallback: readonly TableWidgetColumnSchema[] = []) {
  if (!Array.isArray(value)) {
    return cloneTableWidgetSchema(fallback);
  }

  const seenKeys = new Set<string>();
  const normalized = value.flatMap((entry) => {
    const nextEntry = normalizeColumnSchema(entry);

    if (!nextEntry || seenKeys.has(nextEntry.key)) {
      return [];
    }

    seenKeys.add(nextEntry.key);
    return [nextEntry];
  });

  return normalized;
}

export function cloneTableWidgetSchema(
  columns: readonly TableWidgetColumnSchema[],
): TableWidgetColumnSchema[] {
  return columns.map((column) => ({ ...column }));
}

export function moveTableWidgetSchemaColumn(
  columns: readonly TableWidgetColumnSchema[],
  fromIndex: number,
  toIndex: number,
): TableWidgetColumnSchema[] {
  const nextColumns = cloneTableWidgetSchema(columns);

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= nextColumns.length ||
    toIndex >= nextColumns.length ||
    fromIndex === toIndex
  ) {
    return nextColumns;
  }

  const [movedColumn] = nextColumns.splice(fromIndex, 1);

  if (!movedColumn) {
    return nextColumns;
  }

  nextColumns.splice(toIndex, 0, movedColumn);
  return nextColumns;
}

function normalizeColumnOverride(value: unknown): TableWidgetColumnOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetColumnOverride;
  const nextValue: TableWidgetColumnOverride = {};

  if (typeof record.visible === "boolean") {
    nextValue.visible = record.visible;
  }

  if (typeof record.label === "string" && record.label.trim()) {
    nextValue.label = record.label.trim();
  }

  if (
    record.format === "auto" ||
    record.format === "text" ||
    record.format === "datetime" ||
    record.format === "number" ||
    record.format === "currency" ||
    record.format === "percent" ||
    record.format === "bps"
  ) {
    nextValue.format = record.format;
  }

  if (typeof record.decimals === "number" && Number.isFinite(record.decimals)) {
    nextValue.decimals = Math.max(0, Math.min(Math.trunc(record.decimals), 6));
  }

  if (typeof record.prefix === "string") {
    nextValue.prefix = record.prefix;
  }

  if (typeof record.suffix === "string") {
    nextValue.suffix = record.suffix;
  }

  if (typeof record.dateTimeInputFormat === "string" && record.dateTimeInputFormat.trim()) {
    nextValue.dateTimeInputFormat = record.dateTimeInputFormat.trim();
  }

  if (typeof record.dateTimeOutputFormat === "string" && record.dateTimeOutputFormat.trim()) {
    nextValue.dateTimeOutputFormat = record.dateTimeOutputFormat.trim();
  }

  if (typeof record.heatmap === "boolean") {
    nextValue.heatmap = record.heatmap;
  }

  if (typeof record.compact === "boolean") {
    nextValue.compact = record.compact;
  }

  if (record.barMode === "fill" || record.barMode === "none") {
    nextValue.barMode = record.barMode;
  }

  if (record.gradientMode === "fill" || record.gradientMode === "none") {
    nextValue.gradientMode = record.gradientMode;
  }

  if (
    record.heatmapPalette === "auto" ||
    record.heatmapPalette === "viridis" ||
    record.heatmapPalette === "plasma" ||
    record.heatmapPalette === "inferno" ||
    record.heatmapPalette === "magma" ||
    record.heatmapPalette === "turbo" ||
    record.heatmapPalette === "jet" ||
    record.heatmapPalette === "blue-white-red" ||
    record.heatmapPalette === "red-yellow-green"
  ) {
    nextValue.heatmapPalette = record.heatmapPalette;
  }

  if (record.gaugeMode === "ring" || record.gaugeMode === "none") {
    nextValue.gaugeMode = record.gaugeMode;
  }

  if (record.visualRangeMode === "auto" || record.visualRangeMode === "fixed") {
    nextValue.visualRangeMode = record.visualRangeMode;
  }

  if (typeof record.visualMin === "number" && Number.isFinite(record.visualMin)) {
    nextValue.visualMin = record.visualMin;
  }

  if (typeof record.visualMax === "number" && Number.isFinite(record.visualMax)) {
    nextValue.visualMax = record.visualMax;
  }

  if (
    record.align === "auto" ||
    record.align === "left" ||
    record.align === "center" ||
    record.align === "right"
  ) {
    nextValue.align = record.align;
  }

  if (record.pinned === "none" || record.pinned === "left" || record.pinned === "right") {
    nextValue.pinned = record.pinned;
  }

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
}

function normalizeValueLabel(value: unknown): TableWidgetValueLabel | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetValueLabel;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  if (typeof record.value !== "string") {
    return undefined;
  }

  return {
    columnKey: record.columnKey.trim(),
    value: record.value,
    label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : undefined,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeConditionalRule(value: unknown): TableWidgetConditionalRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as TableWidgetConditionalRule;
  if (typeof record.columnKey !== "string" || !record.columnKey.trim()) {
    return undefined;
  }

  const numericValue = Number(record.value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  if (
    record.operator !== "gt" &&
    record.operator !== "gte" &&
    record.operator !== "lt" &&
    record.operator !== "lte" &&
    record.operator !== "eq"
  ) {
    return undefined;
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : createTableWidgetRuleId(),
    columnKey: record.columnKey.trim(),
    operator: record.operator,
    value: numericValue,
    tone: normalizeTone(record.tone),
    textColor: normalizeHexColor(record.textColor),
    backgroundColor: normalizeHexColor(record.backgroundColor),
  };
}

function normalizeColumnOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, override]) => {
      const normalized = normalizeColumnOverride(override);
      return normalized ? [[key, normalized] as const] : [];
    }),
  ) satisfies Record<string, TableWidgetColumnOverride>;
}

function stripSchemaManagedFieldsFromColumnOverrides(
  value: Record<string, TableWidgetColumnOverride> | undefined,
) {
  return Object.fromEntries(
    Object.entries(normalizeColumnOverrides(value)).flatMap(([key, override]) => {
      const nextOverride = { ...override };
      delete nextOverride.label;
      delete nextOverride.format;

      return Object.keys(nextOverride).length > 0 ? [[key, nextOverride] as const] : [];
    }),
  ) satisfies Record<string, TableWidgetColumnOverride>;
}

const legacyShippedColumnOverrides: Record<string, TableWidgetColumnOverride> = {
  quantity: { barMode: "fill" },
  pnl: { barMode: "fill", heatmap: true },
  exposure: { heatmap: true, compact: true },
  conviction: { barMode: "fill", heatmap: true, suffix: " /10" },
  dayChangePct: { heatmap: true },
  utilizationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  fillRatePct: { barMode: "fill", heatmap: true, suffix: "%" },
  participationPct: { barMode: "fill", heatmap: true, suffix: "%" },
  avgFillMs: { barMode: "fill", heatmap: true, suffix: " ms" },
  notional: { barMode: "fill", heatmap: true, compact: true },
  score: { barMode: "fill", heatmap: true },
  slippageBps: { heatmap: true },
};

const legacyShippedValueLabels: TableWidgetValueLabel[] = [
  { columnKey: "side", value: "Long", label: "Long", tone: "primary" },
  { columnKey: "side", value: "Short", label: "Short", tone: "warning" },
  { columnKey: "status", value: "Active", label: "Active", tone: "success" },
  { columnKey: "status", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "status", value: "Trim", label: "Trim", tone: "primary" },
  { columnKey: "status", value: "Reduce", label: "Reduce", tone: "danger" },
  { columnKey: "status", value: "Healthy", label: "Healthy", tone: "success" },
  { columnKey: "status", value: "Critical", label: "Critical", tone: "danger" },
  { columnKey: "regime", value: "Stable", label: "Stable", tone: "success" },
  { columnKey: "regime", value: "Watch", label: "Watch", tone: "warning" },
  { columnKey: "regime", value: "Crowded", label: "Crowded", tone: "warning" },
  { columnKey: "regime", value: "Protective", label: "Protective", tone: "primary" },
  { columnKey: "regime", value: "Hot", label: "Hot", tone: "danger" },
];

const legacyShippedConditionalRules: TableWidgetConditionalRule[] = [
  { id: "pnl-positive", columnKey: "pnl", operator: "gt", value: 0, tone: "primary" },
  { id: "pnl-negative", columnKey: "pnl", operator: "lt", value: 0, tone: "danger" },
  { id: "drawdown-risk", columnKey: "drawdownPct", operator: "lt", value: -5, tone: "danger" },
  { id: "exec-watch", columnKey: "slippageBps", operator: "gt", value: 1.5, tone: "warning" },
  { id: "utilization-hot", columnKey: "utilizationPct", operator: "gt", value: 80, tone: "danger" },
  { id: "reject-rate-hot", columnKey: "rejectRatePct", operator: "gt", value: 1, tone: "danger" },
  { id: "score-low", columnKey: "score", operator: "lt", value: 6, tone: "warning" },
];

function serializeColumnOverridesForComparison(
  value: Record<string, TableWidgetColumnOverride> | undefined,
) {
  const normalized = normalizeColumnOverrides(value);

  return JSON.stringify(
    Object.keys(normalized)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, normalized[key]]),
  );
}

function serializeValueLabelsForComparison(value: TableWidgetValueLabel[] | undefined) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeValueLabel(entry))
      .filter((entry): entry is TableWidgetValueLabel => Boolean(entry)),
  );
}

function serializeConditionalRulesForComparison(
  value: TableWidgetConditionalRule[] | undefined,
) {
  return JSON.stringify(
    (value ?? [])
      .map((entry) => normalizeConditionalRule(entry))
      .filter((entry): entry is TableWidgetConditionalRule => Boolean(entry)),
  );
}

const legacyShippedColumnOverridesSignature =
  serializeColumnOverridesForComparison(legacyShippedColumnOverrides);
const legacyShippedValueLabelsSignature =
  serializeValueLabelsForComparison(legacyShippedValueLabels);
const legacyShippedConditionalRulesSignature =
  serializeConditionalRulesForComparison(legacyShippedConditionalRules);

export function stripLegacyTableWidgetDisplayConfig(
  props: TableWidgetProps,
): TableWidgetProps {
  const nextProps: TableWidgetProps = { ...props };

  if (
    serializeColumnOverridesForComparison(props.columnOverrides) ===
    legacyShippedColumnOverridesSignature
  ) {
    nextProps.columnOverrides = {};
  }

  if (
    serializeValueLabelsForComparison(props.valueLabels) ===
    legacyShippedValueLabelsSignature
  ) {
    nextProps.valueLabels = [];
  }

  if (
    serializeConditionalRulesForComparison(props.conditionalRules) ===
    legacyShippedConditionalRulesSignature
  ) {
    nextProps.conditionalRules = [];
  }

  return nextProps;
}

export function createTableWidgetRuleId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `table-rule-${uuid}` : `table-rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildTableWidgetRowObjects(
  columns: readonly string[],
  rows: readonly TableWidgetFrameRow[],
) {
  return rows.map<TableWidgetRow>((row) =>
    Object.fromEntries(
      columns.map((columnKey, index) => [columnKey, normalizeCellValue(row[index])]),
    ),
  );
}

function resolveTableWidgetSchemaFromFrame(
  props: Pick<TableWidgetProps, "columnOverrides" | "schema">,
  frameInput: Pick<
    TableWidgetResolvedFrameInput,
    "columns" | "rows" | "schemaFallback"
  >,
) {
  const schemaFallback =
    frameInput.schemaFallback.length > 0
      ? frameInput.schemaFallback
      : createSchemaTemplateFromFrame(frameInput.columns, frameInput.rows);

  if (Array.isArray(props.schema)) {
    const normalizedSchema = normalizeColumnSchemas(props.schema, []);

    if (schemaFallback.length === 0) {
      return normalizedSchema;
    }

    const normalizedSchemaByKey = new Map(
      normalizedSchema.map((column) => [column.key, column] as const),
    );

    return cloneTableWidgetSchema(schemaFallback).map((column) => {
      const savedColumn = normalizedSchemaByKey.get(column.key);

      return savedColumn
        ? {
            ...column,
            ...savedColumn,
            key: column.key,
          }
        : column;
    }).concat(
      normalizedSchema
        .filter((column) => !schemaFallback.some((entry) => entry.key === column.key))
        .map((column) => ({ ...column })),
    );
  }

  const normalizedOverrides = normalizeColumnOverrides(props.columnOverrides);

  return cloneTableWidgetSchema(schemaFallback).map((column) => {
    const override = normalizedOverrides[column.key];

    return {
      ...column,
      label: override?.label ?? column.label,
      format:
        override?.format && override.format !== "auto"
          ? override.format
          : column.format,
    };
  });
}

export function resolveTableWidgetPropsWithFrame(
  props: TableWidgetProps,
  frameInput?: TableWidgetResolvedFrameInput | null,
): ResolvedTableWidgetProps {
  const migratedProps = stripLegacyTableWidgetDisplayConfig(props);
  const normalizedSourceReference = normalizeTabularWidgetSourceReferenceProps(migratedProps);
  const tableSourceMode = normalizeTableSourceMode(migratedProps.tableSourceMode);
  const normalizedSourceId = normalizePositiveInteger(migratedProps.sourceId);
  const normalizedFixedStartMs = normalizeTimestampMs(migratedProps.fixedStartMs);
  const normalizedFixedEndMs = normalizeTimestampMs(migratedProps.fixedEndMs);
  const normalizedUniqueIdentifierList = normalizeUniqueIdentifierList(
    migratedProps.uniqueIdentifierList,
  );
  const normalizedLimit =
    normalizePositiveInteger(migratedProps.limit) ?? defaultRemoteLimit;
  const manualColumns = normalizeManualTableColumns(migratedProps.manualColumns);
  const manualRows = normalizeManualTableRows(migratedProps.manualRows);
  const resolvedFrameInput =
    tableSourceMode === "manual"
      ? buildTableWidgetFrameFromManualData({
          manualColumns,
          manualRows,
        })
      : frameInput;
  const resolvedFrameWithLocalFormulas = applyTableWidgetFormulaColumnsToResolvedFrameInput(
    migratedProps,
    resolvedFrameInput,
  );
  const columns = normalizeFrameColumns(resolvedFrameWithLocalFormulas?.columns, []);
  const rows = normalizeFrameRows(resolvedFrameWithLocalFormulas?.rows, columns.length);
  const sourceColumnOverrides = normalizeColumnOverrides(
    resolvedFrameWithLocalFormulas?.sourceColumnOverrides,
  );
  const localColumnOverrides = stripSchemaManagedFieldsFromColumnOverrides(
    migratedProps.columnOverrides,
  );
  const schema = resolveTableWidgetSchemaFromFrame(
    migratedProps,
    {
      columns,
      rows,
      schemaFallback: resolvedFrameWithLocalFormulas?.schemaFallback ?? [],
    },
  );

  return {
    tableSourceMode,
    sourceId: normalizedSourceId,
    sourceLabel:
      resolvedFrameInput?.sourceLabel ??
      (normalizedSourceId
        ? formatTabularSourceLabel({ id: normalizedSourceId, storage_hash: "", identifier: null })
        : undefined),
    dateRangeMode: normalizeDateRangeMode(migratedProps.dateRangeMode),
    fixedStartMs: normalizedFixedStartMs,
    fixedEndMs: normalizedFixedEndMs,
    sourceMode: tableSourceMode === "manual" ? "direct" : "filter_widget",
    sourceWidgetId:
      tableSourceMode === "manual" ? undefined : normalizedSourceReference.sourceWidgetId,
    uniqueIdentifierList: normalizedUniqueIdentifierList,
    manualColumns,
    manualRows,
    limit: normalizedLimit,
    supportsUniqueIdentifierList: Boolean(resolvedFrameInput?.supportsUniqueIdentifierList),
    formulasEnabled: normalizeTableWidgetFormulasEnabled(migratedProps.formulasEnabled),
    columns,
    rows,
    schema,
    density: migratedProps.density === "compact" ? "compact" : "comfortable",
    groupBy: normalizeGroupBy(migratedProps.groupBy),
    showToolbar: migratedProps.showToolbar !== false,
    showSearch: migratedProps.showSearch !== false,
    showColumnFilters: migratedProps.showColumnFilters !== false,
    zebraRows: migratedProps.zebraRows !== false,
    pagination: migratedProps.pagination !== false,
    pageSize:
      typeof migratedProps.pageSize === "number" && Number.isFinite(migratedProps.pageSize)
        ? Math.max(5, Math.min(Math.trunc(migratedProps.pageSize), 200))
        : defaultPageSize,
    columnOverrides: {
      ...sourceColumnOverrides,
      ...localColumnOverrides,
    },
    valueLabels: Array.isArray(migratedProps.valueLabels)
      ? migratedProps.valueLabels
          .map((entry) => normalizeValueLabel(entry))
          .filter((entry): entry is TableWidgetValueLabel => Boolean(entry))
      : [],
    conditionalRules: [
      ...((resolvedFrameWithLocalFormulas?.sourceConditionalRules ?? [])
        .map((entry) => normalizeConditionalRule(entry))
        .filter((entry): entry is TableWidgetConditionalRule => Boolean(entry))),
      ...(Array.isArray(migratedProps.conditionalRules)
        ? migratedProps.conditionalRules
          .map((entry) => normalizeConditionalRule(entry))
          .filter((entry): entry is TableWidgetConditionalRule => Boolean(entry))
        : []),
    ],
    selectionMode: normalizeTableWidgetSelectionMode(migratedProps.selectionMode),
    selectionKeyFields: normalizeSelectionKeyFields(migratedProps.selectionKeyFields),
    publishSelectionOutputs: migratedProps.publishSelectionOutputs !== false,
  };
}

export function resolveTableWidgetProps(props: TableWidgetProps): ResolvedTableWidgetProps {
  return resolveTableWidgetPropsWithFrame(props);
}

export function resolveTableWidgetColumns(
  props: ResolvedTableWidgetProps,
) {
  const { errorsByKey } = resolveTableWidgetFormulaColumns(props.formulasEnabled, props.schema);

  return props.schema.map<ResolvedTableWidgetColumnConfig>((column) => {
    const override = props.columnOverrides[column.key] ?? {};
    const schemaFormat = column.format;
    const effectiveFormat =
      schemaFormat === "formula"
        ? (column.formulaResultFormat ?? "number")
        : override.format && override.format !== "auto"
          ? override.format
          : column.format;
    const numericFormat = isTableWidgetNumericFormat(effectiveFormat);

    return {
      ...column,
      schemaFormat,
      label: override.label ?? column.label,
      format: effectiveFormat,
      decimals: override.decimals ?? column.decimals,
      prefix: override.prefix ?? column.prefix,
      suffix: override.suffix ?? column.suffix,
      dateTimeInputFormat: override.dateTimeInputFormat ?? column.dateTimeInputFormat,
      dateTimeOutputFormat: override.dateTimeOutputFormat ?? column.dateTimeOutputFormat,
      compact: override.compact ?? column.compact ?? false,
      visible: override.visible ?? true,
      heatmap: numericFormat ? (override.heatmap ?? false) : false,
      barMode: numericFormat ? (override.barMode ?? "none") : "none",
      gradientMode:
        numericFormat
          ? ((override.gradientMode ?? ((override.heatmap ?? false) ? "fill" : "none")) as TableWidgetGradientMode)
          : "none",
      heatmapPalette:
        numericFormat
          ? (override.heatmapPalette ?? "auto")
          : "auto",
      gaugeMode: numericFormat ? (override.gaugeMode ?? "none") : "none",
      visualRangeMode: numericFormat ? (override.visualRangeMode ?? "auto") : "auto",
      visualMin:
        numericFormat && typeof override.visualMin === "number" && Number.isFinite(override.visualMin)
          ? override.visualMin
          : undefined,
      visualMax:
        numericFormat && typeof override.visualMax === "number" && Number.isFinite(override.visualMax)
          ? override.visualMax
          : undefined,
      formulaError: errorsByKey.get(column.key),
      align:
        override.align && override.align !== "auto"
          ? override.align
          : numericFormat
            ? "right"
            : "left",
      pinned:
        override.pinned && override.pinned !== "none"
          ? override.pinned
          : column.pinned,
    };
  });
}

export function getTableWidgetNumericValue(value: TableWidgetCellValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getTableWidgetValueLabel(
  props: ResolvedTableWidgetProps,
  columnKey: string,
  value: TableWidgetCellValue,
) {
  const lookupValue = value == null ? "" : String(value);
  return (
    props.valueLabels.find(
      (entry) => entry.columnKey === columnKey && entry.value === lookupValue,
    ) ?? null
  );
}

export function getTableWidgetColumnRange(
  rows: TableWidgetRow[],
  columnKey: string,
) {
  const values = rows
    .map((row) => getTableWidgetNumericValue(row[columnKey]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function getTableWidgetCategoricalValues(
  rows: readonly TableWidgetRow[],
  columnKey: string,
) {
  const values = new Set<string>();

  rows.forEach((row) => {
    const value = row[columnKey];
    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  });

  return [...values.values()];
}

export function validateTableWidgetSchema(
  rows: readonly TableWidgetRow[],
  columns: readonly (Pick<ResolvedTableWidgetColumnConfig, "format" | "key"> & {
    schemaFormat?: ResolvedTableWidgetColumnConfig["schemaFormat"];
  })[],
): TableWidgetSchemaValidationResult {
  const issues: TableWidgetSchemaValidationIssue[] = [];

  if (columns.length === 0) {
    issues.push({ code: "empty_schema" });
    return {
      isValid: false,
      issues,
    };
  }

  if (rows.length === 0) {
    return {
      isValid: true,
      issues,
    };
  }

  const sampledRows = rows.slice(0, 50);
  const missingColumns = columns
    .filter((column) => column.schemaFormat !== "formula")
    .filter((column) =>
      sampledRows.every((row) => !Object.prototype.hasOwnProperty.call(row, column.key)),
    )
    .map((column) => column.key);

  if (missingColumns.length > 0) {
    issues.push({
      code: "missing_columns",
      columnKeys: missingColumns,
    });
  }

  const nonNumericColumns = columns
    .filter((column) => isTableWidgetNumericFormat(column.format))
    .filter((column) => {
      const values = sampledRows
        .map((row) => row[column.key])
        .filter((value) => value !== null && value !== undefined && value !== "");

      if (values.length === 0) {
        return false;
      }

      return values.every((value) => getTableWidgetNumericValue(value) === null);
    })
    .map((column) => column.key);

  if (nonNumericColumns.length > 0) {
    issues.push({
      code: "non_numeric_columns",
      columnKeys: nonNumericColumns,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function formatTableWidgetValue(
  value: TableWidgetCellValue,
  column: Pick<
    ResolvedTableWidgetColumnConfig,
    | "compact"
    | "dateTimeInputFormat"
    | "dateTimeOutputFormat"
    | "decimals"
    | "format"
    | "prefix"
    | "suffix"
  >,
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.format === "text") {
    return `${column.prefix ?? ""}${String(value)}${column.suffix ?? ""}`;
  }

  if (column.format === "datetime") {
    const timestampMs = parseTableWidgetDateTimeValue(value, column.dateTimeInputFormat);

    if (timestampMs === null) {
      return String(value);
    }

    const outputFormat = normalizeDateTimePattern(column.dateTimeOutputFormat) ??
      TABLE_WIDGET_DEFAULT_DATETIME_OUTPUT_FORMAT;

    return `${column.prefix ?? ""}${formatDateTimeWithPattern(timestampMs, outputFormat)}${column.suffix ?? ""}`;
  }

  const numericValue = getTableWidgetNumericValue(value);

  if (numericValue === null) {
    return String(value);
  }

  const digits = column.decimals ?? (column.format === "currency" ? 2 : column.format === "percent" || column.format === "bps" ? 1 : 0);
  const notation = column.compact ? "compact" : "standard";
  const formatterKey = `${column.format}:${digits}:${notation}`;
  const formatter = getNumberFormatter(formatterKey, () => {
    if (column.format === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }

    return new Intl.NumberFormat("en-US", {
      notation,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  });

  let formatted = formatter.format(numericValue);

  if (column.format === "percent") {
    formatted = `${formatted}%`;
  } else if (column.format === "bps") {
    formatted = `${formatted} bps`;
  }

  return `${column.prefix ?? ""}${formatted}${column.suffix ?? ""}`;
}

export function evaluateTableWidgetRule(
  value: number,
  rule: Pick<TableWidgetConditionalRule, "operator" | "value">,
) {
  if (rule.operator === "gt") {
    return value > rule.value;
  }

  if (rule.operator === "gte") {
    return value >= rule.value;
  }

  if (rule.operator === "lt") {
    return value < rule.value;
  }

  if (rule.operator === "lte") {
    return value <= rule.value;
  }

  return value === rule.value;
}

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function getNumberFormatter(key: string, factory: () => Intl.NumberFormat) {
  const existing = numberFormatterCache.get(key);

  if (existing) {
    return existing;
  }

  const nextFormatter = factory();
  numberFormatterCache.set(key, nextFormatter);
  return nextFormatter;
}

export const tableWidgetDateRangeModeOptions: Array<{
  value: TableWidgetDateRangeMode;
  label: string;
  description: string;
}> = [
  {
    value: "dashboard",
    label: "Dashboard date",
    description: "Keep the table in sync with the current dashboard range.",
  },
  {
    value: "fixed",
    label: "Fixed date",
    description: "Use a saved start and end date for this widget only.",
  },
];

export const tableWidgetFormatOptions: Array<{
  value: TableWidgetColumnFormat;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "text", label: "Text" },
  { value: "datetime", label: "Date/time" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "bps", label: "Bps" },
  { value: "formula", label: "Formula" },
];

export const tableWidgetDensityOptions: Array<{
  value: TableWidgetDensity;
  label: string;
}> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const tableWidgetBarModeOptions: Array<{
  value: TableWidgetBarMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Filled bar" },
];

export const tableWidgetGradientModeOptions: Array<{
  value: TableWidgetGradientMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "fill", label: "Gradient fill" },
];

export const tableWidgetHeatmapPaletteOptions: Array<{
  value: TableWidgetHeatmapPalette;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "viridis", label: "Viridis" },
  { value: "plasma", label: "Plasma" },
  { value: "inferno", label: "Inferno" },
  { value: "magma", label: "Magma" },
  { value: "turbo", label: "Turbo" },
  { value: "jet", label: "Jet" },
  { value: "blue-white-red", label: "Blue-White-Red" },
  { value: "red-yellow-green", label: "Red-Yellow-Green" },
];

export const tableWidgetGaugeModeOptions: Array<{
  value: TableWidgetGaugeMode;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "ring", label: "Ring gauge" },
];

export const tableWidgetRangeModeOptions: Array<{
  value: TableWidgetRangeMode;
  label: string;
}> = [
  { value: "auto", label: "Auto bounds" },
  { value: "fixed", label: "Fixed bounds" },
];

export const tableWidgetAlignOptions: Array<{
  value: TableWidgetAlign;
  label: string;
}> = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const tableWidgetPinnedOptions: Array<{
  value: TableWidgetPinned;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const tableWidgetOperatorOptions: Array<{
  value: TableWidgetOperator;
  label: string;
}> = [
  { value: "gt", label: "> greater than" },
  { value: "gte", label: ">= greater or equal" },
  { value: "lt", label: "< less than" },
  { value: "lte", label: "<= less or equal" },
  { value: "eq", label: "= equal" },
];

export const tableWidgetToneOptions: Array<{
  value: TableWidgetTone;
  label: string;
}> = [
  { value: "neutral", label: "Neutral" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

export const tableWidgetDefaultProps: TableWidgetProps = {
  tableSourceMode: "bound",
  manualColumns: [],
  manualRows: [],
  schema: [],
  density: "comfortable",
  groupBy: undefined,
  showToolbar: true,
  showSearch: true,
  showColumnFilters: true,
  zebraRows: true,
  pagination: true,
  pageSize: 10,
  columnOverrides: {},
  valueLabels: [],
  conditionalRules: [],
  formulasEnabled: false,
  selectionMode: "none",
  selectionKeyFields: [],
  publishSelectionOutputs: true,
};
