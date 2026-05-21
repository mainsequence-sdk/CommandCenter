import {
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
  normalizeTabularFrameSource,
  type TabularFrameFieldSchema,
  type TabularFrameSourceV1,
} from "@/widgets/shared/tabular-frame-source";
import {
  buildTableFrameMeta as buildSharedTableFrameMeta,
  resolveTableVisualsMetadata as resolveSharedTableVisualsMetadata,
  type TableFrameColorScaleMetadata as SharedTableFrameColorScaleMetadata,
  type TableFrameInlineSeriesEncoding as SharedTableFrameInlineSeriesEncoding,
  type TableFrameRangeMetadata as SharedTableFrameRangeMetadata,
  type TableFrameSeriesOrder as SharedTableFrameSeriesOrder,
  type TableFrameVisualBarMode as SharedTableFrameVisualBarMode,
  type TableFrameVisualColumnMetadata as SharedTableFrameVisualColumnMetadata,
  type TableFrameVisualGaugeMode as SharedTableFrameVisualGaugeMode,
  type TableFrameVisualGradientMode as SharedTableFrameVisualGradientMode,
  type TableFrameVisualHeatmapPalette as SharedTableFrameVisualHeatmapPalette,
  type TableFrameVisualOperator as SharedTableFrameVisualOperator,
  type TableFrameVisualRangeMode as SharedTableFrameVisualRangeMode,
  type TableFrameVisualsMetadata as SharedTableFrameVisualsMetadata,
  type TableFrameVisualTone as SharedTableFrameVisualTone,
  type TableFrameThresholdRuleMetadata as SharedTableFrameThresholdRuleMetadata,
} from "@/widgets/core/table/tableFrameMetadata";
import type { TabularMergeKeyMapping } from "@/widgets/shared/incremental-tabular-consumer";

export const MARKET_ASSET_SNAPSHOT_FRAME_ROLE = "snapshot" as const;
export const MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE = "reference-points" as const;
export const MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE = "history-series" as const;

export const MARKET_ASSET_FRAME_ROLES = [
  MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
  MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
  MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE,
] as const;

export type MarketAssetFrameSemanticRole = (typeof MARKET_ASSET_FRAME_ROLES)[number];
export type MarketAssetKey = string;
export type MarketAssetScalarValue = number | string | boolean | null;
export type MarketAssetValueQuality =
  | "exact"
  | "prior"
  | "next"
  | "interpolated"
  | "stale"
  | "unknown";
export type MarketAssetReferenceKind =
  | "previous-close"
  | "relative-offset"
  | "calendar-period-start"
  | "custom";
export type MarketAssetReferenceOffsetUnit =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";
export type MarketAssetFieldRole =
  | "assetKey"
  | "symbol"
  | "displayName"
  | "exchange"
  | "currency"
  | "country"
  | "assetClass"
  | "sector"
  | "industry"
  | "group"
  | "tags"
  | "observedAt"
  | "sequence"
  | "referenceKey"
  | "referenceLabel"
  | "referenceKind"
  | "offsetUnit"
  | "offsetValue"
  | "quality"
  | "value"
  | "referenceValue"
  | "sparklineSeries";

export type MarketAssetSparklineSeriesEncoding = SharedTableFrameInlineSeriesEncoding;
export type MarketAssetSparklineSeriesOrder = SharedTableFrameSeriesOrder;
export type MarketTableColorScaleMetadata = SharedTableFrameColorScaleMetadata;
export type MarketTableRangeMetadata = SharedTableFrameRangeMetadata;
export type MarketTableVisualTone = SharedTableFrameVisualTone;
export type MarketTableVisualOperator = SharedTableFrameVisualOperator;
export type MarketTableVisualBarMode = SharedTableFrameVisualBarMode;
export type MarketTableVisualGradientMode = SharedTableFrameVisualGradientMode;
export type MarketTableVisualHeatmapPalette = SharedTableFrameVisualHeatmapPalette;
export type MarketTableVisualGaugeMode = SharedTableFrameVisualGaugeMode;
export type MarketTableVisualRangeMode = SharedTableFrameVisualRangeMode;
export type MarketTableThresholdRuleMetadata = SharedTableFrameThresholdRuleMetadata;
export type MarketTableVisualColumnMetadata = SharedTableFrameVisualColumnMetadata;
export type MarketTableVisualsMetadata = SharedTableFrameVisualsMetadata;
export type MarketAssetScreenerColumnFormat = NonNullable<MarketTableVisualColumnMetadata["format"]>;

export interface MarketAssetIdentity {
  assetKey: MarketAssetKey;
  symbol?: string;
  displayName?: string;
  exchange?: string;
  currency?: string;
  country?: string;
  assetClass?: string;
  sector?: string;
  industry?: string;
  group?: string;
  tags?: string[];
}

export interface MarketAssetValuePoint {
  assetKey: MarketAssetKey;
  observedAtMs?: number;
  sequence?: number | string;
  sourceRunId?: string;
  values: Record<string, MarketAssetScalarValue>;
  quality?: MarketAssetValueQuality;
  diagnostics?: string[];
}

export interface MarketAssetReferencePoint extends MarketAssetValuePoint {
  referenceKey: string;
  referenceLabel?: string;
  referenceKind: MarketAssetReferenceKind;
  offset?: {
    unit: MarketAssetReferenceOffsetUnit;
    value: number;
  };
}

export interface MarketAssetScreenerRuntimeModel {
  schemaVersion: "market.asset_screener_runtime@v1";
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>;
  latestByKey: Record<MarketAssetKey, MarketAssetValuePoint>;
  referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>;
  historyByKey?: Record<MarketAssetKey, MarketAssetValuePoint[]>;
  visualsByKey?: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>>;
  sourceState: {
    seedRunId?: string;
    referenceRunId?: string;
    liveRunId?: string;
    historyRunId?: string;
    lastSeedAtMs?: number;
    lastReferenceAtMs?: number;
    lastLiveAtMs?: number;
    lastHistoryAtMs?: number;
  };
  warnings: string[];
}

export interface MarketAssetScreenerRow {
  asset: MarketAssetIdentity;
  latest: MarketAssetValuePoint | null;
  references: Record<string, MarketAssetReferencePoint | undefined>;
  history: MarketAssetValuePoint[];
  visuals: Record<string, MarketTableVisualColumnMetadata>;
  metrics: Record<string, MarketAssetScalarValue>;
  status: "ready" | "missing-latest" | "missing-reference" | "stale" | "error";
  diagnostics: string[];
}

export type MarketAssetScreenerColumn =
  | {
      id: string;
      kind: "asset-field";
      label: string;
      field: keyof MarketAssetIdentity | string;
      width?: number;
      groupable?: boolean;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "latest-value";
      label: string;
      valueField: string;
      format?: MarketAssetScreenerColumnFormat;
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "reference-value";
      label: string;
      referenceKey: string;
      valueField: string;
      format?: MarketAssetScreenerColumnFormat;
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "return";
      label: string;
      referenceKey: string;
      valueField: string;
      returnMode: "absolute" | "percent";
      format?: MarketAssetScreenerColumnFormat;
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    }
  | {
      id: string;
      kind: "sparkline";
      label: string;
      valueField: string;
      historyKey?: string;
      width?: number;
      visual?: MarketTableVisualColumnMetadata;
    };

export interface MarketAssetFieldRoleMetadata {
  role: MarketAssetFieldRole;
  label: string;
  description: string;
  required?: boolean;
  valueKeyRequired?: boolean;
}

export interface MarketAssetFrameFieldRoleBinding {
  field: string;
  role: MarketAssetFieldRole;
  valueKey?: string;
  referenceKey?: string;
  encoding?: MarketAssetSparklineSeriesEncoding;
  order?: MarketAssetSparklineSeriesOrder;
  required?: boolean;
  description?: string;
}

export interface MarketAssetFrameSemanticMetadata {
  role: MarketAssetFrameSemanticRole;
  fieldRoles: MarketAssetFrameFieldRoleBinding[];
}

export interface MarketAssetFrameRoleMetadata {
  role: MarketAssetFrameSemanticRole;
  title: string;
  description: string;
  fieldRoles: MarketAssetFieldRoleMetadata[];
  notes?: string[];
}

export interface MarketAssetIdentityFieldMapping {
  assetKeyField?: string;
  symbolField?: string;
  displayNameField?: string;
  exchangeField?: string;
  currencyField?: string;
  countryField?: string;
  assetClassField?: string;
  sectorField?: string;
  industryField?: string;
  groupField?: string;
  tagsField?: string;
}

export interface MarketAssetSnapshotFieldMapping extends MarketAssetIdentityFieldMapping {
  observedAtField?: string;
  sequenceField?: string;
  qualityField?: string;
  valueFields?: Record<string, string>;
}

export interface MarketAssetReferencePointsFieldMapping extends MarketAssetSnapshotFieldMapping {
  referenceKeyField?: string;
  referenceLabelField?: string;
  referenceKindField?: string;
  offsetUnitField?: string;
  offsetValueField?: string;
  wideReferenceValueFields?: Record<string, Record<string, string>>;
}

export interface MarketAssetHistorySeriesFieldMapping extends MarketAssetSnapshotFieldMapping {
  historyKeyField?: string;
}

export interface MarketAssetSnapshotAdapterResult {
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>;
  latestByKey: Record<MarketAssetKey, MarketAssetValuePoint>;
  referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>;
  historyByKey: Record<MarketAssetKey, MarketAssetValuePoint[]>;
  visualsByKey: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>>;
  warnings: string[];
  sourceRunId?: string;
  updatedAtMs?: number;
}

export interface MarketAssetReferencePointsAdapterResult {
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>;
  referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>;
  warnings: string[];
  sourceRunId?: string;
  updatedAtMs?: number;
}

export interface MarketAssetHistorySeriesAdapterResult {
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>;
  historyByKey: Record<MarketAssetKey, MarketAssetValuePoint[]>;
  warnings: string[];
  sourceRunId?: string;
  updatedAtMs?: number;
}

export interface BuildMarketAssetScreenerRuntimeModelInput {
  seedData?: TabularFrameSourceV1 | null;
  referenceFrame?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
  historyFrame?: TabularFrameSourceV1 | null;
  seedMapping?: MarketAssetSnapshotFieldMapping;
  referenceMapping?: MarketAssetReferencePointsFieldMapping;
  liveMapping?: MarketAssetSnapshotFieldMapping;
  liveMergeKeyMappings?: TabularMergeKeyMapping[];
  historyMapping?: MarketAssetHistorySeriesFieldMapping;
  previousModel?: MarketAssetScreenerRuntimeModel | null;
}

