import {
  buildMarketAssetScreenerRuntimeModelFromTabularFrames,
  deriveMarketAssetScreenerRows,
  MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
  MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
  MARKET_ASSET_SCREENER_SEED_INPUT_ID,
  type MarketAssetHistorySeriesFieldMapping,
  type MarketAssetReferencePointsFieldMapping,
  type MarketAssetScreenerColumn,
  type MarketAssetScreenerRow,
  type MarketAssetScreenerRuntimeModel,
  type MarketAssetSnapshotFieldMapping,
} from "../../widget-contracts/marketAssetFrames";
import { materializeRuntimeTabularFrame, type RuntimeDataStore } from "@/widgets/shared/runtime-data-store";
import type { TabularFrameSourceV1 } from "@/widgets/shared/tabular-frame-source";
import type { ResolvedWidgetInput, ResolvedWidgetInputs } from "@/widgets/types";

export type MainSequenceAssetScreenerDensity = "compact" | "comfortable";
export type MainSequenceAssetScreenerSortDirection = "asc" | "desc";

export interface MainSequenceAssetScreenerSort {
  columnId: string;
  direction: MainSequenceAssetScreenerSortDirection;
}

export interface MainSequenceAssetScreenerFieldMappings {
  seed?: MarketAssetSnapshotFieldMapping;
  reference?: MarketAssetReferencePointsFieldMapping;
  live?: MarketAssetSnapshotFieldMapping;
  history?: MarketAssetHistorySeriesFieldMapping;
}

export interface MainSequenceAssetScreenerWidgetProps extends Record<string, unknown> {
  columns?: MarketAssetScreenerColumn[];
  density?: MainSequenceAssetScreenerDensity;
  fieldMappings?: MainSequenceAssetScreenerFieldMappings;
  filterText?: string;
  groupBy?: string;
  maxRenderedRows?: number;
  showDiagnostics?: boolean;
  sort?: MainSequenceAssetScreenerSort;
  staleAfterMs?: number;
}

export interface MainSequenceAssetScreenerResolvedState {
  runtimeModel: MarketAssetScreenerRuntimeModel;
  rows: MarketAssetScreenerRow[];
  filteredRows: MarketAssetScreenerRow[];
  hasAnyBinding: boolean;
  sourceStatuses: {
    seed?: ResolvedWidgetInput["status"];
    reference?: ResolvedWidgetInput["status"];
    history?: ResolvedWidgetInput["status"];
    live?: ResolvedWidgetInput["status"];
  };
}

export interface MainSequenceAssetScreenerFallbackFrames {
  seedData?: TabularFrameSourceV1 | null;
  referenceData?: TabularFrameSourceV1 | null;
  historyData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
}

export const assetScreenerDefaultColumns: MarketAssetScreenerColumn[] = [
  {
    id: "symbol",
    kind: "asset-field",
    label: "Symbol",
    field: "symbol",
    width: 120,
    groupable: true,
  },
  {
    id: "name",
    kind: "asset-field",
    label: "Name",
    field: "displayName",
    width: 220,
  },
  {
    id: "trend",
    kind: "sparkline",
    label: "Trend",
    valueField: "price",
    width: 118,
  },
  {
    id: "last",
    kind: "latest-value",
    label: "Last",
    valueField: "price",
    format: "price",
    width: 96,
  },
  {
    id: "net",
    kind: "return",
    label: "Net Chg",
    referenceKey: "previousClose",
    valueField: "price",
    returnMode: "absolute",
    format: "price",
    width: 94,
  },
  {
    id: "pct",
    kind: "return",
    label: "% Chg",
    referenceKey: "previousClose",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 86,
  },
  {
    id: "mtd",
    kind: "return",
    label: "1M",
    referenceKey: "oneMonthAgo",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "ytd",
    kind: "return",
    label: "YTD",
    referenceKey: "yearStart",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "oneYear",
    kind: "return",
    label: "1Y",
    referenceKey: "oneYearAgo",
    valueField: "price",
    returnMode: "percent",
    format: "percent",
    width: 76,
  },
  {
    id: "sector",
    kind: "asset-field",
    label: "Sector",
    field: "sector",
    width: 150,
    groupable: true,
  },
];

