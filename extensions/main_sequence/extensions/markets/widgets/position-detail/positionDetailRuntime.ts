import type {
  TargetPositionDetailPositionColumnDef,
  TargetPositionDetailPositionDetailsResponse,
} from "../../../../common/api";

export type PositionDetailSourceType = "portfolio" | "account" | "target_position";
export type PositionDetailCanonicalPositionType =
  | "weight_notional_exposure"
  | "units"
  | "constant_notional";
export type PositionDetailInlinePositionType = string;

export interface PositionDetailInlineRow extends Record<string, unknown> {
  rowId: string;
  assetId: number;
  assetName?: string;
  assetTicker?: string;
  uniqueIdentifier?: string;
  figi?: string;
  date?: string;
  price?: number | null;
  positionType: PositionDetailInlinePositionType;
  positionValue: number;
}

export interface PositionDetailWidgetProps extends Record<string, unknown> {
  portfolioId?: number;
  accountUid?: string;
  holdingsDate?: string;
  targetPortfolioId?: number;
  variant?: "summary" | "positions";
  tableMinWidth?: number;
  editableInPlace?: boolean;
  sourceType?: PositionDetailSourceType;
  positionRows?: PositionDetailInlineRow[];
  dataMode?: "portfolio" | "inline";
  inlineRows?: PositionDetailInlineRow[];
}

export interface PositionDetailWidgetRuntimeState extends Record<string, unknown> {
  status?: "idle" | "loading" | "success" | "error";
  error?: string;
  targetPortfolioId?: number;
  accountUid?: string;
  variant?: "summary" | "positions";
  payload?: TargetPositionDetailPositionDetailsResponse;
  lastLoadedAtMs?: number;
}

const allPositionTypes = [
  "weight_notional_exposure",
  "units",
  "constant_notional",
] as const satisfies readonly PositionDetailCanonicalPositionType[];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.trunc(parsed);
}

function normalizePositionDetailInlinePositionValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizePositionDetailInlinePrice(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentIsoTimestamp() {
  return new Date().toISOString();
}

function normalizePositionDetailInlineDate(value: unknown, fallback = getTodayIsoDate()) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const directDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directDateMatch?.[1]) {
      return directDateMatch[1];
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }

  return fallback;
}

export function normalizePositionDetailHoldingsDate(
  value: unknown,
  fallback = getCurrentIsoTimestamp(),
) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return fallback;
}

export function normalizePositionDetailSourceType(
  props: Pick<PositionDetailWidgetProps, "sourceType" | "dataMode">,
): PositionDetailSourceType {
  if (
    props.sourceType === "portfolio" ||
    props.sourceType === "account" ||
    props.sourceType === "target_position"
  ) {
    return props.sourceType;
  }

  if (props.dataMode === "inline") {
    return "target_position";
  }

  return "portfolio";
}

export function getAllowedPositionDetailPositionTypes(
  sourceType: PositionDetailSourceType,
): readonly PositionDetailCanonicalPositionType[] {
  switch (sourceType) {
    case "portfolio":
      return ["weight_notional_exposure"];
    case "account":
      return ["units"];
    case "target_position":
      return allPositionTypes;
    default:
      return allPositionTypes;
  }
}

export function getDefaultPositionDetailPositionType(
  sourceType: PositionDetailSourceType,
): PositionDetailCanonicalPositionType {
  return getAllowedPositionDetailPositionTypes(sourceType)[0] ?? "weight_notional_exposure";
}

function normalizePositionDetailInlinePositionType(
  value: unknown,
  sourceType: PositionDetailSourceType,
): PositionDetailInlinePositionType {
  if (sourceType === "account") {
    return "units";
  }

  const allowedPositionTypes = getAllowedPositionDetailPositionTypes(sourceType);
  return allowedPositionTypes.includes(value as PositionDetailCanonicalPositionType)
    ? (value as PositionDetailCanonicalPositionType)
    : getDefaultPositionDetailPositionType(sourceType);
}

export function normalizePositionDetailPositionRows(
  value: unknown,
  sourceType: PositionDetailSourceType,
): PositionDetailInlineRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<PositionDetailInlineRow[]>((rows, entry, index) => {
    if (!isPlainRecord(entry)) {
      return rows;
    }

    const assetId = readPositiveInt(entry.assetId);
    if (assetId <= 0) {
      return rows;
    }

    const rowId =
      typeof entry.rowId === "string" && entry.rowId.trim()
        ? entry.rowId.trim()
        : `position-row-${assetId}-${index + 1}`;

    rows.push({
      rowId,
      assetId,
      assetName: readString(entry.assetName),
      assetTicker: readString(entry.assetTicker),
      uniqueIdentifier: readString(entry.uniqueIdentifier),
      figi: readString(entry.figi),
      ...(sourceType === "account"
        ? {}
        : {
            date: normalizePositionDetailInlineDate(
              entry.date ?? entry.asOfDate ?? entry.as_of_date ?? entry.effective_date ?? entry.position_date,
            ),
          }),
      price: normalizePositionDetailInlinePrice(entry.price),
      positionType: normalizePositionDetailInlinePositionType(entry.positionType, sourceType),
      positionValue: normalizePositionDetailInlinePositionValue(entry.positionValue),
    });

    return rows;
  }, []);
}