const semanticMetaKey = "marketAsset";
const tableVisualsMetaKey = "tableVisuals";

const identityRoleMetadata = [
  {
    role: "assetKey",
    label: "Asset key",
    description: "Optional row identity used when the source already provides one.",
  },
  {
    role: "symbol",
    label: "Symbol",
    description: "Display symbol. This is not assumed unique unless explicitly mapped as assetKey.",
  },
  {
    role: "displayName",
    label: "Display name",
    description: "Human-readable asset name.",
  },
  {
    role: "exchange",
    label: "Exchange",
    description: "Trading venue or exchange code.",
  },
  {
    role: "currency",
    label: "Currency",
    description: "Currency for the value fields in the frame.",
  },
  {
    role: "country",
    label: "Country",
    description: "Country or region used for filtering and grouping.",
  },
  {
    role: "assetClass",
    label: "Asset class",
    description: "Asset class used for filtering and grouping.",
  },
  {
    role: "sector",
    label: "Sector",
    description: "Market sector used for filtering and grouping.",
  },
  {
    role: "industry",
    label: "Industry",
    description: "Industry classification used for filtering and grouping.",
  },
  {
    role: "group",
    label: "Group",
    description: "Source-defined grouping bucket, such as basket or portfolio group.",
  },
  {
    role: "tags",
    label: "Tags",
    description: "Optional list or delimited string of asset tags.",
  },
] as const satisfies readonly MarketAssetFieldRoleMetadata[];

const valueRoleMetadata = [
  {
    role: "observedAt",
    label: "Observed at",
    required: true,
    description: "Observation timestamp for latest, reference, or historical values.",
  },
  {
    role: "sequence",
    label: "Sequence",
    description: "Optional source sequence used to choose the newest row when timestamps tie.",
  },
  {
    role: "quality",
    label: "Quality",
    description: "Optional quality marker such as exact, prior, interpolated, stale, or unknown.",
  },
  {
    role: "value",
    label: "Value",
    required: true,
    valueKeyRequired: true,
    description: "Named measure such as price, last, close, bid, ask, volume, or marketCap.",
  },
  {
    role: "referenceValue",
    label: "Reference value",
    valueKeyRequired: true,
    description: "Inline reference measure, such as previous close, carried on the same row as latest values.",
  },
  {
    role: "sparklineSeries",
    label: "Sparkline series",
    valueKeyRequired: true,
    description: "Compact low-resolution numeric series for inline sparklines, commonly encoded as CSV.",
  },
] as const satisfies readonly MarketAssetFieldRoleMetadata[];

export const MARKET_ASSET_FRAME_ROLE_METADATA = {
  [MARKET_ASSET_SNAPSHOT_FRAME_ROLE]: {
    role: MARKET_ASSET_SNAPSHOT_FRAME_ROLE,
    title: "Snapshot lane",
    description: "One latest/current observation per asset.",
    fieldRoles: [
      ...identityRoleMetadata,
      ...valueRoleMetadata,
    ],
    notes: [
      "Used for seedData and liveUpdates lanes.",
      "Live WebSocket updates may publish partial value rows. Use live merge mappings when the live row names differ from retained seed rows.",
    ],
  },
  [MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE]: {
    role: MARKET_ASSET_REFERENCE_POINTS_FRAME_ROLE,
    title: "Reference-points lane",
    description: "One historical reference point per asset per named reference key.",
    fieldRoles: [
      ...identityRoleMetadata,
      {
        role: "referenceKey",
        label: "Reference key",
        required: true,
        description: "Stable formula key such as previousClose, oneMonthAgo, yearStart, or oneYearAgo.",
      },
      {
        role: "referenceLabel",
        label: "Reference label",
        description: "Display label such as 1D, 1M, YTD, or 1Y.",
      },
      {
        role: "referenceKind",
        label: "Reference kind",
        description: "Reference semantics: previous-close, relative-offset, calendar-period-start, or custom.",
      },
      {
        role: "offsetUnit",
        label: "Offset unit",
        description: "Relative reference offset unit when referenceKind is relative-offset.",
      },
      {
        role: "offsetValue",
        label: "Offset value",
        description: "Relative reference offset value when referenceKind is relative-offset.",
      },
      ...valueRoleMetadata,
    ],
    notes: [
      "Used by internal long-form reference adapters and future Markets widgets.",
      "Reference keys are formula identifiers, not display labels.",
    ],
  },
  [MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE]: {
    role: MARKET_ASSET_HISTORY_SERIES_FRAME_ROLE,
    title: "History-series lane",
    description: "Bounded historical series for inline trend and sparkline columns.",
    fieldRoles: [
      ...identityRoleMetadata,
      ...valueRoleMetadata,
    ],
    notes: [
      "Used for optional compact history visualizations.",
      "This lane does not replace named reference points for return calculations.",
    ],
  },
} as const satisfies Record<MarketAssetFrameSemanticRole, MarketAssetFrameRoleMetadata>;

const assetKeyCandidates = [
  "assetKey",
  "asset_key",
  "instrumentId",
  "instrument_id",
  "securityId",
  "security_id",
  "uniqueIdentifier",
  "unique_identifier",
  "symbol",
  "ticker",
];

const fieldCandidatesByRole = {
  symbol: ["symbol", "ticker"],
  displayName: ["displayName", "display_name", "name", "assetName", "asset_name", "description"],
  exchange: ["exchange", "venue"],
  currency: ["currency", "ccy"],
  country: ["country", "region"],
  assetClass: ["assetClass", "asset_class", "class"],
  sector: ["sector", "security_market_sector", "marketSector", "market_sector"],
  industry: ["industry", "industryGroup", "industry_group"],
  group: ["group", "basket", "category"],
  tags: ["tags", "labels"],
  observedAt: ["observedAt", "observed_at", "timestamp", "time", "datetime", "date", "asOf", "as_of", "ts"],
  sequence: ["sequence", "seq", "eventSequence", "event_sequence"],
  quality: ["quality", "referenceQuality", "reference_quality"],
  referenceKey: ["referenceKey", "reference_key", "reference", "period", "horizon"],
  referenceLabel: ["referenceLabel", "reference_label", "periodLabel", "period_label"],
  referenceKind: ["referenceKind", "reference_kind"],
  offsetUnit: ["offsetUnit", "offset_unit"],
  offsetValue: ["offsetValue", "offset_value"],
} as const satisfies Record<
  Exclude<MarketAssetFieldRole, "assetKey" | "value" | "referenceValue" | "sparklineSeries">,
  readonly string[]
>;

const commonValueFieldKeys: Array<[string, readonly string[]]> = [
  ["price", ["price", "px", "px_last", "lastPrice", "last_price", "close", "last"]],
  ["last", ["last", "lastPrice", "last_price", "px_last"]],
  ["close", ["close", "closePrice", "close_price", "previousClose", "previous_close"]],
  ["open", ["open", "openPrice", "open_price"]],
  ["high", ["high", "highPrice", "high_price"]],
  ["low", ["low", "lowPrice", "low_price"]],
  ["bid", ["bid", "bidPrice", "bid_price"]],
  ["ask", ["ask", "askPrice", "ask_price", "offer", "offerPrice", "offer_price"]],
  ["volume", ["volume", "vol"]],
  ["marketCap", ["marketCap", "market_cap", "mktCap", "mkt_cap"]],
];

export function isMarketAssetFrameSemanticRole(value: unknown): value is MarketAssetFrameSemanticRole {
  return (
    typeof value === "string" &&
    MARKET_ASSET_FRAME_ROLES.includes(value as MarketAssetFrameSemanticRole)
  );
}

export function getMarketAssetFrameRoleMetadata(
  role: MarketAssetFrameSemanticRole,
): MarketAssetFrameRoleMetadata {
  return MARKET_ASSET_FRAME_ROLE_METADATA[role];
}

export function buildMarketAssetFrameSemanticMeta(
  metadata: MarketAssetFrameSemanticMetadata,
): Record<typeof semanticMetaKey, MarketAssetFrameSemanticMetadata> {
  return {
    [semanticMetaKey]: metadata,
  };
}

