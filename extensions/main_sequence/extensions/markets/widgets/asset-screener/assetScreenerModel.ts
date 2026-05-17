import {
  buildMarketAssetScreenerRuntimeModelFromTabularFrames,
  deriveMarketAssetScreenerRows,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
  resolveMarketAssetFrameSemanticMetadata,
  resolveMarketTableTransformsMetadata,
  resolveMarketTableVisualsMetadata,
  type MarketAssetFrameFieldRoleBinding,
  type MarketAssetIdentity,
  type MarketAssetScreenerColumn,
  type MarketAssetScreenerRow,
  type MarketAssetScreenerRuntimeModel,
  type MarketAssetSnapshotFieldMapping,
  type MarketTableVisualColumnMetadata,
} from "../../widget-contracts/marketAssetFrames";
import type { ConnectionQueryWidgetProps } from "@/widgets/core/connection-query/connectionQueryModel";
import type { ConnectionStreamQueryWidgetProps } from "@/widgets/core/connection-stream-query/connectionStreamQueryModel";
import type { TableWidgetProps } from "@/widgets/core/table/tableModel";
import { materializeRuntimeTabularFrame, type RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInput, ResolvedWidgetInputs, WidgetInstancePresentation } from "@/widgets/types";

export type MainSequenceAssetScreenerDensity = "compact" | "comfortable";
export type MainSequenceAssetScreenerSortDirection = "asc" | "desc";
export type MainSequenceAssetScreenerSourceMode = "bound" | "connection" | "connection-stream";
export type MainSequenceAssetScreenerColumnConfigMode = "source" | "custom";

export interface MainSequenceAssetScreenerSort {
  columnId: string;
  direction: MainSequenceAssetScreenerSortDirection;
}

export interface MainSequenceAssetScreenerFieldMappings {
  seed?: MarketAssetSnapshotFieldMapping;
  live?: MarketAssetSnapshotFieldMapping;
}

export interface MainSequenceAssetScreenerWidgetProps extends Record<string, unknown> {
  assetScreenerSourceMode?: MainSequenceAssetScreenerSourceMode;
  columnConfigMode?: MainSequenceAssetScreenerColumnConfigMode;
  columns?: MarketAssetScreenerColumn[];
  density?: MainSequenceAssetScreenerDensity;
  embeddedConnectionPresentation?: WidgetInstancePresentation;
  embeddedConnectionQuery?: ConnectionQueryWidgetProps | ConnectionStreamQueryWidgetProps;
  fieldMappings?: MainSequenceAssetScreenerFieldMappings;
  filterText?: string;
  groupBy?: string;
  maxRenderedRows?: number;
  showDiagnostics?: boolean;
  sort?: MainSequenceAssetScreenerSort;
  staleAfterMs?: number;
  table?: Partial<TableWidgetProps>;
}

export interface MainSequenceAssetScreenerResolvedState {
  columnConfigSource: MainSequenceAssetScreenerColumnConfigMode | "empty";
  columns: MarketAssetScreenerColumn[];
  runtimeModel: MarketAssetScreenerRuntimeModel;
  rows: MarketAssetScreenerRow[];
  filteredRows: MarketAssetScreenerRow[];
  hasAnyBinding: boolean;
  sourceStatuses: {
    seed?: ResolvedWidgetInput["status"];
    live?: ResolvedWidgetInput["status"];
  };
}

export interface MainSequenceAssetScreenerFallbackFrames {
  seedData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
}

export const assetScreenerDefaultProps = {
  assetScreenerSourceMode: "bound",
  columnConfigMode: "source",
  density: "compact",
  groupBy: "sector",
  maxRenderedRows: 500,
  showDiagnostics: true,
  sort: {
    columnId: "pct",
    direction: "desc",
  },
  staleAfterMs: 5 * 60 * 1000,
} satisfies MainSequenceAssetScreenerWidgetProps;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeDensity(value: unknown): MainSequenceAssetScreenerDensity {
  return value === "comfortable" ? "comfortable" : "compact";
}

export function normalizeAssetScreenerSourceMode(value: unknown): MainSequenceAssetScreenerSourceMode {
  return value === "connection" || value === "connection-stream" ? value : "bound";
}

export function normalizeAssetScreenerColumnConfigMode(
  value: unknown,
  hasCustomColumns: boolean,
): MainSequenceAssetScreenerColumnConfigMode {
  if (value === "source") {
    return "source";
  }

  if (value === "custom" || hasCustomColumns) {
    return "custom";
  }

  return "source";
}

