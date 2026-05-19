import type {
  TargetPortfolioWeightsPositionColumnDef,
  TargetPortfolioWeightsPositionDetailsResponse,
} from "../../../../common/api";

export type PortfolioWeightsSourceType = "portfolio" | "account" | "target_position";
export type PortfolioWeightsCanonicalPositionType =
  | "weight_notional_exposure"
  | "units"
  | "constant_notional";
export type PortfolioWeightsInlinePositionType = string;

export interface PortfolioWeightsInlineRow extends Record<string, unknown> {
  rowId: string;
  assetId: number;
  assetName?: string;
  assetTicker?: string;
  uniqueIdentifier?: string;
  figi?: string;
  date?: string;
  price?: number | null;
  positionType: PortfolioWeightsInlinePositionType;
  positionValue: number;
}

export interface PortfolioWeightsWidgetProps extends Record<string, unknown> {
  portfolioId?: number;
  accountUid?: string;
  holdingsDate?: string;
  targetPortfolioId?: number;
  variant?: "summary" | "positions";
  tableMinWidth?: number;
  editableInPlace?: boolean;
  sourceType?: PortfolioWeightsSourceType;
  positionRows?: PortfolioWeightsInlineRow[];
  dataMode?: "portfolio" | "inline";
  inlineRows?: PortfolioWeightsInlineRow[];
}

export interface PortfolioWeightsWidgetRuntimeState extends Record<string, unknown> {
  status?: "idle" | "loading" | "success" | "error";
  error?: string;
  targetPortfolioId?: number;
  accountUid?: string;
  variant?: "summary" | "positions";
  payload?: TargetPortfolioWeightsPositionDetailsResponse;
  lastLoadedAtMs?: number;
}

const allPositionTypes = [
  "weight_notional_exposure",
  "units",
  "constant_notional",
] as const satisfies readonly PortfolioWeightsCanonicalPositionType[];

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

function normalizePortfolioWeightsInlinePositionValue(value: unknown) {
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

function normalizePortfolioWeightsInlinePrice(value: unknown) {
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

function normalizePortfolioWeightsInlineDate(value: unknown, fallback = getTodayIsoDate()) {
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

export function normalizePortfolioWeightsHoldingsDate(
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

export function normalizePortfolioWeightsSourceType(
  props: Pick<PortfolioWeightsWidgetProps, "sourceType" | "dataMode">,
): PortfolioWeightsSourceType {
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

export function getAllowedPortfolioWeightsPositionTypes(
  sourceType: PortfolioWeightsSourceType,
): readonly PortfolioWeightsCanonicalPositionType[] {
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

export function getDefaultPortfolioWeightsPositionType(
  sourceType: PortfolioWeightsSourceType,
): PortfolioWeightsCanonicalPositionType {
  return getAllowedPortfolioWeightsPositionTypes(sourceType)[0] ?? "weight_notional_exposure";
}

function normalizePortfolioWeightsInlinePositionType(
  value: unknown,
  sourceType: PortfolioWeightsSourceType,
): PortfolioWeightsInlinePositionType {
  if (sourceType === "account") {
    return readString(value) ?? "units";
  }

  const allowedPositionTypes = getAllowedPortfolioWeightsPositionTypes(sourceType);
  return allowedPositionTypes.includes(value as PortfolioWeightsCanonicalPositionType)
    ? (value as PortfolioWeightsCanonicalPositionType)
    : getDefaultPortfolioWeightsPositionType(sourceType);
}

export function normalizePortfolioWeightsPositionRows(
  value: unknown,
  sourceType: PortfolioWeightsSourceType,
): PortfolioWeightsInlineRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<PortfolioWeightsInlineRow[]>((rows, entry, index) => {
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
            date: normalizePortfolioWeightsInlineDate(
              entry.date ?? entry.asOfDate ?? entry.as_of_date ?? entry.effective_date ?? entry.position_date,
            ),
          }),
      price: normalizePortfolioWeightsInlinePrice(entry.price),
      positionType: normalizePortfolioWeightsInlinePositionType(entry.positionType, sourceType),
      positionValue: normalizePortfolioWeightsInlinePositionValue(entry.positionValue),
    });

    return rows;
  }, []);
}

export function normalizePortfolioWeightsPersistedRows(
  props: Pick<PortfolioWeightsWidgetProps, "positionRows" | "inlineRows" | "sourceType" | "dataMode">,
): PortfolioWeightsInlineRow[] {
  const sourceType = normalizePortfolioWeightsSourceType(props);
  return normalizePortfolioWeightsPositionRows(
    Array.isArray(props.positionRows) ? props.positionRows : props.inlineRows,
    sourceType,
  );
}

export function buildPortfolioWeightsInlineDisplayRows(
  rows: PortfolioWeightsInlineRow[],
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    id: row.assetId,
    asset_id: row.assetId,
    asset_name: row.assetName || `Asset ${row.assetId}`,
    asset_ticker: row.assetTicker || null,
    unique_identifier: row.uniqueIdentifier || null,
    figi: row.figi || row.uniqueIdentifier || null,
    ...(row.date ? { date: row.date } : {}),
    price: row.price ?? null,
    position_type: row.positionType,
    position_value: row.positionValue,
  }));
}