export function buildMarketTableFrameMeta(metadata: {
  tableVisuals?: MarketTableVisualsMetadata;
}): {
  [tableVisualsMetaKey]?: MarketTableVisualsMetadata;
} {
  return buildSharedTableFrameMeta(metadata);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function normalizeKey(value: unknown) {
  return normalizeString(value);
}

function normalizeFieldName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeFieldNameForMatch(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeSparklineSeriesEncoding(value: unknown): MarketAssetSparklineSeriesEncoding | undefined {
  return value === "csv-number" || value === "json-number-array" || value === "number-array"
    ? value
    : undefined;
}

function normalizeSparklineSeriesOrder(value: unknown): MarketAssetSparklineSeriesOrder | undefined {
  return value === "oldest-to-newest" || value === "newest-to-oldest" ? value : undefined;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    const normalized = value.flatMap((entry) => {
      const nextValue = normalizeString(entry);
      return nextValue ? [nextValue] : [];
    });

    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value === "string") {
    const normalized = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function normalizeValue(value: unknown): MarketAssetScalarValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function normalizeQuality(value: unknown): MarketAssetValueQuality | undefined {
  return value === "exact" ||
    value === "prior" ||
    value === "next" ||
    value === "interpolated" ||
    value === "stale" ||
    value === "unknown"
    ? value
    : undefined;
}

function normalizeReferenceKind(value: unknown): MarketAssetReferenceKind {
  return value === "previous-close" ||
    value === "relative-offset" ||
    value === "calendar-period-start" ||
    value === "custom"
    ? value
    : "custom";
}

function normalizeOffsetUnit(value: unknown): MarketAssetReferenceOffsetUnit | undefined {
  return value === "minute" ||
    value === "hour" ||
    value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "quarter" ||
    value === "year"
    ? value
    : undefined;
}

function normalizeTimestampMs(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    const absolute = Math.abs(value);

    if (absolute > 0 && absolute < 10_000_000_000) {
      return Math.trunc(value * 1000);
    }

    if (absolute > 10_000_000_000_000_000) {
      return Math.trunc(value / 1_000_000);
    }

    if (absolute > 10_000_000_000_000) {
      return Math.trunc(value / 1000);
    }

    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const numeric = Number(trimmed);

    if (Number.isFinite(numeric)) {
      return normalizeTimestampMs(numeric);
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeSequence(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }

  return undefined;
}

function normalizePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRowValue(row: Record<string, unknown>, fieldName: string | undefined) {
  return fieldName ? row[fieldName] : undefined;
}

function normalizeFrame(frame: TabularFrameSourceV1 | null | undefined) {
  return frame ? normalizeTabularFrameSource(frame) : null;
}

function fieldNamesFromFrame(frame: TabularFrameSourceV1) {
  const names = new Set<string>();

  frame.columns.forEach((column) => names.add(column));
  frame.fields?.forEach((field) => names.add(field.key));
  frame.rows.forEach((row) => {
    Object.keys(row).forEach((key) => names.add(key));
  });

  return Array.from(names);
}

function fieldSchemasByKey(frame: TabularFrameSourceV1) {
  return new Map((frame.fields ?? []).map((field) => [field.key, field]));
}

function findFieldByCandidates(
  fieldNames: string[],
  candidates: readonly string[],
) {
  const normalizedByField = new Map(fieldNames.map((field) => [normalizeFieldNameForMatch(field), field]));

  for (const candidate of candidates) {
    const field = normalizedByField.get(normalizeFieldNameForMatch(candidate));

    if (field) {
      return field;
    }
  }

  return undefined;
}

function resolveExplicitFrameField(
  fieldNames: string[],
  explicitField: string | undefined,
) {
  const normalizedExplicitField = normalizeFieldName(explicitField);

  if (!normalizedExplicitField) {
    return undefined;
  }

  return findFieldByCandidates(fieldNames, [normalizedExplicitField]);
}

function normalizeFieldRole(value: unknown): MarketAssetFieldRole | undefined {
  return value === "assetKey" ||
    value === "symbol" ||
    value === "displayName" ||
    value === "exchange" ||
    value === "currency" ||
    value === "country" ||
    value === "assetClass" ||
    value === "sector" ||
    value === "industry" ||
    value === "group" ||
    value === "tags" ||
    value === "observedAt" ||
    value === "sequence" ||
    value === "referenceKey" ||
    value === "referenceLabel" ||
    value === "referenceKind" ||
    value === "offsetUnit" ||
    value === "offsetValue" ||
    value === "quality" ||
    value === "value" ||
    value === "referenceValue" ||
    value === "sparklineSeries"
    ? value
    : undefined;
}

function normalizeFieldRoleBinding(value: unknown): MarketAssetFrameFieldRoleBinding | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const field = normalizeFieldName(value.field ?? value.name ?? value.key);
  const role = normalizeFieldRole(value.role);

  if (!field || !role) {
    return null;
  }

  return {
    field,
    role,
    valueKey: normalizeString(value.valueKey ?? value.measure ?? value.metric),
    referenceKey: normalizeString(value.referenceKey ?? value.reference),
    encoding: normalizeSparklineSeriesEncoding(value.encoding),
    order: normalizeSparklineSeriesOrder(value.order),
    required: value.required === true ? true : undefined,
    description: normalizeString(value.description),
  };
}

function normalizeSemanticMetadata(value: unknown): MarketAssetFrameSemanticMetadata | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const role = isMarketAssetFrameSemanticRole(value.role) ? value.role : undefined;

  if (!role || !Array.isArray(value.fieldRoles)) {
    return null;
  }

  const fieldRoles = value.fieldRoles.flatMap((entry) => {
    const normalized = normalizeFieldRoleBinding(entry);
    return normalized ? [normalized] : [];
  });

  return fieldRoles.length > 0
    ? {
        role,
        fieldRoles,
      }
    : null;
}

export function resolveMarketAssetFrameSemanticMetadata(
  frame: Pick<TabularFrameSourceV1, "meta"> | null | undefined,
): MarketAssetFrameSemanticMetadata | null {
  if (!frame?.meta || !isPlainRecord(frame.meta)) {
    return null;
  }

  return normalizeSemanticMetadata(frame.meta[semanticMetaKey]);
}

function normalizeTableVisualFormat(value: unknown): MarketTableVisualColumnMetadata["format"] | undefined {
  return value === "number" ||
    value === "price" ||
    value === "percent" ||
    value === "volume" ||
    value === "currency"
    ? value
    : undefined;
}

function normalizeTableVisualKind(value: unknown): MarketTableVisualColumnMetadata["kind"] | undefined {
  return value === "sparkline" || value === "bar" || value === "heatmap" ? value : undefined;
}

function normalizeTableVisualTone(value: unknown): MarketTableVisualTone | undefined {
  return value === "neutral" ||
    value === "primary" ||
    value === "success" ||
    value === "warning" ||
    value === "danger"
    ? value
    : undefined;
}

function normalizeTableVisualOperator(value: unknown): MarketTableVisualOperator | undefined {
  return value === "gt" || value === "gte" || value === "lt" || value === "lte" || value === "eq"
    ? value
    : undefined;
}

function normalizeTableVisualBarMode(value: unknown): MarketTableVisualBarMode | undefined {
  return value === "none" || value === "fill" ? value : undefined;
}

function normalizeTableVisualGradientMode(value: unknown): MarketTableVisualGradientMode | undefined {
  return value === "none" || value === "fill" ? value : undefined;
}

function normalizeTableVisualHeatmapPalette(value: unknown): MarketTableVisualHeatmapPalette | undefined {
  return value === "auto" ||
    value === "viridis" ||
    value === "plasma" ||
    value === "inferno" ||
    value === "magma" ||
    value === "turbo" ||
    value === "jet" ||
    value === "blue-white-red" ||
    value === "red-yellow-green"
    ? value
    : undefined;
}

function normalizeTableVisualGaugeMode(value: unknown): MarketTableVisualGaugeMode | undefined {
  return value === "none" || value === "ring" ? value : undefined;
}

function normalizeTableVisualRangeMode(value: unknown): MarketTableVisualRangeMode | undefined {
  return value === "auto" || value === "fixed" ? value : undefined;
}

function normalizeFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeColorScale(value: unknown): MarketTableColorScaleMetadata | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const colorScale = {
    negative: normalizeString(value.negative),
    neutral: normalizeString(value.neutral),
    positive: normalizeString(value.positive),
  } satisfies MarketTableColorScaleMetadata;

  return colorScale.negative || colorScale.neutral || colorScale.positive ? colorScale : undefined;
}

function normalizeRangeMetadata(value: unknown): MarketTableRangeMetadata | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const range = {
    min: normalizeFiniteNumber(value.min),
    max: normalizeFiniteNumber(value.max),
    midpoint: normalizeFiniteNumber(value.midpoint),
    clamp: value.clamp === true ? true : undefined,
  } satisfies MarketTableRangeMetadata;

  return range.min !== undefined ||
    range.max !== undefined ||
    range.midpoint !== undefined ||
    range.clamp
    ? range
    : undefined;
}

function normalizeThresholdRuleMetadata(value: unknown): MarketTableThresholdRuleMetadata | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const operator = normalizeTableVisualOperator(value.operator);
  const numericValue = normalizeFiniteNumber(value.value);

  if (!operator || numericValue === undefined) {
    return undefined;
  }

  return {
    backgroundColor: normalizeString(value.backgroundColor),
    id: normalizeString(value.id),
    operator,
    textColor: normalizeString(value.textColor),
    tone: normalizeTableVisualTone(value.tone),
    value: numericValue,
  };
}

function normalizeTableVisualColumnMetadata(value: unknown): MarketTableVisualColumnMetadata | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const thresholds = Array.isArray(value.thresholds)
    ? value.thresholds
        .map((entry) => normalizeThresholdRuleMetadata(entry))
        .filter((entry): entry is MarketTableThresholdRuleMetadata => Boolean(entry))
    : undefined;
  const metadata = {
    label: normalizeString(value.label),
    format: normalizeTableVisualFormat(value.format),
    colorScale: normalizeColorScale(value.colorScale),
    range: normalizeRangeMetadata(value.range),
    thresholds: thresholds && thresholds.length > 0 ? thresholds : undefined,
    heatmap: typeof value.heatmap === "boolean" ? value.heatmap : undefined,
    barMode: normalizeTableVisualBarMode(value.barMode),
    gradientMode: normalizeTableVisualGradientMode(value.gradientMode),
    heatmapPalette: normalizeTableVisualHeatmapPalette(value.heatmapPalette),
    gaugeMode: normalizeTableVisualGaugeMode(value.gaugeMode),
    visualRangeMode: normalizeTableVisualRangeMode(value.visualRangeMode),
    visualMin: normalizeFiniteNumber(value.visualMin),
    visualMax: normalizeFiniteNumber(value.visualMax),
    kind: normalizeTableVisualKind(value.kind),
    encoding: normalizeSparklineSeriesEncoding(value.encoding),
    order: normalizeSparklineSeriesOrder(value.order),
    width: normalizeFiniteNumber(value.width),
  } satisfies MarketTableVisualColumnMetadata;

  return Object.values(metadata).some((entry) => entry !== undefined) ? metadata : null;
}

function normalizeTableVisualsMetadata(value: unknown): MarketTableVisualsMetadata | null {
  if (!isPlainRecord(value) || !isPlainRecord(value.columns)) {
    return null;
  }

  const columns = Object.fromEntries(
    Object.entries(value.columns).flatMap(([key, entryValue]) => {
      const normalizedKey = normalizeString(key);
      const metadata = normalizeTableVisualColumnMetadata(entryValue);

      return normalizedKey && metadata ? [[normalizedKey, metadata] as const] : [];
    }),
  );

  return Object.keys(columns).length > 0 ? { columns } : null;
}

export function resolveMarketTableVisualsMetadata(
  frame: Pick<TabularFrameSourceV1, "meta"> | null | undefined,
): MarketTableVisualsMetadata | null {
  return resolveSharedTableVisualsMetadata(frame);
}

function expressionNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function fieldByRole(
  semanticMetadata: MarketAssetFrameSemanticMetadata | null,
  role: MarketAssetFieldRole,
  valueKey?: string,
) {
  const roles = semanticMetadata?.fieldRoles ?? [];
  const normalizedValueKey = valueKey ? normalizeFieldNameForMatch(valueKey) : undefined;

  return roles.find((entry) => {
    if (entry.role !== role) {
      return false;
    }

    if (!normalizedValueKey) {
      return true;
    }

    return entry.valueKey ? normalizeFieldNameForMatch(entry.valueKey) === normalizedValueKey : false;
  })?.field;
}

