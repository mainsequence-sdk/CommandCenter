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
import {
  stripLegacyTableWidgetDisplayConfig,
  type TableWidgetProps,
} from "@/widgets/core/table/tableModel";
import { resolveIncrementalTabularBindingSnapshot } from "@/widgets/shared/incremental-tabular-consumer";
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
  sourceColumns?: MarketAssetScreenerColumn[];
  sourceFrame?: TabularFrameSourceV1 | null;
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

function normalizeColumnSignatureEntry(column: {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  field?: unknown;
  valueField?: unknown;
  referenceKey?: unknown;
  returnMode?: unknown;
}) {
  return {
    id: typeof column.id === "string" ? column.id : null,
    kind: typeof column.kind === "string" ? column.kind : null,
    label: typeof column.label === "string" ? column.label : null,
    field: typeof column.field === "string" ? column.field : null,
    valueField: typeof column.valueField === "string" ? column.valueField : null,
    referenceKey: typeof column.referenceKey === "string" ? column.referenceKey : null,
    returnMode: typeof column.returnMode === "string" ? column.returnMode : null,
  };
}

function serializeColumnsForComparison(columns: unknown) {
  if (!Array.isArray(columns)) {
    return "[]";
  }

  return JSON.stringify(columns.map((column) =>
    normalizeColumnSignatureEntry(isPlainRecord(column) ? column : {}),
  ));
}

const legacyShippedAssetScreenerColumnsSignature = JSON.stringify([
  {
    id: "symbol",
    kind: "asset-field",
    label: "Symbol",
    field: "symbol",
    valueField: null,
    referenceKey: null,
    returnMode: null,
  },
  {
    id: "name",
    kind: "asset-field",
    label: "Name",
    field: "displayName",
    valueField: null,
    referenceKey: null,
    returnMode: null,
  },
  {
    id: "trend",
    kind: "sparkline",
    label: "Trend",
    field: null,
    valueField: "price",
    referenceKey: null,
    returnMode: null,
  },
  {
    id: "last",
    kind: "latest-value",
    label: "Last",
    field: null,
    valueField: "price",
    referenceKey: null,
    returnMode: null,
  },
  {
    id: "net",
    kind: "return",
    label: "Net Chg",
    field: null,
    valueField: "price",
    referenceKey: "previousClose",
    returnMode: "absolute",
  },
  {
    id: "pct",
    kind: "return",
    label: "% Chg",
    field: null,
    valueField: "price",
    referenceKey: "previousClose",
    returnMode: "percent",
  },
  {
    id: "mtd",
    kind: "return",
    label: "1M",
    field: null,
    valueField: "price",
    referenceKey: "oneMonthAgo",
    returnMode: "percent",
  },
  {
    id: "ytd",
    kind: "return",
    label: "YTD",
    field: null,
    valueField: "price",
    referenceKey: "yearStart",
    returnMode: "percent",
  },
  {
    id: "oneYear",
    kind: "return",
    label: "1Y",
    field: null,
    valueField: "price",
    referenceKey: "oneYearAgo",
    returnMode: "percent",
  },
  {
    id: "sector",
    kind: "asset-field",
    label: "Sector",
    field: "sector",
    valueField: null,
    referenceKey: null,
    returnMode: null,
  },
]);

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
): MainSequenceAssetScreenerColumnConfigMode {
  return value === "custom" ? "custom" : "source";
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

  const columns = value.flatMap((entry) => {
    if (!isPlainRecord(entry) || !normalizeString(entry.id) || !normalizeString(entry.label)) {
      return [];
    }

    if (
      entry.kind !== "asset-field" &&
      entry.kind !== "latest-value" &&
      entry.kind !== "reference-value" &&
      entry.kind !== "return" &&
      entry.kind !== "sparkline"
    ) {
      return [];
    }

    const { visual: _ignoredVisual, ...rest } = entry;
    return [rest as MarketAssetScreenerColumn];
  });

  return columns.length > 0 ? columns : undefined;
}

export function prepareAssetScreenerColumnsForPersistence(
  columns: MarketAssetScreenerColumn[] | undefined,
) : MarketAssetScreenerColumn[] | undefined {
  return normalizeColumns(
    columns?.map((column) =>
      "visual" in column
        ? (() => {
            const { visual: _ignoredVisual, ...rest } = column;
            return rest;
          })()
        : column,
    ),
  );
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
  if (!isPlainRecord(value)) {
    return undefined;
  }

  return stripLegacyTableWidgetDisplayConfig(value as TableWidgetProps);
}

export function stripLegacyAssetScreenerDisplayConfig(
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined,
): MainSequenceAssetScreenerWidgetProps | Record<string, unknown> {
  const value = props ?? {};

  if (
    serializeColumnsForComparison(isPlainRecord(value) ? value.columns : undefined) !==
    legacyShippedAssetScreenerColumnsSignature
  ) {
    return value;
  }

  return {
    ...value,
    columnConfigMode: "source",
    columns: undefined,
  };
}