export const assetScreenerDefaultProps = {
  columns: assetScreenerDefaultColumns,
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
    return assetScreenerDefaultColumns;
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

  return columns.length > 0 ? columns : assetScreenerDefaultColumns;
}

function normalizeFieldMappings(value: unknown): MainSequenceAssetScreenerFieldMappings | undefined {
  return isPlainRecord(value)
    ? {
        seed: isPlainRecord(value.seed) ? value.seed : undefined,
        reference: isPlainRecord(value.reference) ? value.reference : undefined,
        live: isPlainRecord(value.live) ? value.live : undefined,
        history: isPlainRecord(value.history) ? value.history : undefined,
      }
    : undefined;
}

export function normalizeAssetScreenerProps(
  props: MainSequenceAssetScreenerWidgetProps | Record<string, unknown> | undefined,
): MainSequenceAssetScreenerWidgetProps {
  const value = props ?? {};

  return {
    columns: normalizeColumns(value.columns),
    density: normalizeDensity(value.density),
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
    ? [input.upstreamDelta, input.value, input.upstreamBase]
    : [input.upstreamBase, input.value, input.upstreamDelta];

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

export function resolveAssetScreenerState(input: {
  fallbackFrames?: MainSequenceAssetScreenerFallbackFrames;
  props: MainSequenceAssetScreenerWidgetProps;
  resolvedInputs?: ResolvedWidgetInputs;
  runtimeDataStore?: RuntimeDataStore | null;
}): MainSequenceAssetScreenerResolvedState {
  const props = normalizeAssetScreenerProps(input.props);
  const seedInput = firstResolvedInput(input.resolvedInputs, MARKET_ASSET_SCREENER_SEED_INPUT_ID);
  const referenceInput = firstResolvedInput(
    input.resolvedInputs,
    MARKET_ASSET_SCREENER_REFERENCE_INPUT_ID,
  );
  const liveInput = firstResolvedInput(
    input.resolvedInputs,
    MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID,
  );
  const historyInput = firstResolvedInput(
    input.resolvedInputs,
    MARKET_ASSET_SCREENER_HISTORY_INPUT_ID,
  );
  const seedData =
    materializeResolvedInput(seedInput, input.runtimeDataStore) ??
    input.fallbackFrames?.seedData ??
    null;
  const referenceData =
    materializeResolvedInput(referenceInput, input.runtimeDataStore) ??
    input.fallbackFrames?.referenceData ??
    null;
  const liveUpdates =
    materializeResolvedInput(liveInput, input.runtimeDataStore, "delta") ??
    input.fallbackFrames?.liveUpdates ??
    null;
  const historyData =
    materializeResolvedInput(historyInput, input.runtimeDataStore) ??
    input.fallbackFrames?.historyData ??
    null;
  const runtimeModel = buildMarketAssetScreenerRuntimeModelFromTabularFrames({
    seedData,
    referenceData,
    historyData,
    liveUpdates,
    seedMapping: props.fieldMappings?.seed,
    referenceMapping: props.fieldMappings?.reference,
    liveMapping: props.fieldMappings?.live,
    historyMapping: props.fieldMappings?.history,
  });

  const rows = deriveMarketAssetScreenerRows(runtimeModel, props.columns ?? []);
  const sortedRows = sortRows(filterRows(rows, props.filterText), props.sort);

  return {
    runtimeModel,
    rows,
    filteredRows: sortedRows.slice(0, props.maxRenderedRows),
    hasAnyBinding: Boolean(
      seedInput ||
      referenceInput ||
      historyInput ||
      liveInput ||
      seedData ||
      referenceData ||
      historyData ||
      liveUpdates,
    ),
    sourceStatuses: {
      seed: seedInput?.status,
      reference: referenceInput?.status,
      history: historyInput?.status,
      live: liveInput?.status,
    },
  };
}