function normalizeSort(value: unknown): MainSequenceAssetScreenerSort | undefined {
  if (!isPlainRecord(value)) {
    return assetScreenerDefaultProps.sort;
  }

  const columnId = normalizeString(value.columnId);

  if (!columnId) {
    return undefined;
  }

  return {
    columnId,
    direction: value.direction === "asc" ? "asc" : "desc",
  };
}

function normalizeColumns(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const columns = value.filter((entry): entry is MarketAssetScreenerColumn => {
    if (!isPlainRecord(entry) || !normalizeString(entry.id) || !normalizeString(entry.label)) {
      return false;
    }

    return entry.kind === "asset-field" ||
      entry.kind === "latest-value" ||
      entry.kind === "reference-value" ||
      entry.kind === "return" ||
      entry.kind === "sparkline";
  });

  return columns.length > 0 ? columns : undefined;
}

function normalizeFieldMappings(value: unknown): MainSequenceAssetScreenerFieldMappings | undefined {
  return isPlainRecord(value)
    ? {
        seed: isPlainRecord(value.seed) ? value.seed : undefined,
        live: isPlainRecord(value.live) ? value.live : undefined,
      }
    : undefined;
}

function normalizeTableSettings(value: unknown): Partial<TableWidgetProps> | undefined {
  return isPlainRecord(value) ? (value as Partial<TableWidgetProps>) : undefined;
}

export function normalizeAssetScreenerProps(
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined,
): MainSequenceAssetScreenerWidgetProps {
  const value = props ?? {};
  const columns = normalizeColumns(value.columns);

  return {
    assetScreenerSourceMode: normalizeAssetScreenerSourceMode(value.assetScreenerSourceMode),
    columnConfigMode: normalizeAssetScreenerColumnConfigMode(value.columnConfigMode, Boolean(columns)),
    columns,
    density: normalizeDensity(value.density),
    embeddedConnectionPresentation: isPlainRecord(value.embeddedConnectionPresentation)
      ? (value.embeddedConnectionPresentation as WidgetInstancePresentation)
      : undefined,
    embeddedConnectionQuery: isPlainRecord(value.embeddedConnectionQuery)
      ? (value.embeddedConnectionQuery as ConnectionQueryWidgetProps | ConnectionStreamQueryWidgetProps)
      : undefined,
    fieldMappings: normalizeFieldMappings(value.fieldMappings),
    filterText: normalizeString(value.filterText),
    groupBy: normalizeString(value.groupBy),
    maxRenderedRows: normalizePositiveInteger(
      value.maxRenderedRows,
      assetScreenerDefaultProps.maxRenderedRows,
    ),
    showDiagnostics: value.showDiagnostics !== false,
    sort: normalizeSort(value.sort),
    staleAfterMs: normalizeNonNegativeNumber(
      value.staleAfterMs,
      assetScreenerDefaultProps.staleAfterMs,
    ),
    table: normalizeTableSettings(value.table),
  };
}

function firstResolvedInput(
  resolvedInputs: ResolvedWidgetInputs | undefined,
  inputId: string,
) {
  const input = resolvedInputs?.[inputId];
  return Array.isArray(input) ? input[0] : input;
}

function materializeResolvedInput(
  input: ResolvedWidgetInput | undefined,
  store: RuntimeDataStore | null | undefined,
  mode: "base" | "delta" = "base",
): TabularFrameSourceV1 | null {
  if (!input || input.status !== "valid") {
    return null;
  }

  const candidates = mode === "delta"
    ? [input.upstreamDelta, input.upstreamDeltaRef, input.value, input.valueRef, input.upstreamBase, input.upstreamBaseRef]
    : [input.upstreamBase, input.upstreamBaseRef, input.value, input.valueRef, input.upstreamDelta, input.upstreamDeltaRef];

  for (const candidate of candidates) {
    const frame = materializeRuntimeTabularFrame(candidate, store);

    if (frame) {
      return frame;
    }
  }

  return null;
}