export function normalizeAssetScreenerProps(
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined,
): MainSequenceAssetScreenerWidgetProps {
  const value = stripLegacyAssetScreenerDisplayConfig(props);
  const columns = normalizeColumns(value.columns);

  return {
    assetScreenerSourceMode: normalizeAssetScreenerSourceMode(value.assetScreenerSourceMode),
    columnConfigMode: normalizeAssetScreenerColumnConfigMode(value.columnConfigMode),
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

function sourceIdentityFieldIsGroupable(field: string | undefined) {
  return field === "sector" ||
    field === "industry" ||
    field === "group" ||
    field === "assetClass" ||
    field === "country";
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

  const buildColumnForField = (
    field: string,
    visual: MarketTableVisualColumnMetadata | undefined,
  ): MarketAssetScreenerColumn | null => {
    const role = roleByField.get(field);
    const label = visual?.label ?? computedLabels.get(field) ?? fieldLabels.get(field) ?? (
      visual?.kind === "sparkline" || role?.role === "sparklineSeries"
        ? "Trend"
        : humanizeFieldLabel(field)
    );

    if (visual?.kind === "sparkline" || role?.role === "sparklineSeries") {
      return {
        id: field,
        kind: "sparkline",
        label,
        valueField: role?.valueKey ?? valueFieldForSourceField(field),
        width: sourceColumnWidth("sparkline", field, visual),
        visual,
      };
    }

    if (role?.role === "referenceValue" && role.referenceKey && role.valueKey) {
      return visual
        ? {
            id: field,
            kind: "reference-value",
            label,
            referenceKey: role.referenceKey,
            valueField: role.valueKey,
            format: visual.format,
            width: sourceColumnWidth("reference-value", field, visual),
            visual,
          }
        : null;
    }

    if (role?.role === "value" && role.valueKey) {
      return {
        id: field,
        kind: "latest-value",
        label,
        valueField: role.valueKey,
        format: visual?.format,
        width: sourceColumnWidth("latest-value", field, visual),
        visual,
      };
    }

    const identityField = role ? identityFieldForRole(role.role) : identityFieldForSourceField(field);

    if (identityField) {
      if (identityField === "assetKey" || identityField === "tags") {
        return null;
      }

      if (
        identityField === "displayName" &&
        !visual &&
        fieldRoles.some((candidate) => candidate.role === "symbol")
      ) {
        return null;
      }

      return {
        id: field,
        kind: "asset-field",
        label,
        field: identityField,
        width: sourceColumnWidth("asset-field", identityField, visual),
        groupable: sourceIdentityFieldIsGroupable(identityField),
        visual,
      };
    }

    return {
      id: field,
      kind: "latest-value",
      label,
      valueField: valueFieldForSourceField(field),
      format: visual?.format,
      width: sourceColumnWidth("latest-value", field, visual),
      visual,
    };
  };

  const explicitVisualColumns = Object.entries(visualColumns);

  if (explicitVisualColumns.length > 0) {
    explicitVisualColumns.forEach(([field, visual]) => {
      addColumn(buildColumnForField(field, visual));
    });

    return columns.length > 0 ? columns : null;
  }

  for (const role of fieldRoles) {
    addColumn(buildColumnForField(role.field, undefined));
  }

  for (const [field, label] of computedLabels) {
    addColumn(buildColumnForField(field, visualColumns[field] ?? { label }));
  }

  return columns.length > 0 ? columns : null;
}

export function resolveAssetScreenerColumnConfig(input: {
  canonicalSourceFrame?: TabularFrameSourceV1 | null;
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
    buildSourceColumnsFromFrame(input.canonicalSourceFrame) ??
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

export function resolveAssetScreenerSourceFrame(input: {
  seedData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
}) {
  if (buildSourceColumnsFromFrame(input.seedData)) {
    return input.seedData ?? null;
  }

  if (buildSourceColumnsFromFrame(input.liveUpdates)) {
    return input.liveUpdates ?? null;
  }

  return input.seedData ?? input.liveUpdates ?? null;
}

function resolveAssetScreenerCanonicalSourceFrame(input: {
  fallbackFrames?: MainSequenceAssetScreenerFallbackFrames;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}) {
  const snapshot = resolveIncrementalTabularBindingSnapshot({
    resolvedInputs: input.resolvedInputs,
    runtimeDataStore: input.runtimeDataStore,
  });

  return snapshot.dataset ?? resolveAssetScreenerSourceFrame(input.fallbackFrames ?? {});
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
    canonicalSourceFrame: resolveAssetScreenerCanonicalSourceFrame({
      resolvedInputs: input.resolvedInputs,
      runtimeDataStore: input.runtimeDataStore,
    }),
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
  canonicalSourceFrame?: TabularFrameSourceV1 | null;
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
  const canonicalSourceFrame =
    input.canonicalSourceFrame ??
    resolveAssetScreenerCanonicalSourceFrame({
      fallbackFrames: input.fallbackFrames,
      resolvedInputs: input.resolvedInputs,
      runtimeDataStore: input.runtimeDataStore,
    });
  const runtimeModel = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
    seedData,
    liveUpdates,
    seedMapping: props.fieldMappings?.seed,
    liveMapping: props.fieldMappings?.live,
  });
  const columnConfig = resolveAssetScreenerColumnConfig({
    canonicalSourceFrame,
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
    sourceColumns: columnConfig.sourceColumns,
    sourceFrame: canonicalSourceFrame,
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