function fieldNamesForRole(
  semanticMetadata: MarketAssetFrameSemanticMetadata | null,
  role: MarketAssetFieldRole,
) {
  return (semanticMetadata?.fieldRoles ?? [])
    .filter((entry) => entry.role === role)
    .map((entry) => entry.field);
}

function resolveField(
  input: {
    explicitField?: string;
    semanticMetadata: MarketAssetFrameSemanticMetadata | null;
    role: MarketAssetFieldRole;
    fieldNames: string[];
    candidates?: readonly string[];
  },
) {
  return resolveExplicitFrameField(input.fieldNames, input.explicitField) ??
    fieldByRole(input.semanticMetadata, input.role) ??
    (input.candidates ? findFieldByCandidates(input.fieldNames, input.candidates) : undefined);
}

function isNumericField(
  frame: TabularFrameSourceV1,
  fieldName: string,
  schema: TabularFrameFieldSchema | undefined,
) {
  if (schema?.type === "number" || schema?.type === "integer") {
    return true;
  }

  if (schema && schema.type !== "unknown") {
    return false;
  }

  return frame.rows.some((row) => {
    const value = row[fieldName];
    return typeof value === "number" && Number.isFinite(value);
  });
}

function valueKeyFromFieldName(fieldName: string) {
  const normalizedField = normalizeFieldNameForMatch(fieldName);

  for (const [valueKey, candidates] of commonValueFieldKeys) {
    if (candidates.some((candidate) => normalizeFieldNameForMatch(candidate) === normalizedField)) {
      return valueKey;
    }
  }

  return fieldName;
}

function resolveValueFieldMapping(
  frame: TabularFrameSourceV1,
  input: {
    explicitValueFields?: Record<string, string>;
    semanticMetadata: MarketAssetFrameSemanticMetadata | null;
    excludedFields: Array<string | undefined>;
  },
) {
  const result: Record<string, string> = {};
  const fieldNames = fieldNamesFromFrame(frame);

  Object.entries(input.explicitValueFields ?? {}).forEach(([valueKey, fieldName]) => {
    const normalizedKey = normalizeString(valueKey);
    const resolvedField = resolveExplicitFrameField(fieldNames, fieldName);

    if (normalizedKey && resolvedField) {
      result[normalizedKey] = resolvedField;
    }
  });

  (input.semanticMetadata?.fieldRoles ?? []).forEach((fieldRole) => {
    if (fieldRole.role !== "value" || !fieldRole.valueKey) {
      return;
    }

    result[fieldRole.valueKey] = fieldRole.field;
  });

  if (Object.keys(result).length > 0) {
    return result;
  }

  const excluded = new Set(input.excludedFields.filter(Boolean));
  const schemas = fieldSchemasByKey(frame);

  fieldNames.forEach((fieldName) => {
    if (excluded.has(fieldName)) {
      return;
    }

    if (!isNumericField(frame, fieldName, schemas.get(fieldName))) {
      return;
    }

    result[valueKeyFromFieldName(fieldName)] = fieldName;
  });

  return result;
}

function resolveSnapshotMapping(
  frame: TabularFrameSourceV1,
  mapping?: MarketAssetSnapshotFieldMapping,
) {
  const fieldNames = fieldNamesFromFrame(frame);
  const semanticMetadata = resolveMarketAssetFrameSemanticMetadata(frame);
  const resolved = {
    assetKeyField: resolveField({
      explicitField: mapping?.assetKeyField,
      semanticMetadata,
      role: "assetKey",
      fieldNames,
      candidates: assetKeyCandidates,
    }),
    symbolField: resolveField({
      explicitField: mapping?.symbolField,
      semanticMetadata,
      role: "symbol",
      fieldNames,
      candidates: fieldCandidatesByRole.symbol,
    }),
    displayNameField: resolveField({
      explicitField: mapping?.displayNameField,
      semanticMetadata,
      role: "displayName",
      fieldNames,
      candidates: fieldCandidatesByRole.displayName,
    }),
    exchangeField: resolveField({
      explicitField: mapping?.exchangeField,
      semanticMetadata,
      role: "exchange",
      fieldNames,
      candidates: fieldCandidatesByRole.exchange,
    }),
    currencyField: resolveField({
      explicitField: mapping?.currencyField,
      semanticMetadata,
      role: "currency",
      fieldNames,
      candidates: fieldCandidatesByRole.currency,
    }),
    countryField: resolveField({
      explicitField: mapping?.countryField,
      semanticMetadata,
      role: "country",
      fieldNames,
      candidates: fieldCandidatesByRole.country,
    }),
    assetClassField: resolveField({
      explicitField: mapping?.assetClassField,
      semanticMetadata,
      role: "assetClass",
      fieldNames,
      candidates: fieldCandidatesByRole.assetClass,
    }),
    sectorField: resolveField({
      explicitField: mapping?.sectorField,
      semanticMetadata,
      role: "sector",
      fieldNames,
      candidates: fieldCandidatesByRole.sector,
    }),
    industryField: resolveField({
      explicitField: mapping?.industryField,
      semanticMetadata,
      role: "industry",
      fieldNames,
      candidates: fieldCandidatesByRole.industry,
    }),
    groupField: resolveField({
      explicitField: mapping?.groupField,
      semanticMetadata,
      role: "group",
      fieldNames,
      candidates: fieldCandidatesByRole.group,
    }),
    tagsField: resolveField({
      explicitField: mapping?.tagsField,
      semanticMetadata,
      role: "tags",
      fieldNames,
      candidates: fieldCandidatesByRole.tags,
    }),
    observedAtField: resolveField({
      explicitField: mapping?.observedAtField,
      semanticMetadata,
      role: "observedAt",
      fieldNames,
      candidates: fieldCandidatesByRole.observedAt,
    }),
    sequenceField: resolveField({
      explicitField: mapping?.sequenceField,
      semanticMetadata,
      role: "sequence",
      fieldNames,
      candidates: fieldCandidatesByRole.sequence,
    }),
    qualityField: resolveField({
      explicitField: mapping?.qualityField,
      semanticMetadata,
      role: "quality",
      fieldNames,
      candidates: fieldCandidatesByRole.quality,
    }),
  };

  return {
    ...resolved,
    valueFields: resolveValueFieldMapping(frame, {
      explicitValueFields: mapping?.valueFields,
      semanticMetadata,
      excludedFields: [
        ...Object.values(resolved),
        ...fieldNamesForRole(semanticMetadata, "referenceKey"),
        ...fieldNamesForRole(semanticMetadata, "referenceLabel"),
        ...fieldNamesForRole(semanticMetadata, "referenceKind"),
        ...fieldNamesForRole(semanticMetadata, "offsetUnit"),
        ...fieldNamesForRole(semanticMetadata, "offsetValue"),
        ...fieldNamesForRole(semanticMetadata, "referenceValue"),
        ...fieldNamesForRole(semanticMetadata, "sparklineSeries"),
      ],
    }),
  };
}

function resolveReferenceMapping(
  frame: TabularFrameSourceV1,
  mapping?: MarketAssetReferencePointsFieldMapping,
) {
  const snapshotMapping = resolveSnapshotMapping(frame, mapping);
  const fieldNames = fieldNamesFromFrame(frame);
  const semanticMetadata = resolveMarketAssetFrameSemanticMetadata(frame);

  return {
    ...snapshotMapping,
    referenceKeyField: resolveField({
      explicitField: mapping?.referenceKeyField,
      semanticMetadata,
      role: "referenceKey",
      fieldNames,
      candidates: fieldCandidatesByRole.referenceKey,
    }),
    referenceLabelField: resolveField({
      explicitField: mapping?.referenceLabelField,
      semanticMetadata,
      role: "referenceLabel",
      fieldNames,
      candidates: fieldCandidatesByRole.referenceLabel,
    }),
    referenceKindField: resolveField({
      explicitField: mapping?.referenceKindField,
      semanticMetadata,
      role: "referenceKind",
      fieldNames,
      candidates: fieldCandidatesByRole.referenceKind,
    }),
    offsetUnitField: resolveField({
      explicitField: mapping?.offsetUnitField,
      semanticMetadata,
      role: "offsetUnit",
      fieldNames,
      candidates: fieldCandidatesByRole.offsetUnit,
    }),
    offsetValueField: resolveField({
      explicitField: mapping?.offsetValueField,
      semanticMetadata,
      role: "offsetValue",
      fieldNames,
      candidates: fieldCandidatesByRole.offsetValue,
    }),
    wideReferenceValueFields: mapping?.wideReferenceValueFields,
  };
}

function resolveSourceRunId(frame: TabularFrameSourceV1) {
  const context = isPlainRecord(frame.source?.context) ? frame.source.context : {};
  const explicitRunId =
    normalizeString(context.sourceRunId) ??
    normalizeString(context.runId) ??
    normalizeString(context.executionId);

  if (explicitRunId) {
    return explicitRunId;
  }

  const sourceId = normalizeString(frame.source?.id);
  const updatedAtMs = normalizeTimestampMs(frame.source?.updatedAtMs);

  return [
    frame.source?.kind,
    sourceId,
    updatedAtMs,
  ].filter(Boolean).join(":") || undefined;
}

function buildIdentity(
  row: Record<string, unknown>,
  mapping: ReturnType<typeof resolveSnapshotMapping>,
  fallbackAssetKey: MarketAssetKey,
): MarketAssetIdentity | null {
  const assetKey =
    normalizeKey(getRowValue(row, mapping.assetKeyField)) ??
    normalizeKey(getRowValue(row, mapping.symbolField)) ??
    fallbackAssetKey;

  return {
    assetKey,
    symbol: normalizeString(getRowValue(row, mapping.symbolField)),
    displayName: normalizeString(getRowValue(row, mapping.displayNameField)),
    exchange: normalizeString(getRowValue(row, mapping.exchangeField)),
    currency: normalizeString(getRowValue(row, mapping.currencyField)),
    country: normalizeString(getRowValue(row, mapping.countryField)),
    assetClass: normalizeString(getRowValue(row, mapping.assetClassField)),
    sector: normalizeString(getRowValue(row, mapping.sectorField)),
    industry: normalizeString(getRowValue(row, mapping.industryField)),
    group: normalizeString(getRowValue(row, mapping.groupField)),
    tags: normalizeStringArray(getRowValue(row, mapping.tagsField)),
  };
}

