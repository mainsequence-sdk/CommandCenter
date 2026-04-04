import type {
  TargetPortfolioWeightsPositionColumnDef,
  TargetPortfolioWeightsPositionDetailsResponse,
} from "../../../../common/api";

export interface PortfolioWeightsWidgetProps extends Record<string, unknown> {
  portfolioId?: number;
  targetPortfolioId?: number;
  variant?: "summary" | "positions";
  tableMinWidth?: number;
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
