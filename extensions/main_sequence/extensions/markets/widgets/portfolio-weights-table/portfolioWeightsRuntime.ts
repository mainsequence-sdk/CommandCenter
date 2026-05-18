import type {
  TargetPortfolioWeightsPositionColumnDef,
  TargetPortfolioWeightsPositionDetailsResponse,
} from "../../../../common/api";

export type PortfolioWeightsDataMode = "portfolio" | "inline";
export type PortfolioWeightsInlinePositionType =
  | "weight_notional_exposure"
  | "units"
  | "constant_notional";

export interface PortfolioWeightsInlineRow extends Record<string, unknown> {
  rowId: string;
  assetId: number;
  assetName?: string;
  assetTicker?: string;
  uniqueIdentifier?: string;
  figi?: string;
  positionType: PortfolioWeightsInlinePositionType;
  positionValue: number;
}

export interface PortfolioWeightsWidgetProps extends Record<string, unknown> {
  portfolioId?: number;
  targetPortfolioId?: number;
  variant?: "summary" | "positions";
  tableMinWidth?: number;
  editableInPlace?: boolean;
  dataMode?: PortfolioWeightsDataMode;
  inlineRows?: PortfolioWeightsInlineRow[];
}

export interface PortfolioWeightsWidgetRuntimeState extends Record<string, unknown> {
  status?: "idle" | "loading" | "success" | "error";
  error?: string;
  targetPortfolioId?: number;
  variant?: "summary" | "positions";
  payload?: TargetPortfolioWeightsPositionDetailsResponse;
  lastLoadedAtMs?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePortfolioWeightsInlinePositionType(
  value: unknown,
): PortfolioWeightsInlinePositionType {
  return value === "units" || value === "constant_notional"
    ? value
    : "weight_notional_exposure";
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

export function normalizePortfolioWeightsInlineRows(
  value: unknown,
): PortfolioWeightsInlineRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<PortfolioWeightsInlineRow[]>((rows, entry, index) => {
      if (!isPlainRecord(entry)) {
        return rows;
      }

      const assetId = Number(entry.assetId);

      if (!Number.isFinite(assetId) || assetId <= 0) {
        return rows;
      }

      const rowId =
        typeof entry.rowId === "string" && entry.rowId.trim()
          ? entry.rowId.trim()
          : `inline-position-${Math.trunc(assetId)}-${index + 1}`;

      rows.push({
        rowId,
        assetId: Math.trunc(assetId),
        assetName:
          typeof entry.assetName === "string" && entry.assetName.trim()
            ? entry.assetName.trim()
            : undefined,
        assetTicker:
          typeof entry.assetTicker === "string" && entry.assetTicker.trim()
            ? entry.assetTicker.trim()
            : undefined,
        uniqueIdentifier:
          typeof entry.uniqueIdentifier === "string" && entry.uniqueIdentifier.trim()
            ? entry.uniqueIdentifier.trim()
            : undefined,
        figi:
          typeof entry.figi === "string" && entry.figi.trim()
            ? entry.figi.trim()
            : undefined,
        positionType: normalizePortfolioWeightsInlinePositionType(entry.positionType),
        positionValue: normalizePortfolioWeightsInlinePositionValue(entry.positionValue),
      });

      return rows;
    }, []);
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
    position_type: row.positionType,
    position_value: row.positionValue,
  }));
}

export function normalizePortfolioWeightsDataMode(
  props: Pick<PortfolioWeightsWidgetProps, "dataMode" | "editableInPlace">,
): PortfolioWeightsDataMode {
  return props.dataMode === "inline" || props.editableInPlace === true
    ? "inline"
    : "portfolio";
}

function normalizePortfolioWeightsPayload(
  value: unknown,
): TargetPortfolioWeightsPositionDetailsResponse | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (!Array.isArray(value.rows) || !Array.isArray(value.columnDefs) || !Array.isArray(value.summaryColumnDefs)) {
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

export function normalizePortfolioWeightsTargetId(props: Pick<PortfolioWeightsWidgetProps, "portfolioId" | "targetPortfolioId">) {
  const parsed = Number(props.portfolioId ?? props.targetPortfolioId ?? "");

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.trunc(parsed);
}

export function normalizePortfolioWeightsVariant(
  value: unknown,
): "summary" | "positions" {
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
    error:
      typeof value.error === "string" && value.error.trim() ? value.error : undefined,
    targetPortfolioId:
      typeof value.targetPortfolioId === "number" && Number.isFinite(value.targetPortfolioId)
        ? Math.trunc(value.targetPortfolioId)
        : undefined,
    variant: normalizePortfolioWeightsVariant(value.variant),
    payload: normalizePortfolioWeightsPayload(value.payload),
    lastLoadedAtMs:
      typeof value.lastLoadedAtMs === "number" && Number.isFinite(value.lastLoadedAtMs)
        ? value.lastLoadedAtMs
        : undefined,
  };
}