function fallbackAssetKeyForRow(input: {
  index: number;
  lane: "snapshot" | "reference" | "history";
  sourceRunId?: string;
}) {
  return `__${input.lane}:${input.sourceRunId ?? "current"}:${input.index}`;
}

function compactIdentity(identity: MarketAssetIdentity): MarketAssetIdentity {
  return Object.fromEntries(
    Object.entries(identity).filter(([_key, value]) => value !== undefined),
  ) as MarketAssetIdentity;
}

function buildValues(
  row: Record<string, unknown>,
  valueFields: Record<string, string>,
) {
  const values: Record<string, MarketAssetScalarValue> = {};

  Object.entries(valueFields).forEach(([valueKey, fieldName]) => {
    const value = normalizeValue(row[fieldName]);

    if (value !== undefined) {
      values[valueKey] = value;
    }
  });

  return values;
}

function fieldRoleBindingsForRole(
  semanticMetadata: MarketAssetFrameSemanticMetadata | null,
  role: MarketAssetFieldRole,
) {
  return (semanticMetadata?.fieldRoles ?? []).filter((entry) => entry.role === role);
}

function referenceKindFromReferenceKey(referenceKey: string): MarketAssetReferenceKind {
  const normalized = normalizeFieldNameForMatch(referenceKey);

  if (normalized === "previousclose" || normalized === "prevclose") {
    return "previous-close";
  }

  if (normalized.includes("start")) {
    return "calendar-period-start";
  }

  if (normalized.includes("ago")) {
    return "relative-offset";
  }

  return "custom";
}

function parseNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.flatMap((entry) => {
    const numeric = expressionNumber(entry);
    return numeric === null ? [] : [numeric];
  });
}

function parseCsvNumberArray(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return [];
  }

  return normalized.split(/[\s,;]+/).flatMap((entry) => {
    const numeric = Number(entry);
    return Number.isFinite(numeric) ? [numeric] : [];
  });
}