function normalizePortfolioWeightsPayload(
  value: unknown,
): TargetPortfolioWeightsPositionDetailsResponse | undefined {
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
    columnDefs: value.columnDefs as TargetPortfolioWeightsPositionColumnDef[],
    summaryColumnDefs: value.summaryColumnDefs as TargetPortfolioWeightsPositionColumnDef[],
    position_map:
      value.position_map && typeof value.position_map === "object"
        ? (value.position_map as Record<string, unknown>)
        : null,
    weights_date: typeof value.weights_date === "string" ? value.weights_date : null,
  };
}

export function hydratePortfolioWeightsRowsFromPayload(
  payload: TargetPortfolioWeightsPositionDetailsResponse | undefined,
  sourceType: PortfolioWeightsSourceType,
): PortfolioWeightsInlineRow[] {
  if (!payload?.rows?.length) {
    return [];
  }

  const fallbackDate = normalizePortfolioWeightsInlineDate(payload.weights_date, getTodayIsoDate());
  const useSnapshotDate = sourceType === "portfolio" || sourceType === "account";

  return payload.rows.reduce<PortfolioWeightsInlineRow[]>((rows, entry, index) => {
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
      ...(sourceType === "account"
        ? {}
        : {
            date: useSnapshotDate
              ? fallbackDate
              : normalizePortfolioWeightsInlineDate(
                  entry.date ??
                    entry.as_of_date ??
                    entry.effective_date ??
                    entry.position_date ??
                    entry.timestamp ??
                    entry.time_index,
                  fallbackDate,
                ),
          }),
      price: normalizePortfolioWeightsInlinePrice(
        entry.price ?? entry.current_price ?? entry.market_price ?? entry.last_price ?? entry.close,
      ),
      positionType: normalizePortfolioWeightsInlinePositionType(entry.position_type, sourceType),
      positionValue: normalizePortfolioWeightsInlinePositionValue(entry.position_value),
    });

    return rows;
  }, []);
}

export function normalizePortfolioWeightsDataMode(
  props: Pick<PortfolioWeightsWidgetProps, "sourceType" | "dataMode">,
): "portfolio" | "inline" {
  return normalizePortfolioWeightsSourceType(props) === "portfolio" ? "portfolio" : "inline";
}

export function normalizePortfolioWeightsTargetId(
  props: Pick<PortfolioWeightsWidgetProps, "portfolioId" | "targetPortfolioId">,
) {
  const parsed = Number(props.portfolioId ?? props.targetPortfolioId ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.trunc(parsed);
}

export function normalizePortfolioWeightsAccountUid(
  props: Pick<PortfolioWeightsWidgetProps, "accountUid">,
) {
  return readString(props.accountUid) ?? "";
}

export function normalizePortfolioWeightsVariant(value: unknown): "summary" | "positions" {
  return value === "summary" ? "summary" : "positions";
}

export function normalizePortfolioWeightsRuntimeState(
  runtimeState: Record<string, unknown> | undefined,
): PortfolioWeightsWidgetRuntimeState {
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
    variant: normalizePortfolioWeightsVariant(value.variant),
    payload: normalizePortfolioWeightsPayload(value.payload),
    lastLoadedAtMs:
      typeof value.lastLoadedAtMs === "number" && Number.isFinite(value.lastLoadedAtMs)
        ? value.lastLoadedAtMs
        : undefined,
  };
}