function rowSearchText(row: MarketAssetScreenerRow) {
  return [
    row.asset.assetKey,
    row.asset.symbol,
    row.asset.displayName,
    row.asset.exchange,
    row.asset.currency,
    row.asset.country,
    row.asset.assetClass,
    row.asset.sector,
    row.asset.industry,
    row.asset.group,
    ...(row.asset.tags ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function compareMetricValue(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "number") {
    return 1;
  }

  if (typeof right === "number") {
    return -1;
  }

  return String(left ?? "").localeCompare(String(right ?? ""));
}

function sortRows(
  rows: MarketAssetScreenerRow[],
  sort: MainSequenceAssetScreenerSort | undefined,
) {
  if (!sort) {
    return rows;
  }

  const direction = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) =>
    compareMetricValue(left.metrics[sort.columnId], right.metrics[sort.columnId]) * direction ||
    (left.asset.symbol ?? left.asset.assetKey).localeCompare(right.asset.symbol ?? right.asset.assetKey),
  );
}

function filterRows(rows: MarketAssetScreenerRow[], filterText: string | undefined) {
  const normalizedFilter = filterText?.trim().toLowerCase();

  if (!normalizedFilter) {
    return rows;
  }

  return rows.filter((row) => rowSearchText(row).includes(normalizedFilter));
}

function humanizeFieldLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeFieldMatch(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function identityFieldForRole(role: MarketAssetFrameFieldRoleBinding["role"]) {
  return role === "assetKey" ||
    role === "symbol" ||
    role === "displayName" ||
    role === "exchange" ||
    role === "currency" ||
    role === "country" ||
    role === "assetClass" ||
    role === "sector" ||
    role === "industry" ||
    role === "group" ||
    role === "tags"
    ? role
    : null;
}

function identityFieldForSourceField(field: string): keyof MarketAssetIdentity | null {
  const normalized = normalizeFieldMatch(field);

  if (normalized === "symbol" || normalized === "ticker") {
    return "symbol";
  }

  if (normalized === "displayname" || normalized === "name" || normalized === "assetname") {
    return "displayName";
  }

  if (normalized === "exchange" || normalized === "venue") {
    return "exchange";
  }

  if (normalized === "currency" || normalized === "ccy") {
    return "currency";
  }

  if (normalized === "country" || normalized === "region") {
    return "country";
  }

  if (normalized === "assetclass" || normalized === "class") {
    return "assetClass";
  }

  if (normalized === "sector" || normalized === "marketsector" || normalized === "securitymarketsector") {
    return "sector";
  }

  if (normalized === "industry" || normalized === "industrygroup") {
    return "industry";
  }

  if (normalized === "group" || normalized === "basket" || normalized === "category") {
    return "group";
  }

  return null;
}

function valueFieldForSourceField(field: string) {
  const normalized = normalizeFieldMatch(field);

  if (
    normalized === "price" ||
    normalized === "px" ||
    normalized === "pxlast" ||
    normalized === "lastprice" ||
    normalized === "last" ||
    normalized === "close" ||
    normalized === "sparklineprices" ||
    normalized === "pricesparkline"
  ) {
    return "price";
  }

  if (normalized === "volume" || normalized === "vol") {
    return "volume";
  }

  if (normalized === "marketcap" || normalized === "mktcap") {
    return "marketCap";
  }

  return field;
}

function sourceColumnWidth(
  kind: MarketAssetScreenerColumn["kind"],
  field: string,
  visual: MarketTableVisualColumnMetadata | undefined,
) {
  if (typeof visual?.width === "number" && Number.isFinite(visual.width) && visual.width > 0) {
    return Math.trunc(visual.width);
  }

  if (visual?.kind === "sparkline" || kind === "sparkline") {
    return 118;
  }

  if (field === "displayName" || field === "name" || field === "display_name") {
    return 220;
  }

  if (field === "sector" || field === "industry" || field === "group") {
    return 150;
  }

  if (visual?.format === "percent") {
    return 76;
  }

  return kind === "asset-field" ? 120 : 96;
}

function buildSourceColumnsFromFrame(
  frame: TabularFrameSourceV1 | null | undefined,
): MarketAssetScreenerColumn[] | null {
  const semanticMetadata = resolveMarketAssetFrameSemanticMetadata(frame);
  if (!frame) {
    return null;
  }

  const visualColumns = resolveMarketTableVisualsMetadata(frame)?.columns ?? {};
  const computedLabels = new Map(
    (resolveMarketTableTransformsMetadata(frame)?.computedColumns ?? []).map((column) => [
      column.id,
      column.label ?? humanizeFieldLabel(column.id),
    ]),
  );
  const fieldLabels = new Map(
    (frame?.fields ?? []).flatMap((field) =>
      field.label ? [[field.key, field.label] as const] : [],
    ),
  );
  const allowedFields = new Set([
    ...(frame?.columns ?? []),
    ...computedLabels.keys(),
  ]);
  const fieldRoles = (semanticMetadata?.fieldRoles ?? []).filter((role) => allowedFields.has(role.field));
  const roleByField = new Map(fieldRoles.map((role) => [role.field, role]));
  const columns: MarketAssetScreenerColumn[] = [];
  const addedColumnIds = new Set<string>();

  const addColumn = (column: MarketAssetScreenerColumn | null) => {
    if (!column || addedColumnIds.has(column.id)) {
      return;
    }

    columns.push(column);
    addedColumnIds.add(column.id);
  };

  for (const role of fieldRoles) {
    const identityField = identityFieldForRole(role.role);

    if (identityField) {
      if (identityField === "assetKey" || identityField === "tags") {
        continue;
      }

      if (
        identityField === "displayName" &&
        !visualColumns[role.field] &&
        fieldRoles.some((candidate) => candidate.role === "symbol")
      ) {
        continue;
      }

      addColumn({
        id: role.field,
        kind: "asset-field",
        label: fieldLabels.get(role.field) ?? visualColumns[role.field]?.label ?? humanizeFieldLabel(role.field),
        field: identityField,
        width: sourceColumnWidth("asset-field", identityField, visualColumns[role.field]),
        groupable: identityField === "sector" ||
          identityField === "industry" ||
          identityField === "group" ||
          identityField === "assetClass" ||
          identityField === "country",
        visual: visualColumns[role.field],
      });
      continue;
    }

    const label = visualColumns[role.field]?.label ?? fieldLabels.get(role.field) ?? humanizeFieldLabel(role.field);

    if (visualColumns[role.field]) {
      continue;
    }

    if (role.role === "sparklineSeries") {
      addColumn({
        id: role.field,
        kind: "sparkline",
        label,
        valueField: role.valueKey ?? valueFieldForSourceField(role.field),
        width: sourceColumnWidth("sparkline", role.field, visualColumns[role.field]),
        visual: visualColumns[role.field],
      });
      continue;
    }

    if (role.role === "value" && role.valueKey) {
      addColumn({
        id: role.field,
        kind: "latest-value",
        label,
        valueField: role.valueKey,
        format: visualColumns[role.field]?.format,
        width: sourceColumnWidth("latest-value", role.field, visualColumns[role.field]),
        visual: visualColumns[role.field],
      });
    }
  }

  for (const [field, visual] of Object.entries(visualColumns)) {
    const role = roleByField.get(field);
    const label = visual.label ?? computedLabels.get(field) ?? fieldLabels.get(field) ?? (
      visual.kind === "sparkline" || role?.role === "sparklineSeries"
        ? "Trend"
        : humanizeFieldLabel(field)
    );

    if (visual.kind === "sparkline" || role?.role === "sparklineSeries") {
      addColumn({
        id: field,
        kind: "sparkline",
        label,
        valueField: role?.valueKey ?? valueFieldForSourceField(field),
        width: sourceColumnWidth("sparkline", field, visual),
        visual,
      });
      continue;
    }

    if (role?.role === "referenceValue" && role.referenceKey && role.valueKey) {
      addColumn({
        id: field,
        kind: "reference-value",
        label,
        referenceKey: role.referenceKey,
        valueField: role.valueKey,
        format: visual.format,
        width: sourceColumnWidth("reference-value", field, visual),
        visual,
      });
      continue;
    }

    if (role?.role === "value" && role.valueKey) {
      addColumn({
        id: field,
        kind: "latest-value",
        label,
        valueField: role.valueKey,
        format: visual.format,
        width: sourceColumnWidth("latest-value", field, visual),
        visual,
      });
      continue;
    }

    const identityField = role ? identityFieldForRole(role.role) : identityFieldForSourceField(field);

    if (identityField) {
      addColumn({
        id: field,
        kind: "asset-field",
        label,
        field: identityField,
        width: sourceColumnWidth("asset-field", identityField, visual),
        visual,
      });
      continue;
    }

    addColumn({
      id: field,
      kind: "latest-value",
      label,
      valueField: valueFieldForSourceField(field),
      format: visual.format,
      width: sourceColumnWidth("latest-value", field, visual),
      visual,
    });
  }

  for (const [field, label] of computedLabels) {
    addColumn({
      id: field,
      kind: "latest-value",
      label,
      valueField: valueFieldForSourceField(field),
      format: visualColumns[field]?.format,
      width: sourceColumnWidth("latest-value", field, visualColumns[field]),
      visual: visualColumns[field],
    });
  }

  return columns.length > 0 ? columns : null;
}

export function resolveAssetScreenerColumnConfig(input: {
  liveUpdates?: TabularFrameSourceV1 | null;
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined;
  seedData?: TabularFrameSourceV1 | null;
}): {
  columns: MarketAssetScreenerColumn[];
  source: MainSequenceAssetScreenerColumnConfigMode | "empty";
  sourceColumns?: MarketAssetScreenerColumn[];
} {
  const props = normalizeAssetScreenerProps(input.props);
  const sourceColumns =
    buildSourceColumnsFromFrame(input.seedData) ??
    buildSourceColumnsFromFrame(input.liveUpdates) ??
    undefined;

  if (props.columnConfigMode === "custom" && props.columns && props.columns.length > 0) {
    return {
      columns: props.columns,
      source: "custom",
      sourceColumns,
    };
  }

  if (sourceColumns && sourceColumns.length > 0) {
    return {
      columns: sourceColumns,
      source: "source",
      sourceColumns,
    };
  }

  return {
    columns: [],
    source: "empty",
    sourceColumns,
  };
}

export function resolveAssetScreenerColumnConfigFromResolvedInputs(input: {
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): ReturnType<typeof resolveAssetScreenerColumnConfig> {
  const seedInput = firstResolvedInput(input.resolvedInputs, MARKET_ASSET_SCREENER_SEED_INPUT_ID);
  const liveInput = firstResolvedInput(
    input.resolvedInputs,
    MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  );

  return resolveAssetScreenerColumnConfig({
    props: input.props,
    seedData: materializeResolvedInput(seedInput, input.runtimeDataStore),
    liveUpdates: materializeResolvedInput(liveInput, input.runtimeDataStore, "delta"),
  });
}

function resolveSort(
  columns: MarketAssetScreenerColumn[],
  sort: MainSequenceAssetScreenerSort | undefined,
) {
  if (sort && columns.some((column) => column.id === sort.columnId)) {
    return sort;
  }

  const sourceDefaultColumn = columns.find((column) =>
    column.kind === "latest-value" && column.format === "percent",
  );

  return sourceDefaultColumn
    ? {
        columnId: sourceDefaultColumn.id,
        direction: "desc" as const,
      }
    : undefined;
}

export function resolveAssetScreenerState(input: {
  fallbackFrames?: MainSequenceAssetScreenerFallbackFrames;
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): MainSequenceAssetScreenerResolvedState {
  const props = normalizeAssetScreenerProps(input.props);
  const seedInput = firstResolvedInput(input.resolvedInputs, MARKET_ASSET_SCREENER_SEED_INPUT_ID);
  const liveInput = firstResolvedInput(
    input.resolvedInputs,
    MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  );
  const seedData =
    materializeResolvedInput(seedInput, input.runtimeDataStore) ??
    input.fallbackFrames?.seedData ??
    null;
  const liveUpdates =
    materializeResolvedInput(liveInput, input.runtimeDataStore, "delta") ??
    input.fallbackFrames?.liveUpdates ??
    null;
  const runtimeModel = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
    seedData,
    liveUpdates,
    seedMapping: props.fieldMappings?.seed,
    liveMapping: props.fieldMappings?.live,
  });
  const columnConfig = resolveAssetScreenerColumnConfig({
    props,
    seedData,
    liveUpdates,
  });

  const rows = deriveMarketAssetScreenerRows(runtimeModel, columnConfig.columns);
  const sortedRows = sortRows(
    filterRows(rows, props.filterText),
    resolveSort(columnConfig.columns, props.sort),
  );

  return {
    columnConfigSource: columnConfig.source,
    columns: columnConfig.columns,
    runtimeModel,
    rows,
    filteredRows: sortedRows.slice(0, props.maxRenderedRows),
    hasAnyBinding: Boolean(
      seedInput ||
      liveInput ||
      seedData ||
      liveUpdates,
    ),
    sourceStatuses: {
      seed: seedInput?.status,
      live: liveInput?.status,
    },
  };
}