function parseJsonNumberArray(value: unknown) {
  if (Array.isArray(value)) {
    return parseNumberArray(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    return parseNumberArray(JSON.parse(value));
  } catch {
    return null;
  }
}

function parseSparklineSeries(
  value: unknown,
  input: {
    encoding?: MarketAssetSparklineSeriesEncoding;
    order?: MarketAssetSparklineSeriesOrder;
  },
) {
  const parsed =
    input.encoding === "number-array"
      ? parseNumberArray(value)
      : input.encoding === "json-number-array"
        ? parseJsonNumberArray(value)
        : input.encoding === "csv-number"
          ? parseCsvNumberArray(value)
          : parseNumberArray(value) ?? parseJsonNumberArray(value) ?? parseCsvNumberArray(value);
  const values = parsed ?? [];

  return input.order === "newest-to-oldest" ? [...values].reverse() : values;
}

function buildInlineReferencePoints(
  row: Record<string, unknown>,
  input: {
    assetKey: MarketAssetKey;
    mapping: ReturnType<typeof resolveSnapshotMapping>;
    semanticMetadata: MarketAssetFrameSemanticMetadata | null;
    sourceRunId?: string;
  },
) {
  return fieldRoleBindingsForRole(input.semanticMetadata, "referenceValue").flatMap((binding) => {
    if (!binding.valueKey || !binding.referenceKey) {
      return [];
    }

    const value = normalizeValue(row[binding.field]);

    if (value === undefined) {
      return [];
    }

    return [{
      assetKey: input.assetKey,
      referenceKey: binding.referenceKey,
      referenceKind: referenceKindFromReferenceKey(binding.referenceKey),
      observedAtMs: normalizeTimestampMs(getRowValue(row, input.mapping.observedAtField)),
      sequence: normalizeSequence(getRowValue(row, input.mapping.sequenceField)),
      sourceRunId: input.sourceRunId,
      values: {
        [binding.valueKey]: value,
      },
      quality: normalizeQuality(getRowValue(row, input.mapping.qualityField)),
    } satisfies MarketAssetReferencePoint];
  });
}

function buildInlineSparklineHistory(
  row: Record<string, unknown>,
  input: {
    assetKey: MarketAssetKey;
    semanticMetadata: MarketAssetFrameSemanticMetadata | null;
    sourceRunId?: string;
  },
) {
  const pointsBySequence = new Map<number, MarketAssetValuePoint>();

  fieldRoleBindingsForRole(input.semanticMetadata, "sparklineSeries").forEach((binding) => {
    if (!binding.valueKey) {
      return;
    }

    const values = parseSparklineSeries(row[binding.field], {
      encoding: binding.encoding,
      order: binding.order,
    });

    values.forEach((value, index) => {
      const current = pointsBySequence.get(index);
      pointsBySequence.set(index, {
        assetKey: input.assetKey,
        sourceRunId: input.sourceRunId,
        sequence: index,
        values: {
          ...(current?.values ?? {}),
          [binding.valueKey!]: value,
        },
      });
    });
  });

  return Array.from(pointsBySequence.values()).sort((left, right) =>
    compareSequence(left.sequence, right.sequence),
  );
}

function visualColumnsForFrame(frame: TabularFrameSourceV1) {
  return resolveMarketTableVisualsMetadata(frame)?.columns ?? {};
}

function compareSequence(left: number | string | undefined, right: number | string | undefined) {
  if (left === undefined && right === undefined) {
    return 0;
  }

  if (left === undefined) {
    return -1;
  }

  if (right === undefined) {
    return 1;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return String(left).localeCompare(String(right));
}

function isNewerPoint(
  current: MarketAssetValuePoint | undefined,
  next: MarketAssetValuePoint,
) {
  if (!current) {
    return true;
  }

  const currentObservedAt = current.observedAtMs ?? -Infinity;
  const nextObservedAt = next.observedAtMs ?? -Infinity;

  if (nextObservedAt !== currentObservedAt) {
    return nextObservedAt > currentObservedAt;
  }

  return compareSequence(current.sequence, next.sequence) <= 0;
}

function mergeValuePoint(
  current: MarketAssetValuePoint | undefined,
  next: MarketAssetValuePoint,
) {
  if (!current) {
    return next;
  }

  return {
    ...current,
    ...next,
    values: {
      ...current.values,
      ...next.values,
    },
    diagnostics: [
      ...(current.diagnostics ?? []),
      ...(next.diagnostics ?? []),
    ],
  } satisfies MarketAssetValuePoint;
}

function upsertLatestPoint(
  latestByKey: Record<MarketAssetKey, MarketAssetValuePoint>,
  point: MarketAssetValuePoint,
  merge: boolean,
  options: {
    allowUntimedPatch?: boolean;
  } = {},
) {
  const current = latestByKey[point.assetKey];
  const isUntimedPatch = point.observedAtMs === undefined && point.sequence === undefined;

  if (!(options.allowUntimedPatch && isUntimedPatch) && !isNewerPoint(current, point)) {
    return;
  }

  latestByKey[point.assetKey] = merge ? mergeValuePoint(current, point) : point;
}

function sourceTimestamp(frame: TabularFrameSourceV1) {
  return normalizeTimestampMs(frame.source?.updatedAtMs);
}

export function adaptMarketAssetSnapshotFrame(
  frameInput: TabularFrameSourceV1 | null | undefined,
  mapping?: MarketAssetSnapshotFieldMapping,
): MarketAssetSnapshotAdapterResult {
  const frame = normalizeFrame(frameInput);

  if (!frame) {
    return {
      assetsByKey: {},
      latestByKey: {},
      referencesByKey: {},
      historyByKey: {},
      visualsByKey: {},
      warnings: ["Snapshot frame is missing or invalid."],
    };
  }

  if (frame.status !== "ready") {
    return {
      assetsByKey: {},
      latestByKey: {},
      referencesByKey: {},
      historyByKey: {},
      visualsByKey: {},
      warnings: [`Snapshot frame is ${frame.status}.`],
      sourceRunId: resolveSourceRunId(frame),
      updatedAtMs: sourceTimestamp(frame),
    };
  }

  const resolvedMapping = resolveSnapshotMapping(frame, mapping);
  const semanticMetadata = resolveMarketAssetFrameSemanticMetadata(frame);
  const visualColumns = visualColumnsForFrame(frame);
  const warnings: string[] = [];
  const assetsByKey: Record<MarketAssetKey, MarketAssetIdentity> = {};
  const latestByKey: Record<MarketAssetKey, MarketAssetValuePoint> = {};
  const referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>> = {};
  const historyByKey: Record<MarketAssetKey, MarketAssetValuePoint[]> = {};
  const visualsByKey: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>> = {};
  const sourceRunId = resolveSourceRunId(frame);

  if (Object.keys(resolvedMapping.valueFields).length === 0) {
    warnings.push("Snapshot frame does not expose any mapped numeric value fields.");
  }

  frame.rows.forEach((row, index) => {
    const identity = buildIdentity(
      row,
      resolvedMapping,
      fallbackAssetKeyForRow({ index, lane: "snapshot", sourceRunId }),
    );

    if (!identity) {
      return;
    }

    const asset = compactIdentity(identity);
    const values = buildValues(row, resolvedMapping.valueFields);

    assetsByKey[asset.assetKey] = {
      ...assetsByKey[asset.assetKey],
      ...asset,
    };

    buildInlineReferencePoints(row, {
      assetKey: asset.assetKey,
      mapping: resolvedMapping,
      semanticMetadata,
      sourceRunId,
    }).forEach((point) => upsertReferencePoint(referencesByKey, point));

    const inlineHistory = buildInlineSparklineHistory(row, {
      assetKey: asset.assetKey,
      semanticMetadata,
      sourceRunId,
    });

    if (inlineHistory.length > 0) {
      historyByKey[asset.assetKey] = inlineHistory;
    }

    if (Object.keys(visualColumns).length > 0) {
      visualsByKey[asset.assetKey] = visualColumns;
    }

    if (Object.keys(values).length > 0) {
      upsertLatestPoint(latestByKey, {
        assetKey: asset.assetKey,
        observedAtMs: normalizeTimestampMs(getRowValue(row, resolvedMapping.observedAtField)),
        sequence: normalizeSequence(getRowValue(row, resolvedMapping.sequenceField)),
        sourceRunId,
        values,
        quality: normalizeQuality(getRowValue(row, resolvedMapping.qualityField)),
      }, false);
    }
  });

  return {
    assetsByKey,
    latestByKey,
    referencesByKey,
    historyByKey,
    visualsByKey,
    warnings,
    sourceRunId,
    updatedAtMs: sourceTimestamp(frame),
  };
}

function buildReferencePoint(
  row: Record<string, unknown>,
  input: {
    assetKey: MarketAssetKey;
    referenceKey: string;
    mapping: ReturnType<typeof resolveReferenceMapping>;
    valueFields: Record<string, string>;
    sourceRunId?: string;
  },
): MarketAssetReferencePoint | null {
  const values = buildValues(row, input.valueFields);

  if (Object.keys(values).length === 0) {
    return null;
  }

  const offsetUnit = normalizeOffsetUnit(getRowValue(row, input.mapping.offsetUnitField));
  const offsetValue = normalizePositiveNumber(getRowValue(row, input.mapping.offsetValueField));

  return {
    assetKey: input.assetKey,
    referenceKey: input.referenceKey,
    referenceLabel: normalizeString(getRowValue(row, input.mapping.referenceLabelField)),
    referenceKind: normalizeReferenceKind(getRowValue(row, input.mapping.referenceKindField)),
    observedAtMs: normalizeTimestampMs(getRowValue(row, input.mapping.observedAtField)),
    sequence: normalizeSequence(getRowValue(row, input.mapping.sequenceField)),
    sourceRunId: input.sourceRunId,
    values,
    quality: normalizeQuality(getRowValue(row, input.mapping.qualityField)),
    offset: offsetUnit && offsetValue !== undefined
      ? {
          unit: offsetUnit,
          value: offsetValue,
        }
      : undefined,
  };
}

function isNewerReferencePoint(
  current: MarketAssetReferencePoint | undefined,
  next: MarketAssetReferencePoint,
) {
  if (current?.quality && next.quality && current.quality !== next.quality) {
    if (next.quality === "exact") {
      return true;
    }

    if (current.quality === "exact") {
      return false;
    }
  }

  return isNewerPoint(current, next);
}

function upsertReferencePoint(
  referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>,
  point: MarketAssetReferencePoint,
) {
  const assetReferences = referencesByKey[point.assetKey] ?? {};
  const current = assetReferences[point.referenceKey];

  if (isNewerReferencePoint(current, point)) {
    assetReferences[point.referenceKey] = point;
    referencesByKey[point.assetKey] = assetReferences;
  }
}

export function adaptMarketAssetReferencePointsFrame(
  frameInput: TabularFrameSourceV1 | null | undefined,
  mapping?: MarketAssetReferencePointsFieldMapping,
): MarketAssetReferencePointsAdapterResult {
  const frame = normalizeFrame(frameInput);

  if (!frame) {
    return {
      assetsByKey: {},
      referencesByKey: {},
      warnings: ["Reference frame is missing or invalid."],
    };
  }

  if (frame.status !== "ready") {
    return {
      assetsByKey: {},
      referencesByKey: {},
      warnings: [`Reference frame is ${frame.status}.`],
      sourceRunId: resolveSourceRunId(frame),
      updatedAtMs: sourceTimestamp(frame),
    };
  }

  const resolvedMapping = resolveReferenceMapping(frame, mapping);
  const warnings: string[] = [];
  const assetsByKey: Record<MarketAssetKey, MarketAssetIdentity> = {};
  const referencesByKey: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>> = {};

  const sourceRunId = resolveSourceRunId(frame);
  const wideReferenceEntries = Object.entries(resolvedMapping.wideReferenceValueFields ?? {});

  if (!resolvedMapping.referenceKeyField && wideReferenceEntries.length === 0) {
    return {
      assetsByKey,
      referencesByKey,
      warnings: ["Reference frame must expose referenceKey or wideReferenceValueFields."],
      sourceRunId,
      updatedAtMs: sourceTimestamp(frame),
    };
  }

  frame.rows.forEach((row, index) => {
    const identity = buildIdentity(
      row,
      resolvedMapping,
      fallbackAssetKeyForRow({ index, lane: "reference", sourceRunId }),
    );

    if (!identity) {
      return;
    }

    const asset = compactIdentity(identity);
    assetsByKey[asset.assetKey] = {
      ...assetsByKey[asset.assetKey],
      ...asset,
    };

    if (resolvedMapping.referenceKeyField) {
      const referenceKey = normalizeString(getRowValue(row, resolvedMapping.referenceKeyField));

      if (!referenceKey) {
        warnings.push(`Reference row ${index + 1} is missing a reference key.`);
      } else {
        const point = buildReferencePoint(row, {
          assetKey: asset.assetKey,
          referenceKey,
          mapping: resolvedMapping,
          valueFields: resolvedMapping.valueFields,
          sourceRunId,
        });

        if (point) {
          upsertReferencePoint(referencesByKey, point);
        }
      }
    }

    wideReferenceEntries.forEach(([referenceKey, valueFields]) => {
      const point = buildReferencePoint(row, {
        assetKey: asset.assetKey,
        referenceKey,
        mapping: resolvedMapping,
        valueFields,
        sourceRunId,
      });

      if (point) {
        upsertReferencePoint(referencesByKey, point);
      }
    });
  });

  return {
    assetsByKey,
    referencesByKey,
    warnings,
    sourceRunId,
    updatedAtMs: sourceTimestamp(frame),
  };
}

export function adaptMarketAssetHistorySeriesFrame(
  frameInput: TabularFrameSourceV1 | null | undefined,
  mapping?: MarketAssetHistorySeriesFieldMapping,
): MarketAssetHistorySeriesAdapterResult {
  const frame = normalizeFrame(frameInput);

  if (!frame) {
    return {
      assetsByKey: {},
      historyByKey: {},
      warnings: ["History frame is missing or invalid."],
    };
  }

  if (frame.status !== "ready") {
    return {
      assetsByKey: {},
      historyByKey: {},
      warnings: [`History frame is ${frame.status}.`],
      sourceRunId: resolveSourceRunId(frame),
      updatedAtMs: sourceTimestamp(frame),
    };
  }

  const resolvedMapping = resolveSnapshotMapping(frame, mapping);
  const assetsByKey: Record<MarketAssetKey, MarketAssetIdentity> = {};
  const historyByKey: Record<MarketAssetKey, MarketAssetValuePoint[]> = {};
  const warnings: string[] = [];
  const sourceRunId = resolveSourceRunId(frame);

  frame.rows.forEach((row, index) => {
    const identity = buildIdentity(
      row,
      resolvedMapping,
      fallbackAssetKeyForRow({ index, lane: "history", sourceRunId }),
    );

    if (!identity) {
      return;
    }

    const asset = compactIdentity(identity);
    const values = buildValues(row, resolvedMapping.valueFields);

    assetsByKey[asset.assetKey] = {
      ...assetsByKey[asset.assetKey],
      ...asset,
    };

    if (Object.keys(values).length === 0) {
      return;
    }

    const history = historyByKey[asset.assetKey] ?? [];
    history.push({
      assetKey: asset.assetKey,
      observedAtMs: normalizeTimestampMs(getRowValue(row, resolvedMapping.observedAtField)),
      sequence: normalizeSequence(getRowValue(row, resolvedMapping.sequenceField)),
      sourceRunId,
      values,
      quality: normalizeQuality(getRowValue(row, resolvedMapping.qualityField)),
    });
    historyByKey[asset.assetKey] = history;
  });

  Object.values(historyByKey).forEach((history) => {
    history.sort((left, right) =>
      (left.observedAtMs ?? 0) - (right.observedAtMs ?? 0) ||
      compareSequence(left.sequence, right.sequence),
    );
  });

  return {
    assetsByKey,
    historyByKey,
    warnings,
    sourceRunId,
    updatedAtMs: sourceTimestamp(frame),
  };
}

function emptyRuntimeModel(): MarketAssetScreenerRuntimeModel {
  return {
    schemaVersion: "market.asset_screener_runtime@v1",
    assetsByKey: {},
    latestByKey: {},
    referencesByKey: {},
    historyByKey: {},
    visualsByKey: {},
    sourceState: {},
    warnings: [],
  };
}

function mergeAssets(
  left: Record<MarketAssetKey, MarketAssetIdentity>,
  right: Record<MarketAssetKey, MarketAssetIdentity>,
) {
  return Object.fromEntries(
    Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).map((assetKey) => [
      assetKey,
      {
        ...left[assetKey],
        ...right[assetKey],
        assetKey,
      },
    ]),
  ) as Record<MarketAssetKey, MarketAssetIdentity>;
}

function mergeReferencesByKey(
  left: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>,
  right: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>>,
) {
  const nextReferences: Record<MarketAssetKey, Record<string, MarketAssetReferencePoint>> =
    Object.fromEntries(
      Object.entries(left).map(([assetKey, references]) => [assetKey, { ...references }]),
    );

  Object.values(right).forEach((references) => {
    Object.values(references).forEach((reference) => {
      upsertReferencePoint(nextReferences, reference);
    });
  });

  return nextReferences;
}

function mergeHistoryByKey(
  left: Record<MarketAssetKey, MarketAssetValuePoint[]> | undefined,
  right: Record<MarketAssetKey, MarketAssetValuePoint[]>,
) {
  const nextHistory = {
    ...(left ?? {}),
  };

  Object.entries(right).forEach(([assetKey, history]) => {
    nextHistory[assetKey] = [...history].sort((leftPoint, rightPoint) =>
      (leftPoint.observedAtMs ?? 0) - (rightPoint.observedAtMs ?? 0) ||
      compareSequence(leftPoint.sequence, rightPoint.sequence),
    );
  });

  return nextHistory;
}

function mergeVisualsByKey(
  left: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>> | undefined,
  right: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>>,
) {
  const nextVisuals: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>> =
    Object.fromEntries(
      Object.entries(left ?? {}).map(([assetKey, visuals]) => [assetKey, { ...visuals }]),
    );

  Object.entries(right).forEach(([assetKey, visuals]) => {
    nextVisuals[assetKey] = {
      ...(nextVisuals[assetKey] ?? {}),
      ...visuals,
    };
  });

  return nextVisuals;
}

function normalizeLiveMergeKeyMappings(
  mappings: readonly TabularMergeKeyMapping[] | undefined,
): TabularMergeKeyMapping[] {
  return (Array.isArray(mappings) ? mappings : []).flatMap((mapping) => {
    const seedField = typeof mapping.seedField === "string" ? mapping.seedField.trim() : "";
    const liveField = typeof mapping.liveField === "string" ? mapping.liveField.trim() : "";

    return seedField && liveField ? [{ seedField, liveField }] : [];
  });
}

function hasMergeValue(value: unknown) {
  return value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
}

function stringifyMergeValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function resolveMergeField(fieldNames: string[], field: string) {
  return resolveExplicitFrameField(fieldNames, field) ?? field;
}

function buildMappedMergeKey(input: {
  row: Record<string, unknown>;
  fieldNames: string[];
  mappings: readonly TabularMergeKeyMapping[];
  side: "seed" | "live";
}) {
  const values: string[] = [];

  for (const mapping of input.mappings) {
    const field = resolveMergeField(
      input.fieldNames,
      input.side === "seed" ? mapping.seedField : mapping.liveField,
    );
    const value = input.row[field];

    if (!hasMergeValue(value)) {
      return null;
    }

    values.push(stringifyMergeValue(value));
  }

  return values.join("\u001f");
}

function buildLiveAssetKeyAliases(input: {
  seedData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
  seedMapping?: MarketAssetSnapshotFieldMapping;
  liveMapping?: MarketAssetSnapshotFieldMapping;
  liveMergeKeyMappings?: readonly TabularMergeKeyMapping[];
}) {
  const mappings = normalizeLiveMergeKeyMappings(input.liveMergeKeyMappings);
  const seedFrame = normalizeFrame(input.seedData);
  const liveFrame = normalizeFrame(input.liveUpdates);

  if (mappings.length === 0 || seedFrame?.status !== "ready" || liveFrame?.status !== "ready") {
    return new Map<MarketAssetKey, MarketAssetKey>();
  }

  const seedSourceRunId = resolveSourceRunId(seedFrame);
  const liveSourceRunId = resolveSourceRunId(liveFrame);
  const seedMapping = resolveSnapshotMapping(seedFrame, input.seedMapping);
  const liveMapping = resolveSnapshotMapping(liveFrame, input.liveMapping);
  const seedFieldNames = fieldNamesFromFrame(seedFrame);
  const liveFieldNames = fieldNamesFromFrame(liveFrame);
  const seedAssetKeyByMergeKey = new Map<string, MarketAssetKey>();

  seedFrame.rows.forEach((row, index) => {
    const mergeKey = buildMappedMergeKey({
      row,
      fieldNames: seedFieldNames,
      mappings,
      side: "seed",
    });

    if (!mergeKey) {
      return;
    }

    const identity = buildIdentity(
      row,
      seedMapping,
      fallbackAssetKeyForRow({ index, lane: "snapshot", sourceRunId: seedSourceRunId }),
    );

    if (identity) {
      seedAssetKeyByMergeKey.set(mergeKey, identity.assetKey);
    }
  });

  if (seedAssetKeyByMergeKey.size === 0) {
    return new Map<MarketAssetKey, MarketAssetKey>();
  }

  const liveAssetKeyAliases = new Map<MarketAssetKey, MarketAssetKey>();

  liveFrame.rows.forEach((row, index) => {
    const mergeKey = buildMappedMergeKey({
      row,
      fieldNames: liveFieldNames,
      mappings,
      side: "live",
    });
    const seedAssetKey = mergeKey ? seedAssetKeyByMergeKey.get(mergeKey) : undefined;

    if (!seedAssetKey) {
      return;
    }

    const identity = buildIdentity(
      row,
      liveMapping,
      fallbackAssetKeyForRow({ index, lane: "snapshot", sourceRunId: liveSourceRunId }),
    );

    if (identity) {
      liveAssetKeyAliases.set(identity.assetKey, seedAssetKey);
    }
  });

  return liveAssetKeyAliases;
}

function addLiveToSeedFieldAlias(
  aliases: Map<string, string>,
  input: {
    liveField: string | undefined;
    seedField: string | undefined;
  },
) {
  if (!input.liveField || !input.seedField || input.liveField === input.seedField) {
    return;
  }

  aliases.set(input.liveField, input.seedField);
}

function buildLiveToSeedFieldAliases(input: {
  seedData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
  seedMapping?: MarketAssetSnapshotFieldMapping;
  liveMapping?: MarketAssetSnapshotFieldMapping;
  liveMergeKeyMappings?: readonly TabularMergeKeyMapping[];
}) {
  const seedFrame = normalizeFrame(input.seedData);
  const liveFrame = normalizeFrame(input.liveUpdates);
  const aliases = new Map<string, string>();

  if (seedFrame?.status !== "ready" || liveFrame?.status !== "ready") {
    return aliases;
  }

  const seedFieldNames = fieldNamesFromFrame(seedFrame);
  const liveFieldNames = fieldNamesFromFrame(liveFrame);
  const seedMapping = resolveSnapshotMapping(seedFrame, input.seedMapping);
  const liveMapping = resolveSnapshotMapping(liveFrame, input.liveMapping);

  normalizeLiveMergeKeyMappings(input.liveMergeKeyMappings).forEach((mapping) => {
    addLiveToSeedFieldAlias(aliases, {
      seedField: resolveMergeField(seedFieldNames, mapping.seedField),
      liveField: resolveMergeField(liveFieldNames, mapping.liveField),
    });
  });

  [
    [liveMapping.assetKeyField, seedMapping.assetKeyField],
    [liveMapping.symbolField, seedMapping.symbolField],
    [liveMapping.displayNameField, seedMapping.displayNameField],
    [liveMapping.exchangeField, seedMapping.exchangeField],
    [liveMapping.currencyField, seedMapping.currencyField],
    [liveMapping.countryField, seedMapping.countryField],
    [liveMapping.assetClassField, seedMapping.assetClassField],
    [liveMapping.sectorField, seedMapping.sectorField],
    [liveMapping.industryField, seedMapping.industryField],
    [liveMapping.groupField, seedMapping.groupField],
    [liveMapping.tagsField, seedMapping.tagsField],
    [liveMapping.observedAtField, seedMapping.observedAtField],
    [liveMapping.sequenceField, seedMapping.sequenceField],
    [liveMapping.qualityField, seedMapping.qualityField],
  ].forEach(([liveField, seedField]) => {
    addLiveToSeedFieldAlias(aliases, { liveField, seedField });
  });

  Object.entries(seedMapping.valueFields).forEach(([valueKey, seedField]) => {
    addLiveToSeedFieldAlias(aliases, {
      seedField,
      liveField: liveMapping.valueFields[valueKey],
    });
  });

  return aliases;
}

function renameFieldWithAliases(field: string, aliases: ReadonlyMap<string, string>) {
  return aliases.get(field) ?? field;
}

function renameFieldListWithAliases(
  fields: readonly string[],
  aliases: ReadonlyMap<string, string>,
) {
  const seen = new Set<string>();

  return fields.flatMap((field) => {
    const renamed = renameFieldWithAliases(field, aliases);

    if (seen.has(renamed)) {
      return [];
    }

    seen.add(renamed);
    return [renamed];
  });
}

function renameRowWithAliases(
  row: Record<string, unknown>,
  aliases: ReadonlyMap<string, string>,
) {
  const nextRow = { ...row };

  aliases.forEach((seedField, liveField) => {
    if (!Object.prototype.hasOwnProperty.call(row, liveField)) {
      return;
    }

    nextRow[seedField] = row[liveField];
    delete nextRow[liveField];
  });

  return nextRow;
}

function renameFieldSchemasWithAliases(
  fields: readonly TabularFrameFieldSchema[] | undefined,
  aliases: ReadonlyMap<string, string>,
) {
  if (!fields) {
    return undefined;
  }

  const seen = new Set<string>();
  const renamed = fields.flatMap((field) => {
    const key = renameFieldWithAliases(field.key, aliases);

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [{ ...field, key }];
  });

  return renamed.length > 0 ? renamed : undefined;
}

function renameTableVisualColumnsWithAliases(
  columns: unknown,
  aliases: ReadonlyMap<string, string>,
) {
  if (!isPlainRecord(columns)) {
    return columns;
  }

  return Object.entries(columns).reduce<Record<string, unknown>>((nextColumns, [field, value]) => {
    nextColumns[renameFieldWithAliases(field, aliases)] = value;
    return nextColumns;
  }, {});
}

function renameMarketAssetMetaWithAliases(
  meta: TabularFrameSourceV1["meta"],
  aliases: ReadonlyMap<string, string>,
): TabularFrameSourceV1["meta"] {
  if (!isPlainRecord(meta)) {
    return meta;
  }

  const nextMeta: Record<string, unknown> = { ...meta };
  const marketAsset = nextMeta[semanticMetaKey];

  if (isPlainRecord(marketAsset) && Array.isArray(marketAsset.fieldRoles)) {
    nextMeta[semanticMetaKey] = {
      ...marketAsset,
      fieldRoles: marketAsset.fieldRoles.map((fieldRole) =>
        isPlainRecord(fieldRole) && typeof fieldRole.field === "string"
          ? {
              ...fieldRole,
              field: renameFieldWithAliases(fieldRole.field, aliases),
            }
          : fieldRole,
      ),
    };
  }

  const tableVisuals = nextMeta[tableVisualsMetaKey];

  if (isPlainRecord(tableVisuals)) {
    nextMeta[tableVisualsMetaKey] = {
      ...tableVisuals,
      columns: renameTableVisualColumnsWithAliases(tableVisuals.columns, aliases),
    };
  }

  return nextMeta as TabularFrameSourceV1["meta"];
}

function normalizeLiveFrameToSeedFields(input: {
  seedData?: TabularFrameSourceV1 | null;
  liveUpdates?: TabularFrameSourceV1 | null;
  seedMapping?: MarketAssetSnapshotFieldMapping;
  liveMapping?: MarketAssetSnapshotFieldMapping;
  liveMergeKeyMappings?: readonly TabularMergeKeyMapping[];
}) {
  const liveFrame = normalizeFrame(input.liveUpdates);

  if (!liveFrame || liveFrame.status !== "ready") {
    return input.liveUpdates ?? null;
  }

  const aliases = buildLiveToSeedFieldAliases(input);

  if (aliases.size === 0) {
    return input.liveUpdates ?? null;
  }

  return normalizeTabularFrameSource({
    ...liveFrame,
    columns: renameFieldListWithAliases(liveFrame.columns, aliases),
    rows: liveFrame.rows.map((row) => renameRowWithAliases(row, aliases)),
    fields: renameFieldSchemasWithAliases(liveFrame.fields, aliases),
    meta: renameMarketAssetMetaWithAliases(liveFrame.meta, aliases),
  });
}

function remapAssetsByAlias(
  assetsByKey: Record<MarketAssetKey, MarketAssetIdentity>,
  aliases: ReadonlyMap<MarketAssetKey, MarketAssetKey>,
) {
  if (aliases.size === 0) {
    return assetsByKey;
  }

  const remapped: Record<MarketAssetKey, MarketAssetIdentity> = {};

  Object.entries(assetsByKey).forEach(([assetKey, asset]) => {
    const nextAssetKey = aliases.get(assetKey) ?? assetKey;
    remapped[nextAssetKey] = {
      ...remapped[nextAssetKey],
      ...asset,
      assetKey: nextAssetKey,
    };
  });

  return remapped;
}

function remapHistoryByAlias(
  historyByKey: Record<MarketAssetKey, MarketAssetValuePoint[]>,
  aliases: ReadonlyMap<MarketAssetKey, MarketAssetKey>,
) {
  if (aliases.size === 0) {
    return historyByKey;
  }

  const remapped: Record<MarketAssetKey, MarketAssetValuePoint[]> = {};

  Object.entries(historyByKey).forEach(([assetKey, history]) => {
    const nextAssetKey = aliases.get(assetKey) ?? assetKey;
    remapped[nextAssetKey] = [
      ...(remapped[nextAssetKey] ?? []),
      ...history.map((point) => ({ ...point, assetKey: nextAssetKey })),
    ];
  });

  return remapped;
}

function remapVisualsByAlias(
  visualsByKey: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>>,
  aliases: ReadonlyMap<MarketAssetKey, MarketAssetKey>,
) {
  if (aliases.size === 0) {
    return visualsByKey;
  }

  const remapped: Record<MarketAssetKey, Record<string, MarketTableVisualColumnMetadata>> = {};

  Object.entries(visualsByKey).forEach(([assetKey, visuals]) => {
    const nextAssetKey = aliases.get(assetKey) ?? assetKey;
    remapped[nextAssetKey] = {
      ...(remapped[nextAssetKey] ?? {}),
      ...visuals,
    };
  });

  return remapped;
}

export function buildMarketAssetScreenerRuntimeModelFromTabularFrames(
  input: BuildMarketAssetScreenerRuntimeModelInput,
): MarketAssetScreenerRuntimeModel {
  const model = input.previousModel
    ? {
        ...input.previousModel,
        assetsByKey: { ...input.previousModel.assetsByKey },
        latestByKey: { ...input.previousModel.latestByKey },
        referencesByKey: Object.fromEntries(
          Object.entries(input.previousModel.referencesByKey).map(([assetKey, references]) => [
            assetKey,
            { ...references },
          ]),
        ),
        historyByKey: input.previousModel.historyByKey
          ? Object.fromEntries(
              Object.entries(input.previousModel.historyByKey).map(([assetKey, history]) => [
                assetKey,
                [...history],
              ]),
            )
          : undefined,
        visualsByKey: input.previousModel.visualsByKey
          ? Object.fromEntries(
              Object.entries(input.previousModel.visualsByKey).map(([assetKey, visuals]) => [
                assetKey,
                { ...visuals },
              ]),
            )
          : undefined,
        sourceState: { ...input.previousModel.sourceState },
        warnings: [],
      }
    : emptyRuntimeModel();

  if (input.seedData) {
    const seed = adaptMarketAssetSnapshotFrame(input.seedData, input.seedMapping);
    model.assetsByKey = mergeAssets(model.assetsByKey, seed.assetsByKey);
    model.latestByKey = seed.latestByKey;
    model.referencesByKey = mergeReferencesByKey(model.referencesByKey, seed.referencesByKey);
    model.historyByKey = mergeHistoryByKey(model.historyByKey, seed.historyByKey);
    model.visualsByKey = mergeVisualsByKey(model.visualsByKey, seed.visualsByKey);
    model.sourceState.seedRunId = seed.sourceRunId;
    model.sourceState.lastSeedAtMs = seed.updatedAtMs;
    model.warnings.push(...seed.warnings);
  }

  if (input.referenceFrame) {
    const references = adaptMarketAssetReferencePointsFrame(
      input.referenceFrame,
      input.referenceMapping,
    );
    model.assetsByKey = mergeAssets(model.assetsByKey, references.assetsByKey);
    model.referencesByKey = mergeReferencesByKey(model.referencesByKey, references.referencesByKey);
    model.sourceState.referenceRunId = references.sourceRunId;
    model.sourceState.lastReferenceAtMs = references.updatedAtMs;
    model.warnings.push(...references.warnings);
  }

  if (input.historyFrame) {
    const history = adaptMarketAssetHistorySeriesFrame(input.historyFrame, input.historyMapping);
    model.assetsByKey = mergeAssets(model.assetsByKey, history.assetsByKey);
    model.historyByKey = mergeHistoryByKey(model.historyByKey, history.historyByKey);
    model.sourceState.historyRunId = history.sourceRunId;
    model.sourceState.lastHistoryAtMs = history.updatedAtMs;
    model.warnings.push(...history.warnings);
  }

  if (input.liveUpdates) {
    const liveAssetKeyAliases = buildLiveAssetKeyAliases(input);
    const normalizedLiveUpdates = normalizeLiveFrameToSeedFields(input);
    const live = adaptMarketAssetSnapshotFrame(
      normalizedLiveUpdates,
      input.seedMapping ?? input.liveMapping,
    );
    model.assetsByKey = mergeAssets(
      model.assetsByKey,
      remapAssetsByAlias(live.assetsByKey, liveAssetKeyAliases),
    );
    Object.values(live.latestByKey).forEach((point) => {
      const assetKey = liveAssetKeyAliases.get(point.assetKey) ?? point.assetKey;
      upsertLatestPoint(model.latestByKey, { ...point, assetKey }, true, {
        allowUntimedPatch: true,
      });
    });
    model.historyByKey = mergeHistoryByKey(
      model.historyByKey,
      remapHistoryByAlias(live.historyByKey, liveAssetKeyAliases),
    );
    model.visualsByKey = mergeVisualsByKey(
      model.visualsByKey,
      remapVisualsByAlias(live.visualsByKey, liveAssetKeyAliases),
    );
    model.sourceState.liveRunId = live.sourceRunId;
    model.sourceState.lastLiveAtMs = live.updatedAtMs;
    model.warnings.push(...live.warnings);
  }

  return model;
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function calculateReturn(
  latest: MarketAssetValuePoint | null,
  reference: MarketAssetReferencePoint | undefined,
  valueField: string,
  returnMode: "absolute" | "percent",
) {
  const latestValue = numericValue(latest?.values[valueField]);
  const referenceValue = numericValue(reference?.values[valueField]);

  if (latestValue === null || referenceValue === null) {
    return null;
  }

  if (returnMode === "absolute") {
    return latestValue - referenceValue;
  }

  if (referenceValue === 0) {
    return null;
  }

  return (latestValue / referenceValue - 1) * 100;
}

function metricForColumn(
  column: MarketAssetScreenerColumn,
  input: {
    asset: MarketAssetIdentity;
    latest: MarketAssetValuePoint | null;
    references: Record<string, MarketAssetReferencePoint | undefined>;
  },
) {
  if (column.kind === "asset-field") {
    return normalizeValue(input.asset[column.field as keyof MarketAssetIdentity]) ?? null;
  }

  if (column.kind === "latest-value") {
    return input.latest?.values[column.valueField] ?? null;
  }

  if (column.kind === "reference-value") {
    return input.references[column.referenceKey]?.values[column.valueField] ?? null;
  }

  if (column.kind === "return") {
    return calculateReturn(
      input.latest,
      input.references[column.referenceKey],
      column.valueField,
      column.returnMode,
    );
  }

  return null;
}

export function deriveMarketAssetScreenerRows(
  model: MarketAssetScreenerRuntimeModel,
  columns: MarketAssetScreenerColumn[] = [],
): MarketAssetScreenerRow[] {
  const assetKeys = Array.from(new Set([
    ...Object.keys(model.assetsByKey),
    ...Object.keys(model.latestByKey),
    ...Object.keys(model.referencesByKey),
    ...Object.keys(model.historyByKey ?? {}),
    ...Object.keys(model.visualsByKey ?? {}),
  ])).sort();

  return assetKeys.map((assetKey) => {
    const asset = model.assetsByKey[assetKey] ?? { assetKey };
    const latest = model.latestByKey[assetKey] ?? null;
    const references = model.referencesByKey[assetKey] ?? {};
    const history = model.historyByKey?.[assetKey] ?? [];
    const visuals = model.visualsByKey?.[assetKey] ?? {};
    const diagnostics = [
      ...(latest?.diagnostics ?? []),
      ...Object.values(references).flatMap((reference) => reference?.diagnostics ?? []),
      ...history.flatMap((point) => point.diagnostics ?? []),
    ];
    let status: MarketAssetScreenerRow["status"] = latest ? "ready" : "missing-latest";

    const missingReference = columns.some((column) =>
      (column.kind === "reference-value" || column.kind === "return") &&
      !references[column.referenceKey],
    );

    if (latest?.quality === "stale") {
      status = "stale";
    } else if (missingReference) {
      status = "missing-reference";
    }

    const metrics = Object.fromEntries(
      columns.map((column) => [column.id, metricForColumn(column, {
        asset,
        latest,
        references,
      })]),
    ) as Record<string, MarketAssetScalarValue>;

    columns.forEach((column) => {
      if (column.kind === "return") {
        const latestValue = numericValue(latest?.values[column.valueField]);
        const reference = references[column.referenceKey];
        const referenceValue = numericValue(reference?.values[column.valueField]);

        if (latestValue !== null && referenceValue === 0) {
          diagnostics.push(`Reference ${column.referenceKey} ${column.valueField} is zero.`);
        }
      }
    });

    return {
      asset,
      latest,
      references,
      history,
      visuals,
      metrics,
      status,
      diagnostics,
    };
  });
}

export const MARKET_ASSET_SCREENER_SEED_INPUT_ID = "seedData" as const;
export const MARKET_ASSET_SCREENER_LIVE_UPDATES_INPUT_ID = "liveUpdates" as const;
export const MARKET_ASSET_SCREENER_DATASET_OUTPUT_ID = "dataset" as const;
export const MARKET_ASSET_SCREENER_INPUT_CONTRACTS = [
  CORE_TABULAR_FRAME_SOURCE_CONTRACT,
] as const;