export function normalizePositionDetailPersistedRows(
  props: Pick<PositionDetailWidgetProps, "positionRows" | "inlineRows" | "sourceType" | "dataMode">,
): PositionDetailInlineRow[] {
  const sourceType = normalizePositionDetailSourceType(props);
  return normalizePositionDetailPositionRows(
    Array.isArray(props.positionRows) ? props.positionRows : props.inlineRows,
    sourceType,
  );
}

export function buildPositionDetailInlineDisplayRows(
  rows: PositionDetailInlineRow[],
  sourceType?: PositionDetailSourceType,
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    id: row.assetId,
    asset_id: row.assetId,
    asset_name: row.assetName || `Asset ${row.assetId}`,
    asset_ticker: row.assetTicker || null,
    unique_identifier: row.uniqueIdentifier || null,
    figi: row.figi || row.uniqueIdentifier || null,
    ...(row.date ? { date: row.date } : {}),
    ...(row.price !== null && row.price !== undefined ? { price: row.price } : {}),
    ...(sourceType === "account" ? {} : { position_type: row.positionType }),
    position_value: row.positionValue,
  }));
}

function normalizePositionDetailPayload(
  value: unknown,
): TargetPositionDetailPositionDetailsResponse | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (
    !Array.isArray(value.rows) ||
    !Array.isArray(value.columnDefs) ||
    !Array.isArray(value.summaryColumnDefs)
  ) {
    return undefined;
  }

  return {
    weights: value.weights,
    position_columns: Array.isArray(value.position_columns) ? value.position_columns : [],
    rows: value.rows as Array<Record<string, unknown>>,
    columnDefs: value.columnDefs as TargetPositionDetailPositionColumnDef[],
    summaryColumnDefs: value.summaryColumnDefs as TargetPositionDetailPositionColumnDef[],
    position_map:
      value.position_map && typeof value.position_map === "object"
        ? (value.position_map as Record<string, unknown>)
        : null,
    weights_date: typeof value.weights_date === "string" ? value.weights_date : null,
  };
}

export function hydratePositionDetailRowsFromPayload(
  payload: TargetPositionDetailPositionDetailsResponse | undefined,
  sourceType: PositionDetailSourceType,
): PositionDetailInlineRow[] {
  if (!payload?.rows?.length) {
    return [];
  }

  const fallbackDate = normalizePositionDetailInlineDate(payload.weights_date, getTodayIsoDate());
  const useSnapshotDate = sourceType === "portfolio" || sourceType === "account";

  return payload.rows.reduce<PositionDetailInlineRow[]>((rows, entry, index) => {
    if (!isPlainRecord(entry)) {
      return rows;
    }

    const assetId = readPositiveInt(entry.asset_id ?? entry.id);
    if (assetId <= 0) {
      return rows;
    }

    rows.push({
      rowId: `hydrated-position-${assetId}-${index + 1}`,
      assetId,
      assetName: readString(entry.asset_name),
      assetTicker: readString(entry.asset_ticker),
      uniqueIdentifier: readString(entry.unique_identifier),
      figi: readString(entry.figi),
      date: useSnapshotDate
        ? fallbackDate
        : normalizePositionDetailInlineDate(
            entry.date ??
              entry.as_of_date ??
              entry.effective_date ??
              entry.position_date ??
              entry.timestamp ??
              entry.time_index,
            fallbackDate,
          ),
      price: normalizePositionDetailInlinePrice(
        entry.price ?? entry.current_price ?? entry.market_price ?? entry.last_price ?? entry.close,
      ),
      positionType:
        sourceType === "account"
          ? "units"
          : normalizePositionDetailInlinePositionType(entry.position_type, sourceType),
      positionValue: normalizePositionDetailInlinePositionValue(entry.position_value),
    });

    return rows;
  }, []);
}

export function normalizePositionDetailDataMode(
  props: Pick<PositionDetailWidgetProps, "sourceType" | "dataMode">,
): "portfolio" | "inline" {
  return normalizePositionDetailSourceType(props) === "portfolio" ? "portfolio" : "inline";
}

export function normalizePositionDetailTargetId(
  props: Pick<PositionDetailWidgetProps, "portfolioId" | "targetPortfolioId">,
) {
  const parsed = Number(props.portfolioId ?? props.targetPortfolioId ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.trunc(parsed);
}

export function normalizePositionDetailAccountUid(
  props: Pick<PositionDetailWidgetProps, "accountUid">,
) {
  return readString(props.accountUid) ?? "";
}

export function normalizePositionDetailVariant(value: unknown): "summary" | "positions" {
  return value === "summary" ? "summary" : "positions";
}

export function normalizePositionDetailRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
): PositionDetailWidgetRuntimeState {
  const value = isPlainRecord(runtimeState) ? runtimeState : {};

  return {
    status:
      value.status === "loading" ||
      value.status === "success" ||
      value.status === "error"
        ? value.status
        : "idle",
    error: typeof value.error === "string" && value.error.trim() ? value.error : undefined,
    targetPortfolioId:
      typeof value.targetPortfolioId === "number" && Number.isFinite(value.targetPortfolioId)
        ? Math.trunc(value.targetPortfolioId)
        : undefined,
    accountUid: readString(value.accountUid),
    variant: normalizePositionDetailVariant(value.variant),
    payload: normalizePositionDetailPayload(value.payload),
    lastLoadedAtMs:
      typeof value.lastLoadedAtMs === "number" && Number.isFinite(value.lastLoadedAtMs)
        ? value.lastLoadedAtMs
        : undefined,
  };
}
